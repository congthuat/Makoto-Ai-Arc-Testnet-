require('../lib/safe')
const { Router } = require('express')
const { dataApi } = require('@surf-ai/sdk/server')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')
const { getClient } = require('../lib/agent')
const { getSymbols, withQuotes } = require('./watchlist')

const router = Router()
const pending = new Map() // `${address}|${day}` -> Promise

// Accept the client's local date, but only within ±2 days of server time (time zones span UTC-12…UTC+14).
function validDay(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return null
  const diff = Math.abs(new Date(d + 'T12:00:00Z').getTime() - Date.now())
  return diff <= 2 * 86400_000 ? d : null
}

const r2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : null)

async function gather(user) {
  const symbols = (await getSymbols(user)).slice(0, 8)
  const from = Math.floor(Date.now() / 1000) - 8 * 86400
  const [coins, fg, gainers, news] = await Promise.all([
    withQuotes(symbols),
    dataApi.market.fear_greed({ from: String(from) }).then((r) => (r?.data || []).sort((a, b) => a.timestamp - b.timestamp)).catch(() => []),
    dataApi.market.ranking({ sort_by: 'change_24h', order: 'desc', limit: 6 }).then((r) => r?.data || []).catch(() => []),
    dataApi.news.feed({ sort_by: 'recency', limit: 10 }).then((r) => r?.data || []).catch(() => []),
  ])
  // Coin-specific headlines first (user's top 3), then general market news.
  const quoted = coins.slice(0, 3)
  const specific = (await Promise.all(quoted.map((c) => dataApi.search.news({ q: c.name || c.symbol, limit: 3 }).then((r) => r?.data || []).catch(() => [])))).flat()
  const seen = new Set()
  const allNews = [...specific, ...news].filter((n) => {
    const k = (n?.title || '').toLowerCase().slice(0, 60)
    if (!k || seen.has(k) || /predict|rebounds|o\/u|nba|nfl/i.test(n.title)) return false
    seen.add(k)
    return true
  })
  return {
    coins: coins.map((c) => ({ symbol: c.symbol, name: c.name, image: c.image, price: c.price, change_24h: r2(c.change_24h), change_7d: r2(c.change_7d) })),
    fear_greed: fg.length ? { value: fg[fg.length - 1]?.value ?? null, classification: fg[fg.length - 1]?.classification ?? null, week_ago: fg[0]?.value ?? null } : null,
    gainers: gainers.filter((g) => g?.symbol).map((g) => ({ symbol: g.symbol, name: g.name, image: g.image, change_24h: r2(g.change_24h_pct), price: g.price_usd })),
    news: allNews.slice(0, 10).map((n) => ({ title: n.title, summary: (n.summary || '').slice(0, 300), source: n.source || null, url: n.url || null, project: n.project_name || null })),
  }
}

async function write(data, lang) {
  const vi = lang !== 'en'
  const r = await getClient().chat.completions.create({
    model: 'gpt-5-mini',
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are Makoto, writing a short morning crypto briefing for one user. Use ONLY the data provided; never invent numbers or events. Language: ${vi ? 'Vietnamese' : 'English'}. Tone: calm, clear, like a smart friend. Not financial advice.
Return JSON: {"headline": string (max 70 chars, the single most important takeaway), "mood": "bullish"|"bearish"|"neutral", "summary": string (2 sentences, max 260 chars), "bullets": string[] (3-4 key points, each max 140 chars, may use **bold** for a number; the UI already shows price cards, so focus on context, news, sentiment and what changed rather than repeating prices), "coins": [{"symbol": string, "note": string (max 90 chars, one line on that coin from the user's watchlist)}], "watch": string[] (2 short things worth watching today, max 90 chars each), "top_news": number[] (indexes into the news array of the 3 most market-moving items; skip evergreen guides, games and how-to articles)}`,
      },
      { role: 'user', content: JSON.stringify(data) },
    ],
  })
  const raw = r.choices?.[0]?.message?.content || '{}'
  const j = JSON.parse(raw)
  const str = (x, n) => (typeof x === 'string' ? x.trim().slice(0, n) : '')
  return {
    headline: str(j.headline, 120),
    mood: ['bullish', 'bearish', 'neutral'].includes(j.mood) ? j.mood : 'neutral',
    summary: str(j.summary, 400),
    bullets: (Array.isArray(j.bullets) ? j.bullets : []).map((b) => str(b, 220)).filter(Boolean).slice(0, 4),
    coins: (Array.isArray(j.coins) ? j.coins : []).filter((c) => c?.symbol).map((c) => ({ symbol: str(c.symbol, 12).toUpperCase(), note: str(c.note, 140) })).slice(0, 8),
    watch: (Array.isArray(j.watch) ? j.watch : []).map((b) => str(b, 140)).filter(Boolean).slice(0, 3),
    top_news: (Array.isArray(j.top_news) ? j.top_news : []).filter((i) => Number.isInteger(i) && i >= 0 && i < (data.news?.length || 0)).slice(0, 3),
  }
}

async function generate(user, day, lang) {
  const data = await gather(user)
  const text = await write(data, lang)
  const { top_news, ...rest } = text
  const picked = top_news.length ? [...new Set(top_news)].map((i) => data.news[i]) : data.news.slice(0, 3)
  const content = { ...rest, data: { coins: data.coins, fear_greed: data.fear_greed, gainers: data.gainers.slice(0, 4), news: picked.filter(Boolean) }, generated_at: new Date().toISOString() }
  const { rows } = await dbQuery(`INSERT INTO mk_briefings (address, day, lang, content) VALUES ($1, $2, $3, $4) RETURNING *`, [user.address, day, lang, JSON.stringify(content)])
  return rows[0]
}

async function latest(address, day, lang) {
  const { rows } = lang
    ? await dbQuery(`SELECT * FROM mk_briefings WHERE address = $1 AND day = $2 AND lang = $3 ORDER BY id DESC LIMIT 1`, [address, day, lang])
    : await dbQuery(`SELECT * FROM mk_briefings WHERE address = $1 AND day = $2 ORDER BY id DESC LIMIT 1`, [address, day])
  return rows[0] || null
}

const shape = (row) => row && { id: row.id, day: row.day, lang: row.lang, created_at: row.created_at, ...row.content }

router.get('/', requireAuth, async (req, res) => {
  const day = validDay(req.query.day)
  if (!day) return res.status(400).json({ error: 'invalid_day' })
  try {
    const lang = ['vi', 'en'].includes(req.query.lang) ? req.query.lang : null
    res.json({ briefing: shape(await latest(req.user.address, day, lang)) })
  } catch (e) {
    console.error('[route]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

// Generate today's briefing (free, once per day; returns the existing one if already made).
router.post('/', requireAuth, require('../lib/ratelimit').limit('briefing', 6, 60_000), async (req, res) => {
  const day = validDay(req.body?.day || req.query.day)
  if (!day) return res.status(400).json({ error: 'invalid_day' })
  const lang = req.body?.lang === 'en' ? 'en' : req.body?.lang === 'vi' ? 'vi' : req.user.language || 'vi'
  const key = `${req.user.address}|${day}|${lang}`
  try {
    const existing = await latest(req.user.address, day, lang)
    if (existing) return res.json({ briefing: shape(existing) })
    if (!pending.has(key)) pending.set(key, generate(req.user, day, lang).finally(() => pending.delete(key)))
    res.json({ briefing: shape(await pending.get(key)) })
  } catch (e) {
    console.error('[briefing]', e)
    res.status(502).json({ error: 'briefing_failed' })
  }
})

module.exports = router
