const OpenAIModule = require('openai')
const { OPENAI_API_KEY, MODELS, MAX_TOOL_ROUNDS, ARC, TREASURY } = require('./config')
const { toolDefs, runTool, toolLabel } = require('./tools')

const OpenAI = OpenAIModule.default || OpenAIModule.OpenAI || OpenAIModule
let client = null
function getClient() {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured on the server')
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY })
  return client
}

function systemPrompt({ address, lang, watchlist, profile }) {
  const today = new Date().toISOString().slice(0, 10)
  return `You are Makoto, a sharp, friendly AI agent that gets things done for crypto users. You run on ${ARC.name} (Circle's stablecoin-native L1, chain id ${ARC.chainId}, gas paid in USDC). Users pay for your work with USDC credits on Arc.

Today is ${today}. ${address ? `The user's connected wallet is ${address}.` : `The user signed in with Google and has not connected a wallet yet (they can connect one in Settings → Connections).`} Makoto's treasury wallet is ${TREASURY}. Arc explorer: ${ARC.explorer}. Testnet USDC faucet: ${ARC.faucet}.${watchlist?.length ? `
Tokens on the user's watchlist ("coins I follow"): ${watchlist.join(', ')}.` : ''}${profile ? `

What you remember about this user from past chats (use it naturally to personalize answers and risk notes; do not recite the list; if they correct something, trust the correction):
${profile}` : ''}

How to work:
- When the user pastes a crypto call / shill / presale invite or asks if a token is legit or a scam, call check_call with their message verbatim. The verdict card shows the details; reply with a short takeaway in plain words.
- For questions about a crypto project (what it does, team, funding, backers, token status, official links or contracts) call search_project with its name; with query null it lists projects recently funded by top funds. Cards render automatically; the app also has a "Dự án" (Projects) page in the sidebar with full profiles. Summarize the key facts: what the project does, sector, funding raised and lead backers, token launched or not, team transparency, and official links. Makoto does not track airdrops, reward campaigns or farming tasks: if asked about an airdrop, testnet or points campaign, share the project's public facts and recent official news (web_search / get_crypto_news) without listing tasks, farming steps or reward predictions, and remind users that airdrops are never guaranteed and never to enter a seed phrase or private key on any site. Never mention tool names or raw codes; translate everything into plain words in the user's language.
- Always use tools for live data (prices, rankings, news, web, Arc on-chain). Never invent numbers. Call several tools in parallel when useful.
- The interface automatically renders rich cards for tool results (price charts, ranking tables, news cards, wallet/tx cards). Do NOT restate the numbers already on the card (price, % change, high/low) field by field and never show raw unix timestamps; give 2-5 key takeaways, analysis and context instead.
- Reply in the user's language (Vietnamese if they write Vietnamese; default ${lang === 'en' ? 'English' : 'Vietnamese'}). Write the WHOLE reply in that one language: never mix in English filler words or phrases (e.g. no "Here's", "Overall", "Note") in a Vietnamese reply. Ticker symbols, project names and standard terms like ATH, TVL, DeFi are fine.
- Format with concise Markdown: short paragraphs, bullet points, **bold** key numbers. Use headings only for longer answers.
- Prices: use $ with sensible precision. Percentages with 2 decimals.
- If a tool fails, say so briefly and continue with what you have.
- You can draft content, plan, explain, compare, and analyze. You cannot sign or send transactions for the user; explain the steps instead.
- Never offer things you cannot do: no price alerts, notifications, scheduled reports, trading or portfolio tracking. When you end with a follow-up offer, only offer something your tools can do (e.g. compare with another coin, show a longer chart, check a token).
- Not financial advice: when giving opinions on trades, add a short risk note.`
}

/**
 * Run the agent loop with streaming. `emit(event, data)` sends SSE events.
 * Returns { content, steps, widgets, toolCalls }.
 */
async function runAgent({ history, modelKey, address, lang, emit, signal, watchlist, profile }) {
  const model = MODELS[modelKey] || MODELS.fast
  const openai = getClient()
  const messages = [{ role: 'system', content: systemPrompt({ address, lang, watchlist, profile }) }, ...history]
  const steps = []
  const widgets = []
  let content = ''
  let toolCalls = 0

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const allowTools = round < MAX_TOOL_ROUNDS
    const stream = await openai.chat.completions.create(
      {
        model: model.id,
        messages,
        stream: true,
        reasoning_effort: allowTools && model.toolReasoning ? model.toolReasoning : model.reasoning,
        ...(allowTools ? { tools: toolDefs, parallel_tool_calls: true } : {}),
      },
      { signal }
    )

    let roundText = ''
    const calls = []
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue
      if (delta.content) {
        roundText += delta.content
        emit('delta', { text: delta.content })
      }
      for (const tc of delta.tool_calls || []) {
        const i = tc.index ?? 0
        calls[i] = calls[i] || { id: '', name: '', args: '' }
        if (tc.id) calls[i].id = tc.id
        if (tc.function?.name) calls[i].name += tc.function.name
        if (tc.function?.arguments) calls[i].args += tc.function.arguments
      }
    }
    content += roundText

    const valid = calls.filter((c) => c && c.name)
    if (!valid.length) break

    messages.push({
      role: 'assistant',
      content: roundText || null,
      tool_calls: valid.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args || '{}' } })),
    })

    const results = await Promise.all(
      valid.map(async (c) => {
        let args = {}
        try { args = JSON.parse(c.args || '{}') } catch { /* ignore */ }
        const step = { id: c.id, tool: c.name, label: toolLabel(c.name, lang), args, status: 'running' }
        steps.push(step)
        emit('step', step)
        const started = Date.now()
        const out = await runTool(c.name, args, { address, lang, profile })
        step.status = out.result?.error ? 'error' : 'done'
        step.ms = Date.now() - started
        emit('step', step)
        if (out.widget) {
          widgets.push(out.widget)
          emit('widget', out.widget)
        }
        toolCalls++
        return { id: c.id, result: out.result }
      })
    )
    for (const r of results) {
      messages.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.result).slice(0, 14000) })
    }
    if (roundText) {
      emit('delta', { text: '\n\n' })
      content += '\n\n'
    }
  }

  return { content: content.trim(), steps, widgets, toolCalls }
}

async function makeTitle(text, lang) {
  try {
    const r = await getClient().chat.completions.create({
      model: 'gpt-5-nano',
      reasoning_effort: 'minimal',
      messages: [
        { role: 'system', content: `You label chat conversations. Do NOT answer the message. Output only a short topic title (2-6 words, no quotes, no trailing period) describing what the user asks about. Write it in ${lang === 'en' ? 'English' : 'Vietnamese (use English only if the message is clearly written in English)'}. Never use any other language.` },
        { role: 'user', content: `Message to label: <<<${text.slice(0, 500)}>>>` },
      ],
    })
    return (r.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '').slice(0, 80) || null
  } catch {
    return null
  }
}

async function makeSuggestions(question, answer, lang) {
  try {
    const r = await getClient().chat.completions.create({
      model: 'gpt-5-nano',
      reasoning_effort: 'minimal',
      messages: [
        {
          role: 'system',
          content: `You write follow-up prompts for a crypto AI agent chat. The agent can ONLY: get token prices and charts, market rankings (top market cap, gainers, losers, volume, by category), crypto news, web search and reading pages, the Fear & Greed index, fact-check a token, call, shill or presale message for scam risk (trust score), look up crypto project profiles (what it does, team, funding, backers, token status, official links), and look up Arc Testnet wallets, transactions and network stats. It cannot set alerts, trade, or send transactions.
Output ONLY a JSON array of exactly 3 next prompts the USER would type to the agent. Write them as the user's own requests or questions (imperative or question addressed to the agent), never as the agent asking the user. Each max 60 characters, specific, and doable with the tools above. Language: ${lang === 'en' ? 'English' : 'Vietnamese'}.
Good examples: ["So sánh BTC với ETH trong 30 ngày", "Tin tức mới nhất về Bitcoin", "Top 10 token tăng mạnh nhất hôm nay"]
Bad examples (never do this): ["Bạn muốn xem khung thời gian nào?", "Bạn có muốn đặt cảnh báo giá không?"]`,
        },
        { role: 'user', content: `User asked: <<<${question.slice(0, 600)}>>>\nAgent answered: <<<${answer.slice(0, 1500)}>>>` },
      ],
    })
    const raw = (r.choices?.[0]?.message?.content || '').trim()
    const arr = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1))
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim() && !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(x)).map((x) => x.trim().slice(0, 90)).slice(0, 3) : []
  } catch {
    return []
  }
}

module.exports = { runAgent, makeTitle, makeSuggestions, getClient }
