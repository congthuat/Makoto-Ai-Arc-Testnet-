const { dataApi } = require('@surf-ai/sdk/server')

const quoteCache = new Map() // symbol -> { at, data }
let logoCache = { at: 0, map: {} }

function downsample(arr, n) {
  if (arr.length <= n) return arr
  const step = (arr.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)])
}

async function logos() {
  if (Date.now() - logoCache.at < 30 * 60_000) return logoCache.map
  try {
    const r = await dataApi.market.ranking({ sort_by: 'market_cap', order: 'desc', limit: 100 })
    const map = {}
    for (const d of r?.data || []) if (d?.symbol && !map[d.symbol.toUpperCase()]) map[d.symbol.toUpperCase()] = { image: d.image || null, name: d.name || null }
    logoCache = { at: Date.now(), map }
  } catch {
    logoCache.at = Date.now() - 25 * 60_000 // retry in ~5 min
  }
  return logoCache.map
}

/** Live quote for a token: price, 24h and 7d change, 7d sparkline. Returns null if unknown. */
async function quote(symbol) {
  const sym = String(symbol || '').toUpperCase()
  const hit = quoteCache.get(sym)
  if (hit && Date.now() - hit.at < 120_000) return hit.data
  let r
  try {
    r = await dataApi.market.price({ symbol: sym, time_range: '7d' })
  } catch {
    quoteCache.set(sym, { at: Date.now(), data: null })
    return null
  }
  const pts = (r?.data || []).filter((d) => typeof d?.value === 'number' && typeof d?.timestamp === 'number').sort((a, b) => a.timestamp - b.timestamp)
  if (!pts.length) { quoteCache.set(sym, { at: Date.now(), data: null }); return null }
  const last = pts[pts.length - 1]
  const dayAgo = [...pts].reverse().find((p) => p.timestamp <= last.timestamp - 86400) || pts[0]
  const meta = (await logos())[sym] || {}
  const data = {
    symbol: sym,
    name: meta.name || sym,
    image: meta.image || null,
    price: last.value,
    change_24h: dayAgo.value ? ((last.value - dayAgo.value) / dayAgo.value) * 100 : null,
    change_7d: typeof r?.summary?.change_pct === 'number' ? r.summary.change_pct : null,
    spark: downsample(pts, 42).map((p) => p.value),
    updated_at: last.timestamp,
  }
  quoteCache.set(sym, { at: Date.now(), data })
  return data
}

module.exports = { quote, logos }
