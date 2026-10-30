// Long-term user memory, mem0-style: after each chat turn an LLM compares the new
// exchange with what we already know and emits add / update / delete operations.
const { dbQuery } = require('@surf-ai/sdk/db')
const getClient = () => require('./agent').getClient()

const MAX_MEMORIES = 50
const CATEGORIES = ['holdings', 'risk', 'style', 'goal', 'experience', 'preference', 'other']
// Never persist secrets or contact data, whatever the model says.
const SECRET_RE = /(seed|mnemonic|private\s*key|khóa\s*riêng|cụm\s*từ\s*khôi\s*phục|mật\s*khẩu|password|passphrase|\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b|[0-9a-f]{64}|@[a-z0-9-]+\.[a-z]{2,}|\+?\d[\d\s.-]{8,}\d)/i

async function isEnabled(address) {
  const { rows } = await dbQuery(`SELECT enabled FROM mk_memory_prefs WHERE address = $1`, [address]).catch(() => ({ rows: [] }))
  return rows[0] ? rows[0].enabled !== false : true
}

async function list(address) {
  const { rows } = await dbQuery(`SELECT id, content, category, source, created_at, updated_at FROM mk_memories WHERE address = $1 ORDER BY updated_at DESC, id DESC LIMIT $2`, [address, MAX_MEMORIES])
  return rows
}

/** Memories as a compact bullet list for prompts, or '' when off/empty. */
async function profileFor(address) {
  try {
    if (!(await isEnabled(address))) return ''
    const rows = await list(address)
    return rows.map((m) => `- ${m.content}`).join('\n')
  } catch {
    return ''
  }
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200)

/**
 * Learn from one exchange. Returns { added: string[], updated: string[], removed: string[] }.
 */
async function learn(address, userText, assistantText, lang) {
  const empty = { added: [], updated: [], removed: [] }
  if (!userText || userText.length < 8) return empty
  if (!(await isEnabled(address))) return empty
  const existing = await list(address)
  const vi = lang !== 'en'
  let ops = []
  try {
    const r = await getClient().chat.completions.create({
      model: 'gpt-5-mini',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You maintain a crypto assistant's long-term memory about ONE user. Read the latest exchange and decide what durable PERSONAL facts to store.
Store only facts about the user that will still matter in future chats: coins they hold or plan to buy (with rough size if given), risk appetite, time horizon, trading style, experience level, goals, exchanges/wallets/chains they use, how they like answers (short, detailed, no jargon...), explicit "remember that..." requests.
Only store what the USER explicitly stated about themselves. Never infer preferences from the assistant's reply or suggestions, and never guess. One memory per fact, no duplicates of existing memories.
Do NOT store: questions they asked, market data, prices, news, anything the assistant said, one-off moods, or anything already known. NEVER store seed phrases, private keys, passwords, emails, phone numbers or full wallet addresses.
If a fact changed, update ONLY the memory that is directly contradicted, keeping every other detail in it unchanged (e.g. "sold all my ETH" on "Holds 0.3 BTC and 5 ETH" → "Holds 0.3 BTC" plus, if mentioned, a new holding). Delete a memory only when the user explicitly says to forget it or it is fully obsolete. Never delete or alter memories the message does not talk about (a holdings change does not change risk appetite).
Prefer one memory per topic: holdings in one memory, risk appetite in another, etc.
Write each memory as a short third-person sentence in ${vi ? 'Vietnamese (e.g. "Đang giữ khoảng 0,5 BTC, định ôm dài hạn")' : 'English (e.g. "Holds about 0.5 BTC long term")'}.
Return JSON {"ops":[{"op":"add","content":string,"category":"${CATEGORIES.join('|')}"} | {"op":"update","id":number,"content":string} | {"op":"delete","id":number}]}. Max 3 ops. Return {"ops":[]} when nothing is worth remembering (this is the common case).`,
        },
        {
          role: 'user',
          content: `EXISTING MEMORIES:\n${existing.length ? existing.map((m) => `[${m.id}] ${m.content}`).join('\n') : '(none)'}\n\nUSER SAID:\n${userText.slice(0, 2000)}\n\nASSISTANT REPLIED (context only, do not memorize its content):\n${String(assistantText || '').slice(0, 800)}`,
        },
      ],
    })
    ops = JSON.parse(r.choices?.[0]?.message?.content || '{}').ops || []
  } catch {
    return empty
  }
  const ids = new Set(existing.map((m) => m.id))
  const out = { added: [], updated: [], removed: [] }
  for (const o of (Array.isArray(ops) ? ops : []).slice(0, 3)) {
    const content = clean(o?.content)
    if (o?.op === 'add' && content && !SECRET_RE.test(content)) {
      if (existing.some((m) => m.content.toLowerCase() === content.toLowerCase())) continue
      const cat = CATEGORIES.includes(o.category) ? o.category : 'other'
      await dbQuery(`INSERT INTO mk_memories (address, content, category, source) VALUES ($1, $2, $3, 'chat')`, [address, content, cat])
      out.added.push(content)
    } else if (o?.op === 'update' && ids.has(Number(o.id)) && content && !SECRET_RE.test(content)) {
      await dbQuery(`UPDATE mk_memories SET content = $3, updated_at = NOW() WHERE id = $1 AND address = $2`, [Number(o.id), address, content])
      out.updated.push(content)
    } else if (o?.op === 'delete' && ids.has(Number(o.id))) {
      const old = existing.find((m) => m.id === Number(o.id))
      await dbQuery(`DELETE FROM mk_memories WHERE id = $1 AND address = $2`, [Number(o.id), address])
      out.removed.push(old?.content || '')
    }
  }
  // Keep the newest N.
  if (out.added.length) {
    await dbQuery(`DELETE FROM mk_memories WHERE address = $1 AND id NOT IN (SELECT id FROM mk_memories WHERE address = $1 ORDER BY updated_at DESC, id DESC LIMIT ${MAX_MEMORIES})`, [address]).catch(() => {})
  }
  return out
}

module.exports = { isEnabled, list, profileFor, learn, SECRET_RE, MAX_MEMORIES, clean }
