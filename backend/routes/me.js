require('../lib/safe')
const { Router } = require('express')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')
const { getBalance } = require('../lib/arc')
const { MODELS } = require('../lib/config')

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const bal = await (req.user.wallet ? getBalance(req.user.wallet) : Promise.resolve(null)).catch(() => null)
  const stats = await dbQuery(
    `SELECT (SELECT COUNT(*) FROM mk_conversations WHERE address = $1)::int AS conversations,
            (SELECT COUNT(*) FROM mk_checks WHERE address = $1)::int AS checks,
            (SELECT COUNT(*) FROM mk_messages m JOIN mk_conversations c ON c.id = m.conversation_id WHERE c.address = $1 AND m.role = 'user')::int AS messages,
            (SELECT COALESCE(SUM(amount_usdc::numeric), 0) FROM mk_deposits WHERE address = $1)::float AS usdc_deposited`,
    [req.user.address]
  )
  res.json({ user: req.user, arcBalance: bal?.usdc ?? null, stats: stats.rows[0] })
})

router.patch('/', requireAuth, async (req, res) => {
  const language = ['vi', 'en'].includes(req.body?.language) ? req.body.language : req.user.language
  const model = Object.keys(MODELS).includes(req.body?.model) ? req.body.model : req.user.model
  const { rows } = await dbQuery(`UPDATE mk_users SET language = $2, model = $3 WHERE address = $1 RETURNING *`, [req.user.address, language, model])
  res.json({ user: rows[0] })
})

router.get('/history', requireAuth, async (req, res) => {
  const [deposits, ledger] = await Promise.all([
    dbQuery(`SELECT * FROM mk_deposits WHERE address = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.address]),
    dbQuery(`SELECT * FROM mk_ledger WHERE address = $1 ORDER BY created_at DESC LIMIT 100`, [req.user.address]),
  ])
  res.json({ deposits: deposits.rows, ledger: ledger.rows })
})

// Credits spent per day (last 14 days) + split by model
router.get('/usage', requireAuth, async (req, res) => {
  const [daily, byModel] = await Promise.all([
    dbQuery(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, COALESCE(SUM(-l.delta), 0)::int AS credits, COUNT(l.id)::int AS questions
       FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
       LEFT JOIN mk_ledger l ON l.address = $1 AND l.reason = 'chat' AND l.created_at::date = d::date
       GROUP BY d ORDER BY d`,
      [req.user.address]
    ),
    dbQuery(
      `SELECT COALESCE(m.model, 'fast') AS model, COUNT(*)::int AS answers, COALESCE(SUM(m.credits), 0)::int AS credits
       FROM mk_messages m JOIN mk_conversations c ON c.id = m.conversation_id
       WHERE c.address = $1 AND m.role = 'assistant' GROUP BY 1`,
      [req.user.address]
    ),
  ])
  res.json({ daily: daily.rows, byModel: byModel.rows })
})

router.get('/models', (_req, res) => {
  res.json({ models: Object.entries(MODELS).map(([key, m]) => ({ key, label: m.label, base: m.base, tool: m.tool })) })
})

module.exports = router
