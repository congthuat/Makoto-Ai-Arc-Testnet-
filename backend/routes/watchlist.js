require('../lib/safe')
const { Router } = require('express')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')
const { quote } = require('../lib/market')

const router = Router()
const DEFAULTS = ['BTC', 'ETH', 'SOL']
const MAX = 12

async function getSymbols(user) {
  if (!user.watchlist_seeded) {
    const { rows } = await dbQuery(`UPDATE mk_users SET watchlist_seeded = true WHERE address = $1 AND COALESCE(watchlist_seeded, false) = false RETURNING address`, [user.address])
    if (rows.length) for (const s of DEFAULTS) await dbQuery(`INSERT INTO mk_watchlist (address, symbol) VALUES ($1, $2)`, [user.address, s])
  }
  const { rows } = await dbQuery(`SELECT symbol FROM mk_watchlist WHERE address = $1 ORDER BY id ASC`, [user.address])
  return [...new Set(rows.map((r) => r.symbol))]
}

async function withQuotes(symbols) {
  return Promise.all(symbols.map(async (s) => (await quote(s).catch(() => null)) || { symbol: s, name: s, price: null, change_24h: null, change_7d: null, spark: [] }))
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const symbols = await getSymbols(req.user)
    res.json({ items: await withQuotes(symbols) })
  } catch (e) {
    console.error('[route]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  const sym = String(req.body?.symbol || '').trim().toUpperCase().replace(/^\$/, '')
  if (!/^[A-Z0-9]{1,12}$/.test(sym)) return res.status(400).json({ error: 'invalid_symbol' })
  const symbols = await getSymbols(req.user)
  if (symbols.includes(sym)) return res.json({ ok: true, item: await quote(sym) })
  if (symbols.length >= MAX) return res.status(400).json({ error: 'limit' })
  const q = await quote(sym)
  if (!q) return res.status(404).json({ error: 'not_found' })
  await dbQuery(`INSERT INTO mk_watchlist (address, symbol) VALUES ($1, $2)`, [req.user.address, sym])
  res.json({ ok: true, item: q })
})

router.delete('/:symbol', requireAuth, async (req, res) => {
  await dbQuery(`DELETE FROM mk_watchlist WHERE address = $1 AND symbol = $2`, [req.user.address, String(req.params.symbol).toUpperCase()])
  res.json({ ok: true })
})

module.exports = router
module.exports.getSymbols = getSymbols
module.exports.withQuotes = withQuotes
