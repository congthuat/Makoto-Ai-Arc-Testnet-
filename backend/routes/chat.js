const { parseId } = require('../lib/safe')
const { Router } = require('express')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth, reserveCredits, settleCredits } = require('../lib/auth')
const { runAgent, makeTitle, makeSuggestions } = require('../lib/agent')
const { profileFor, learn } = require('../lib/memory')
const { MODELS, TOOL_CREDIT, MAX_INPUT_CHARS } = require('../lib/config')

const router = Router()
const MAX_TOOL_CREDITS = 6
// Per-tool price depends on the model (Fast 1, Pro 2). A full call check inside chat
// costs the same 3 credits as on the Verify page, whatever the model.
const toolPrice = (model) => model.tool ?? TOOL_CREDIT
const toolWeight = (model, name) => (name === 'check_call' ? 3 : toolPrice(model))
const toolCap = (model) => MAX_TOOL_CREDITS * toolPrice(model)

// Simple per-wallet rate limit: 8 messages per minute
const hits = new Map()
function rateLimited(address) {
  const now = Date.now()
  const arr = (hits.get(address) || []).filter((t) => now - t < 60_000)
  if (arr.length >= 8) return true
  arr.push(now)
  hits.set(address, arr)
  // Drop idle users now and then so the map can't grow forever.
  if (hits.size > 500) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= 60_000) hits.delete(k)
  return false
}

router.post('/', requireAuth, async (req, res) => {
  const user = req.user
  const text = String(req.body?.message || '').trim()
  const modelKey = MODELS[req.body?.model] ? req.body.model : user.model || 'fast'
  const model = MODELS[modelKey]
  const lang = req.body?.lang === 'en' ? 'en' : 'vi'

  if (!text) return res.status(400).json({ error: 'Message is empty' })
  if (text.length > MAX_INPUT_CHARS) return res.status(400).json({ error: `Message is too long (max ${MAX_INPUT_CHARS} characters)` })
  if (rateLimited(user.address)) return res.status(429).json({ error: 'Too many messages. Wait a minute and try again.' })
  if (user.credits < model.base) return res.status(402).json({ error: 'Not enough credits', code: 'NO_CREDITS' })

  // Hold the worst-case cost up front (atomic), settle the real cost at the end.
  const held = await reserveCredits(user.address, model.base, model.base + toolCap(model))
  if (held == null) return res.status(402).json({ error: 'Not enough credits', code: 'NO_CREDITS' })
  let settled = false
  const settle = async (cost, ref) => {
    if (settled) return null
    const r = await settleCredits(user.address, held, cost, 'chat', ref)
    settled = true // only after it succeeded, so a failed settle is retried and the hold is never lost
    return r
  }
  let convId, isNew, history, userMsg
  try {
  // Conversation
  convId = parseId(req.body?.conversationId)
  isNew = false
  if (convId) {
    const { rows } = await dbQuery(`SELECT id FROM mk_conversations WHERE id = $1 AND address = $2`, [convId, user.address])
    if (!rows[0]) convId = null
  }
  // Edit / regenerate: drop the given user message and everything after it, then answer again.
  const truncateFrom = parseId(req.body?.truncateFrom)
  if (convId && truncateFrom) {
    await dbQuery(`DELETE FROM mk_messages WHERE conversation_id = $1 AND id >= $2`, [convId, truncateFrom])
  }
  if (!convId) {
    const { rows } = await dbQuery(`INSERT INTO mk_conversations (address, title) VALUES ($1, $2) RETURNING id`, [user.address, text.slice(0, 60)])
    convId = rows[0].id
    isNew = true
  }

  history = (
    await dbQuery(`SELECT role, content FROM mk_messages WHERE conversation_id = $1 AND content <> '' ORDER BY id DESC LIMIT 16`, [convId])
  ).rows.reverse().map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }))

  userMsg = (await dbQuery(`INSERT INTO mk_messages (conversation_id, role, content) VALUES ($1, 'user', $2) RETURNING *`, [convId, text])).rows[0]
  } catch (e) {
    await settle(0).catch(() => {})
    throw e
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let closed = false
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) {
      closed = true
      controller.abort()
    }
  })
  // Track what the user actually received so an early disconnect is billed fairly.
  let toolCredits = 0
  let sawOutput = false
  const emit = (event, data) => {
    // Only successful tool calls are billed; failed lookups are free.
    if (event === 'step' && data?.status === 'done') toolCredits += toolWeight(model, data.tool)
    if (event === 'delta' || event === 'widget') sawOutput = true
    if (closed) return
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const ping = setInterval(() => emit('ping', {}), 15000)

  emit('meta', { conversationId: convId, userMessageId: userMsg.id, model: modelKey })
  const titlePromise = isNew ? makeTitle(text, lang) : Promise.resolve(null)

  try {
    const [watchlist, profile] = await Promise.all([
      dbQuery(`SELECT symbol FROM mk_watchlist WHERE address = $1 ORDER BY id`, [user.address]).then((r) => r.rows.map((x) => x.symbol)).catch(() => []),
      profileFor(user.address),
    ])
    const out = await runAgent({ history: [...history, { role: 'user', content: text }], modelKey, address: user.wallet || null, lang, emit, signal: controller.signal, watchlist, profile })
    const { balance, charged: cost } = await settle(model.base + Math.min(toolCredits, toolCap(model)), String(convId))
    const saved = (
      await dbQuery(
        `INSERT INTO mk_messages (conversation_id, role, content, steps, widgets, credits, model) VALUES ($1, 'assistant', $2, $3, $4, $5, $6) RETURNING id`,
        [convId, out.content, JSON.stringify(out.steps), JSON.stringify(out.widgets), cost, modelKey]
      )
    ).rows[0]
    const title = await titlePromise
    if (title) {
      await dbQuery(`UPDATE mk_conversations SET title = $2 WHERE id = $1`, [convId, title])
      emit('title', { conversationId: convId, title })
    }
    await dbQuery(`UPDATE mk_conversations SET updated_at = NOW() WHERE id = $1`, [convId])
    emit('done', { messageId: saved.id, credits: cost, balance })
    // Learning runs even if the user navigated away; the "remembered" note is shown only if still connected.
    const learning = learn(user.address, text, out.content, lang).catch(() => null)
    if (!closed && out.content) {
      const suggestions = await makeSuggestions(text, out.content, lang)
      if (suggestions.length) {
        await dbQuery(`UPDATE mk_messages SET suggestions = $2 WHERE id = $1`, [saved.id, JSON.stringify(suggestions)])
        emit('suggestions', { messageId: saved.id, items: suggestions })
      }
    }
    const mem = await learning
    if (mem && (mem.added.length || mem.updated.length || mem.removed.length)) emit('memory', { messageId: saved.id, ...mem })
  } catch (e) {
    // Aborted after the user already got output or tools ran → bill what was used; otherwise refund all.
    await settle(sawOutput || toolCredits ? model.base + Math.min(toolCredits, toolCap(model)) : 0, String(convId)).catch((err) => console.error('[chat] settle', err?.message))
    if (!closed) emit('error', { message: e?.message?.includes('OPENAI') ? 'AI service is not configured.' : 'Makoto had trouble answering. Please try again.' })
    console.error('[chat]', e?.message)
  } finally {
    clearInterval(ping)
    if (!closed) res.end()
  }
})

module.exports = router
