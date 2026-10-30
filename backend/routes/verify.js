const { parseId } = require('../lib/safe')
// /api/verify — "Kiểm kèo": fact-check a crypto call, shill message or token.
const { Router } = require('express')
const { profileFor } = require('../lib/memory')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth, reserveCredits, settleCredits } = require('../lib/auth')
const { limit } = require('../lib/ratelimit')
const { runVerify } = require('../lib/verify')

const router = Router()
const COST = 3
const MAX_CHARS = 3000

const shape = (row) => row && { id: row.id, input: row.input, lang: row.lang, score: row.score, verdict: row.verdict, symbol: row.symbol, credits: row.credits, created_at: row.created_at, ...row.result }

// Pricing for the UI.
router.get('/price', (_req, res) => res.json({ credits: COST }))

// History (most recent first).
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await dbQuery(
      `SELECT id, LEFT(input, 160) AS input, score, verdict, symbol, created_at, result->'token' AS token, result->>'headline' AS headline
       FROM mk_checks WHERE address = $1 ORDER BY id DESC LIMIT 40`,
      [req.user.address]
    )
    res.json({ checks: rows })
  } catch (e) {
    console.error('[verify]', e?.message)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(404).json({ error: 'not_found' })
  const { rows } = await dbQuery(`SELECT * FROM mk_checks WHERE id = $1 AND address = $2`, [id, req.user.address])
  if (!rows[0]) return res.status(404).json({ error: 'not_found' })
  res.json({ check: shape(rows[0]) })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(404).json({ error: 'not_found' })
  await dbQuery(`DELETE FROM mk_checks WHERE id = $1 AND address = $2`, [id, req.user.address])
  res.json({ ok: true })
})

// Run a check. Streams progress as server-sent events: step → done | error.
router.post('/', requireAuth, limit('verify', 8, 60_000), async (req, res) => {
  const user = req.user
  const text = String(req.body?.text || '').trim()
  const lang = req.body?.lang === 'en' ? 'en' : 'vi'
  if (text.length < 2) return res.status(400).json({ error: 'empty' })
  if (text.length > MAX_CHARS) return res.status(400).json({ error: 'too_long', max: MAX_CHARS })
  // Hold the price atomically so parallel checks can't overspend; refunded if the check fails.
  const held = await reserveCredits(user.address, COST, COST)
  if (held == null) return res.status(402).json({ error: 'Not enough credits', code: 'NO_CREDITS' })
  let settled = false

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  let closed = false
  res.on('close', () => { if (!res.writableEnded) closed = true })
  const emit = (event, data) => { if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }
  const ping = setInterval(() => emit('ping', {}), 10000)

  try {
    const profile = await profileFor(user.address)
    const result = await runVerify(text, lang, (key) => emit('step', { key }), { profile })
    const { rows } = await dbQuery(
      `INSERT INTO mk_checks (address, input, lang, score, verdict, symbol, result, credits) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user.address, text, lang, result.score, result.verdict, result.token?.symbol || null, JSON.stringify(result), COST]
    )
    // Charge only for completed checks.
    const { balance } = await settleCredits(user.address, held, COST, 'verify', String(rows[0].id))
    settled = true
    emit('done', { check: shape(rows[0]), balance })
  } catch (e) {
    console.error('[verify]', e?.message || e)
    if (!settled) await settleCredits(user.address, held, 0, 'verify').catch(() => {})
    emit('error', { error: 'verify_failed' })
  } finally {
    clearInterval(ping)
    res.end()
  }
})

module.exports = router
