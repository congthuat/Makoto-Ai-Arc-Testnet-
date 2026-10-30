// "Kiểm kèo" — fact-check a crypto call / shill / token against live data.
const { isPublicHttpUrl } = require('./safe')
const { dataApi } = require('@surf-ai/sdk/server')
// Lazy: agent.js → tools.js → verify.js would otherwise be a require cycle.
const getClient = () => require('./agent').getClient()
const { securityScan } = require('./goplus')

const EVM_RE = /0x[a-fA-F0-9]{40}/g
const SOL_RE = /(?<![A-Za-z0-9])[1-9A-HJ-NP-Za-km-z]{32,44}(?![A-Za-z0-9])/g
const URL_RE = /https?:\/\/[^\s)<>"']+/g
const HANDLE_RE = /(?:^|[^\w@/.])@([A-Za-z0-9_]{2,15})\b(?!\.[a-z])/g
const XURL_RE = /(?:x|twitter)\.com\/([A-Za-z0-9_]{2,15})(?=[/?#\s]|$)/gi
const X_RESERVED = new Set(['i', 'home', 'search', 'intent', 'share', 'hashtag', 'explore', 'settings', 'messages', 'notifications', 'compose', 'login', 'signup', 'tos', 'privacy'])
// Exchanges a call may claim; `markets` = we can read live pairs for it.
const EXCHANGES = [
  { re: /binance/i, id: 'binance', name: 'Binance', markets: true },
  { re: /\bokx\b/i, id: 'okx', name: 'OKX', markets: true },
  { re: /bybit/i, id: 'bybit', name: 'Bybit', markets: true },
  { re: /upbit/i, id: 'upbit', name: 'Upbit', markets: true },
  { re: /coinbase/i, id: 'coinbase', name: 'Coinbase', markets: true },
  { re: /bitget/i, id: 'bitget', name: 'Bitget', markets: true },
  { re: /kucoin/i, id: 'kucoin', name: 'KuCoin', markets: true },
  { re: /\bgate(?:\.io)?\b/i, id: 'gate', name: 'Gate', markets: true },
  { re: /kraken/i, id: 'kraken', name: 'Kraken', markets: true },
  { re: /\bmexc\b/i, id: 'mexc', name: 'MEXC', markets: true },
  { re: /\b(?:htx|huobi)\b/i, id: 'htx', name: 'HTX', markets: true },
  { re: /bithumb/i, id: 'bithumb', name: 'Bithumb', markets: true },
  { re: /hyperliquid/i, id: 'hyperliquid', name: 'Hyperliquid', markets: true },
  { re: /robinhood/i, id: 'robinhood', name: 'Robinhood', markets: false },
]
const HOLDER_CHAINS = ['ethereum', 'solana', 'bsc', 'base', 'arbitrum', 'polygon', 'avalanche', 'optimism']
const STATS_CHAINS = ['ethereum', 'base', 'bsc', 'arbitrum']

const clip = (s, n) => (typeof s === 'string' ? (s.length > n ? s.slice(0, n) + '…' : s) : s)
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100)

function withTimeout(p, ms = 15000) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}
const safe = (p, ms) => withTimeout(p, ms).catch(() => null)

async function chatJson(model, system, user, effort = 'low') {
  const r = await getClient().chat.completions.create({
    model,
    reasoning_effort: effort,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  })
  try { return JSON.parse(r.choices?.[0]?.message?.content || '{}') } catch { return {} }
}

/* ---------- 1. Understand the message ---------- */

async function extract(text, lang) {
  const evm = [...new Set((text.match(EVM_RE) || []).map((a) => a.toLowerCase()))]
  const sol = [...new Set((text.replace(EVM_RE, ' ').match(SOL_RE) || []).filter((s) => /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s)))]
  const urls = [...new Set(text.match(URL_RE) || [])].slice(0, 3)
  const j = await chatJson(
    'gpt-5-mini',
    `You read crypto messages (often Vietnamese Telegram/Zalo/Facebook "kèo" calls) and extract structure. Return JSON:
{"tokens":[{"symbol":string|null,"name":string|null}] (the token(s) being promoted, main one first; [] if none; symbol without $),
"claims":[string] (up to 6 concrete, checkable claims in the message — not the attribution/source itself, e.g. "sắp list Binance", "x100", "đã được Binance Labs đầu tư", "đội ngũ doxx", "khóa thanh khoản", "giá sẽ lên 1$". Keep the original language, short),
"tactics":[string] (pressure/manipulation tactics present: urgency/FOMO, guaranteed profit, unrealistic multipliers, "inbox admin", asks to send money/seed phrase, fake partnership, paid VIP group, presale/whitelist payment, celebrity endorsement... Short labels (2-5 words) written in ${lang === 'en' ? 'English' : 'Vietnamese'}; [] if none),
"kols":[string] (X/Twitter handles of people the call is attributed to or quotes, without @; [] if none),
"asks_money":boolean (asks to send funds, pay for VIP, join presale by transferring, or share keys),
"kind":"call"|"token"|"question"}`,
    clip(text, 3500),
    'minimal'
  ).catch(() => ({}))
  const tokens = (Array.isArray(j.tokens) ? j.tokens : [])
    .map((t) => ({ symbol: typeof t?.symbol === 'string' ? t.symbol.replace(/^\$/, '').trim().toUpperCase().slice(0, 20) || null : null, name: typeof t?.name === 'string' ? t.name.trim().slice(0, 60) || null : null }))
    .filter((t) => t.symbol || t.name)
    .slice(0, 3)
  // Fallback: $TICKER in the text.
  if (!tokens.length) {
    const m = text.match(/\$([A-Za-z][A-Za-z0-9]{1,14})\b/)
    if (m) tokens.push({ symbol: m[1].toUpperCase(), name: null })
    else if (/^[A-Za-z][A-Za-z0-9]{1,14}$/.test(text.trim())) tokens.push({ symbol: text.trim().toUpperCase(), name: null })
  }
  const kols = [...new Set([
    ...[...text.matchAll(HANDLE_RE)].map((m) => m[1]),
    ...[...text.matchAll(XURL_RE)].map((m) => m[1]),
    ...(Array.isArray(j.kols) ? j.kols : []).filter((h) => typeof h === 'string').map((h) => h.replace(/^@/, '').trim()),
  ].filter((h) => /^[A-Za-z0-9_]{2,15}$/.test(h) && !X_RESERVED.has(h.toLowerCase())).map((h) => h.toLowerCase()))].slice(0, 2)
  const exchanges = EXCHANGES.filter((e) => e.re.test(text)).map((e) => ({ id: e.id, name: e.name })).slice(0, 4)
  return {
    tokens,
    evm,
    sol,
    urls,
    kols,
    exchanges,
    claims: (Array.isArray(j.claims) ? j.claims : []).filter((c) => typeof c === 'string' && c.trim()).map((c) => clip(c.trim(), 160)).slice(0, 6),
    tactics: (Array.isArray(j.tactics) ? j.tactics : []).filter((c) => typeof c === 'string' && c.trim()).map((c) => clip(c.trim(), 80)).slice(0, 8),
    asks_money: j.asks_money === true,
    kind: ['call', 'token', 'question'].includes(j.kind) ? j.kind : 'call',
  }
}

/* ---------- 2. Gather evidence ---------- */

async function findProject(tokens, address) {
  const tries = []
  for (const t of tokens) {
    if (t.name) tries.push(t.name)
    if (t.symbol) tries.push(t.symbol)
  }
  for (const q of [...new Set(tries)].slice(0, 3)) {
    const r = await safe(dataApi.project.detail({ q }), 12000)
    const d = r?.data
    if (!d?.overview?.name) continue
    const sym = (d.overview.token_symbol || d.token_info?.symbol || '').toUpperCase()
    const wanted = tokens.find((t) => t.symbol)?.symbol
    const contracts = d.contracts?.contracts || []
    const addrMatch = address && contracts.some((c) => String(c.address).toLowerCase() === address.toLowerCase())
    // Avoid fuzzy matches to a different project: ticker must match unless the address matches.
    if (address && !addrMatch) continue
    if (!address && wanted && sym && sym !== wanted) continue
    return d
  }
  return null
}

function holderStats(rows) {
  const list = (rows || []).filter((h) => num(h?.percentage) != null).map((h) => ({ ...h, entity_name: h.entity_name || h.label?.entity_name || null, entity_type: h.entity_type || h.label?.entity_type || null }))
  if (!list.length) return null
  const labeled = list.some((h) => h.entity_type)
  const burn = (a) => /^0x0{40}$|^0x0{36}dead$|dead$/i.test(String(a || ''))
  const isInfra = (h) => /cex|dex|exchange|bridge|contract|protocol|defi|pool|lending|staking|vault|burn|amm|router|treasury|dao/i.test(`${h.entity_type || ''} ${h.entity_name || ''}`) || burn(h.address)
  const top10 = list.slice(0, 10).reduce((s, h) => s + num(h.percentage), 0)
  const wallets = list.filter((h) => !isInfra(h))
  const top10Wallets = wallets.slice(0, 10).reduce((s, h) => s + num(h.percentage), 0)
  const biggest = labeled ? wallets[0] : null
  return {
    top10_pct: r2(top10),
    // Without labels we can't tell exchanges from whales — don't guess.
    top10_private_pct: labeled ? r2(top10Wallets) : null,
    labels_available: labeled,
    largest_private_pct: biggest ? r2(num(biggest.percentage)) : null,
    top: list.slice(0, 8).map((h) => ({ address: h.address, pct: r2(num(h.percentage)), label: h.entity_name || null, type: h.entity_type || null })),
  }
}

async function unlockStats(projectId, price, volume24h) {
  const now = Math.floor(Date.now() / 1000)
  const r = await safe(dataApi.token.tokenomics({ id: projectId, from: String(now - 40 * 86400), to: String(now + 90 * 86400) }), 12000)
  const rows = (r?.data || []).filter((d) => num(d?.cumulative_unlocked_amount) != null && num(d?.timestamp) != null).sort((a, b) => a.timestamp - b.timestamp)
  if (rows.length < 2) return null
  const supply = num(rows[rows.length - 1].total_supply) || num(rows[0].total_supply)
  if (!supply) return null
  // Points are a daily cumulative series: unlocks = day-over-day increases.
  const at = (ts) => rows.reduce((p, d) => (d.timestamp <= ts ? d : p), rows[0])
  const cum = (ts) => num(at(ts).cumulative_unlocked_amount)
  const nowAmt = cum(now)
  const nowPct = (nowAmt / supply) * 100
  const a30 = cum(now + 30 * 86400) - nowAmt
  const a90 = num(rows[rows.length - 1].cumulative_unlocked_amount) - nowAmt
  const past30 = nowAmt - cum(now - 30 * 86400)
  // Bad source data (e.g. >100% unlocked, cumulative going down) — better to show nothing.
  if (nowPct < 0 || nowPct > 100.5 || a30 < -supply * 0.005 || a90 < -supply * 0.005) return null
  const jumps = []
  for (let i = 1; i < rows.length; i++) {
    const d = num(rows[i].cumulative_unlocked_amount) - num(rows[i - 1].cumulative_unlocked_amount)
    if (rows[i].timestamp > now && d > 0) jumps.push({ ts: rows[i].timestamp, amount: d })
  }
  const cliffs = jumps.filter((j) => j.amount / supply >= 0.003)
  const big = [...cliffs].sort((x, y) => y.amount - x.amount)[0]
  const val = (amt) => (price ? r2(amt * price) : null)
  const pct30 = (Math.max(0, a30) / supply) * 100
  const value30 = val(Math.max(0, a30))
  const volRatio = value30 != null && volume24h ? r2(value30 / volume24h) : null
  const pressure = pct30 >= 2 || (volRatio != null && volRatio >= 1.5) ? 'high' : pct30 >= 0.5 || (volRatio != null && volRatio >= 0.3) ? 'medium' : 'low'
  const cliffOut = (j) => (j ? { date: new Date(j.ts * 1000).toISOString().slice(0, 10), pct_of_supply: r2((j.amount / supply) * 100), value_usd: val(j.amount) } : null)
  return {
    unlocked_now_pct: r2(nowPct),
    unlock_next_30d_pct: r2(pct30),
    unlock_next_90d_pct: r2((Math.max(0, a90) / supply) * 100),
    unlock_next_30d_value_usd: value30,
    unlocked_past_30d_pct: r2((Math.max(0, past30) / supply) * 100),
    next_30d_value_vs_daily_volume: volRatio,
    next_cliff: cliffOut(cliffs[0]),
    biggest_cliff_90d: cliffOut(big),
    sell_pressure: pressure,
    allocations: (Array.isArray(rows[rows.length - 1]?.allocations) ? rows[rows.length - 1].allocations : []).slice(0, 6).map((a) => ({ name: a.name, amount: num(a.amount) })),
  }
}

/* KOL: does the person behind the call actually hold what they shill? */
async function kolStats(handle, symbol) {
  const r = await withTimeout(dataApi.get('smart-money/kol/detail', { handle }), 12000).catch((e) => (/404|not found/i.test(String(e?.message)) ? { missing: true } : null))
  if (!r) return null
  const d = r.data
  if (r.missing || !d) return { handle, tracked: false }
  const ca = d.call_audit || {}
  const tok = symbol && Array.isArray(ca.tokens) ? ca.tokens.find((t) => String(t.symbol).toUpperCase() === symbol) : null
  const spot = d.markets?.spot || {}
  return {
    handle: d.handle || handle,
    name: d.name || null,
    avatar: d.avatar || null,
    verified: !!d.verified,
    followers: num(d.followers_count),
    tracked: true,
    calls_audited: num(ca.n_tokens),
    consistency_pct: num(ca.consistency_rate) != null ? Math.round(num(ca.consistency_rate) * 100) : null,
    n_holding: num(ca.n_holding), n_bought_after: num(ca.n_bought_after), n_no_position: num(ca.n_no_position), n_sold_before: num(ca.n_sold_before), n_opposite: num(ca.n_opposite),
    pnl_90d_usd: num(d.pnl_90d_usd),
    win_rate_pct: num(spot.win_rate) != null ? Math.round(num(spot.win_rate) * 100) : null,
    flags: Array.isArray(d.flags) ? d.flags.filter((f) => typeof f === 'string').slice(0, 4) : [],
    token: tok ? { symbol, verdict: tok.verdict || null, direction: tok.direction || null, n_calls: num(tok.n_calls), last_call: tok.last_call_day ? new Date(tok.last_call_day * 1000).toISOString().slice(0, 10) : null } : null,
  }
}

/* Every tracked KOL tweeting about this token: do they hold it? */
const CROWD_KEYS = ['holding', 'bought_after', 'sold_before', 'opposite_position', 'no_position']
async function kolCrowd(symbol) {
  const r = await safe(dataApi.get('smart-money/token/tweets', { symbol, limit: 100 }), 12000)
  const rows = (r?.data || []).filter((t) => CROWD_KEYS.includes(t?.verdict))
  if (!rows.length) return null
  return { symbol, total: rows.length, counts: count(rows), kols: new Set(rows.map((t) => t.handle)).size, samples: sample(rows), rows }
  function count(list) { const c = Object.fromEntries(CROWD_KEYS.map((k) => [k, 0])); for (const t of list) c[t.verdict]++; return c }
  function sample(list) {
    const seen = new Set()
    return [...list].sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0)).filter((t) => !seen.has(t.handle) && seen.add(t.handle)).slice(0, 5).map((t) => ({ handle: t.handle, verdict: t.verdict, direction: t.direction || null, posted_at: t.posted_at || null, url: t.url || null }))
  }
}

/* Listing: what the exchange actually lists today + recent official listing events. */
async function listingCheck(symbol, claimed) {
  const from = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)
  const [ev, ...mk] = await Promise.all([
    safe(dataApi.get('market/listing', { symbol, from, limit: 60 }), 12000),
    ...claimed.map((c) => (EXCHANGES.find((e) => e.id === c.id)?.markets ? safe(dataApi.exchange.markets({ exchange: c.id, base: symbol, limit: 60 }), 10000) : Promise.resolve(null))),
  ])
  const seen = new Set()
  const events = (ev?.data || [])
    .filter((e) => String(e.base_symbol).toUpperCase() === symbol && e.event_type === 'LISTING')
    .sort((a, b) => (b.effective_at || 0) - (a.effective_at || 0))
    .filter((e) => { const k = `${e.exchange_name}|${e.product}`; return !seen.has(k) && seen.add(k) })
    .map((e) => ({ exchange: e.exchange_name, product: e.product, pair: e.trading_pair, date: e.effective_at ? new Date(e.effective_at * 1000).toISOString().slice(0, 10) : null, upcoming: (e.effective_at || 0) * 1000 > Date.now() }))
  const out = claimed.map((c, i) => {
    const evs = events.filter((e) => String(e.exchange).toLowerCase().includes(c.id === 'htx' ? 'htx' : c.id))
    const pairs = ((mk[i]?.data) || []).filter((m) => String(m.base).toUpperCase() === symbol && m.active !== false)
    const spot = pairs.filter((m) => m.type === 'spot').map((m) => m.pair)
    const perp = pairs.filter((m) => m.type !== 'spot').map((m) => m.pair)
    const canRead = mk[i] != null
    const status = spot.length || evs.some((e) => e.product === 'SPOT' && !e.upcoming) ? 'listed_spot'
      : evs.some((e) => e.upcoming) ? 'announced'
      : perp.length || evs.some((e) => e.product === 'PERP') ? 'perp_only'
      : canRead ? 'not_listed' : 'unknown'
    return { exchange: c.name, status, spot_pairs: spot.slice(0, 4), perp_pairs: perp.slice(0, 2), last_event: evs[0] || null }
  })
  return { symbol, claimed: out, recent_events: events.slice(0, 8) }
}

async function dexStats(address, chains) {
  const results = await Promise.all(
    chains.map(async (chain) => {
      const r = await safe(dataApi.get('dex/token/price', { address, chain, interval: '1d', time_range: 'max' }), 15000)
      const bars = (r?.data || []).filter((b) => num(b?.close) != null).sort((a, b) => a.timestamp - b.timestamp)
      return bars.length ? { chain, bars } : null
    })
  )
  const hit = results.filter(Boolean).sort((a, b) => b.bars.length - a.bars.length)[0]
  if (!hit) return null
  const { bars, chain } = hit
  const last = bars[bars.length - 1]
  const peak = bars.reduce((m, b) => Math.max(m, num(b.high) ?? num(b.close)), 0)
  const recent = bars.slice(-7)
  const vol7 = recent.reduce((s, b) => s + (num(b.volume_usd) || 0), 0) / Math.max(recent.length, 1)
  const first = bars[0]
  const d7 = bars.length > 7 ? bars[bars.length - 8] : first
  return {
    chain,
    price: num(last.close),
    first_trade_at: first.timestamp,
    age_days: Math.max(0, Math.round((Date.now() / 1000 - first.timestamp) / 86400)),
    from_peak_pct: peak ? r2(((num(last.close) - peak) / peak) * 100) : null,
    change_7d_pct: num(d7.close) ? r2(((num(last.close) - num(d7.close)) / num(d7.close)) * 100) : null,
    avg_volume_7d: r2(vol7),
    spark: bars.slice(-60).map((b) => [b.timestamp, num(b.close)]),
  }
}

async function gather(ex) {
  const address = ex.evm[0] || ex.sol[0] || null
  // Raw contract address: ask the label service what token it is.
  let addrLabel = null
  if (address) {
    const l = (await safe(dataApi.wallet.labels_batch({ addresses: address }), 8000))?.data?.[0]
    if (l?.entity_name || l?.labels?.length) {
      const lab = l.labels?.[0]?.label || ''
      const sym = (lab.match(/\(([A-Za-z0-9]{1,15})\)/) || [])[1]
      addrLabel = { name: l.entity_name || lab.replace(/\s*\(.*\)$/, '') || null, symbol: sym ? sym.toUpperCase() : null, type: l.entity_type || null }
      if (!ex.tokens.some((t) => t.symbol && t.symbol === addrLabel.symbol)) ex.tokens.unshift({ symbol: addrLabel.symbol, name: addrLabel.name })
    }
  }
  const project = ex.tokens.length || address ? await findProject(ex.tokens, address) : null

  // Which contract to inspect on-chain.
  let contract = null
  if (address) contract = { address, chain: ex.evm[0] ? null : 'solana' }
  else if (project) {
    const cs = (project.contracts?.contracts || []).filter((c) => HOLDER_CHAINS.includes(c.chain))
    cs.sort((a, b) => HOLDER_CHAINS.indexOf(a.chain) - HOLDER_CHAINS.indexOf(b.chain))
    if (cs[0]) contract = { address: cs[0].address, chain: cs[0].chain }
  }
  if (contract && !contract.chain && project) {
    const c = (project.contracts?.contracts || []).find((x) => String(x.address).toLowerCase() === contract.address.toLowerCase() && HOLDER_CHAINS.includes(x.chain))
    if (c) contract.chain = c.chain
  }

  const name = project?.overview?.name || ex.tokens[0]?.name || ex.tokens[0]?.symbol
  const pageUrl = ex.urls.find((u) => isPublicHttpUrl(u) && !/t\.me|telegram|zalo|facebook\.com|fb\.com|x\.com|twitter\.com|youtube|tiktok/i.test(u))

  const sym = (project?.overview?.token_symbol || project?.token_info?.symbol || ex.tokens[0]?.symbol || addrLabel?.symbol || '').toUpperCase() || null
  const ti0 = project?.token_info || {}
  const [dex, unlocks, news, page, kols, crowd, listing] = await Promise.all([
    // DEX trading history: detects chain for raw addresses, gives age & drawdown.
    // Every source is optional: one odd upstream response must not sink the whole check.
    contract ? dexStats(contract.address, contract.chain ? [contract.chain] : ['ethereum', 'bsc', 'base', 'arbitrum']).catch(() => null) : null,
    project?.overview?.id ? unlockStats(project.overview.id, num(ti0.price_usd), num(ti0.volume_24h)).catch(() => null) : null,
    name ? safe(dataApi.search.news({ q: name, limit: 6 }), 10000).then((r) => (r?.data || []).map((n) => ({ title: n.title, source: n.source || null, url: n.url || null, published_at: n.published_at || null, summary: clip(n.summary, 220) }))) : [],
    pageUrl ? safe(dataApi.web.fetch({ url: pageUrl, timeout: 12000 }), 15000).then((r) => (r?.data ? { url: pageUrl, title: r.data.title || null, content: clip(r.data.content || '', 2500) } : null)) : null,
    Promise.all((ex.kols || []).map((h) => kolStats(h, sym).catch(() => null))),
    sym ? kolCrowd(sym).catch(() => null) : null,
    sym ? listingCheck(sym, ex.exchanges || []).catch(() => null) : null,
  ])
  // KOL cited in the message: fall back to their tweets in the crowd data for this token.
  const kolList = (kols || []).filter(Boolean).map((k) => {
    if (!k.tracked || k.token || !crowd?.rows) return k
    const mine = crowd.rows.filter((t) => String(t.handle).toLowerCase() === String(k.handle).toLowerCase()).sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0))[0]
    return mine ? { ...k, token: { symbol: sym, verdict: mine.verdict, direction: mine.direction || null, n_calls: null, last_call: mine.posted_at ? new Date(mine.posted_at * 1000).toISOString().slice(0, 10) : null } } : k
  })
  const kolCrowdOut = crowd ? (({ rows, ...rest }) => rest)(crowd) : null
  if (contract && !contract.chain && dex?.chain) contract.chain = dex.chain

  const [holders, transfers, security] = await Promise.all([
    contract?.chain ? safe(dataApi.token.holders({ address: contract.address, chain: contract.chain, limit: 25, include: 'labels' }), 15000).then(async (r) => {
      const rows = r?.data || []
      // Fill in missing labels so exchange / contract wallets aren't counted as whales.
      const missing = rows.slice(0, 15).filter((h) => !h.entity_type && !h.label?.entity_type).map((h) => h.address)
      if (missing.length) {
        const lb = (await safe(dataApi.wallet.labels_batch({ addresses: missing.join(',') }), 10000))?.data || []
        const map = new Map(lb.map((x) => [String(x.address).toLowerCase(), x]))
        for (const h of rows) {
          const x = map.get(String(h.address).toLowerCase())
          if (x && (x.entity_type || x.entity_name)) { h.entity_type = x.entity_type || 'labeled'; h.entity_name = x.entity_name || x.labels?.[0]?.label || null }
        }
      }
      return holderStats(rows)
    }) : null,
    contract?.chain && STATS_CHAINS.includes(contract.chain) && /^0x/.test(contract.address) ? safe(dataApi.get('token/transfer-stats', { address: contract.address, chain: contract.chain, time_range: '7d' }), 15000).then((r) => (r?.data ? { transfers_7d: num(r.data.total_transfers), unique_senders_7d: num(r.data.unique_senders), unique_receivers_7d: num(r.data.unique_receivers), volume_usd_7d: r2(num(r.data.total_amount_usd)) } : null)) : null,
    // Contract "trap" scan: honeypot, hidden taxes, owner powers, liquidity lock.
    contract ? safe(securityScan(contract.address, contract.chain), 12000) : null,
  ])
  if (contract && !contract.chain && security?.chain) contract.chain = security.chain

  const ti = project?.token_info || {}
  const ov = project?.overview || {}
  const rounds = project?.funding?.rounds || []
  const funding = rounds.length
    ? {
        rounds: rounds.length,
        total_usd: rounds.reduce((s, r) => s + (num(r.amount) || 0), 0) || null,
        investors: [...new Set(rounds.flatMap((r) => (r.investors || []).filter((i) => i.is_lead || rounds.length === 1).map((i) => i.name)))].slice(0, 6),
        all_investors: [...new Set(rounds.flatMap((r) => (r.investors || []).map((i) => i.name)))].slice(0, 12),
      }
    : null
  const team = (project?.team?.members || []).slice(0, 6).map((m) => ({ name: m.name, role: m.role || null }))

  return {
    project: project
      ? {
          name: ov.name, symbol: ov.token_symbol || ti.symbol || null, logo: ov.logo_url || ti.image || null, description: clip(ov.description, 500),
          tags: ov.tags || [], website: ov.website || null, x_handle: ov.x_handle || project.social?.twitter?.handle || null, x_followers: num(ov.x_followers ?? project.social?.twitter?.followers_count),
          exchanges: ov.exchanges || project.tge_status?.exchanges || [], tge_status: ov.tge_status || project.tge_status?.current_status || null, chains: ov.chains || [],
        }
      : null,
    market: project && num(ti.price_usd) != null
      ? { price: num(ti.price_usd), market_cap: num(ti.market_cap_usd), fdv: num(ti.fdv), volume_24h: num(ti.volume_24h), change_24h: r2(num(ti.price_change_24h)), change_7d: r2(num(ti.price_change_7d)), change_30d: r2(num(ti.price_change_30d)), ath: num(ti.all_time_high), ath_date: num(ti.all_time_high_date), from_ath_pct: num(ti.all_time_high) && num(ti.price_usd) ? r2(((num(ti.price_usd) - num(ti.all_time_high)) / num(ti.all_time_high)) * 100) : null, circ_ratio_pct: num(ti.circulating_supply) && num(ti.total_supply) ? r2((num(ti.circulating_supply) / num(ti.total_supply)) * 100) : null }
      : null,
    funding,
    team,
    contract,
    dex,
    holders,
    transfers,
    unlocks,
    security,
    kol: kolList[0] || null,
    kols_cited: kolList.length > 1 ? kolList.slice(1) : undefined,
    kol_crowd: kolCrowdOut,
    listing: listing && (listing.claimed.length || listing.recent_events.length) ? listing : null,
    news: news || [],
    page,
  }
}

// Strip code-ish asides the model sometimes leaks, e.g. "(exchanges includes COINBASE)".
const scrub = (t, vi = true) => t
  .replace(/\s*\([^()]*(?:\b[a-z]+_[a-z_]+\b|\b(?:exchanges|includes|evidence|labels_available|project\.|holders\.|market\.)\b|\[\]|\bnull\b)[^()]*\)/g, '')
  .replace(/\s*(?:trong |in )?(?:danh sách |the )?['"`](?:claims|tactics|evidence|extracted|red_flags|green_flags|holders|market|project|dex|unlocks|news|page)['"`](?:\s*(?:trích xuất|extracted))?/gi, '')
  .replace(/\s*\(dữ liệu:[^()]*\)/gi, '')
  .replace(/\b(dữ liệu|data) (?:listing|niêm yết listing)\b/gi, (m, a) => (a.toLowerCase() === 'data' ? 'exchange data' : `${a} sàn`))
  .replace(/\b(dữ liệu|data) (?:kol_crowd|kol crowd)\b/gi, (m, a) => (a.toLowerCase() === 'data' ? 'KOL wallet data' : `${a} ví các KOL`))
  .replace(/\b(dữ liệu|data) kol\b/gi, (m, a) => (a.toLowerCase() === 'data' ? 'KOL wallet data' : `${a} ví KOL`))
  .replace(/['"]?\b(listed_spot|perp_only|not_listed|no_position|sold_before|bought_after|opposite_position|holding)\b['"]?/g, (m, k) => (vi
    ? { listed_spot: 'đã niêm yết', perp_only: 'chỉ có hợp đồng tương lai', not_listed: 'chưa niêm yết', no_position: 'không giữ token', sold_before: 'đã bán trước', bought_after: 'mua sau', opposite_position: 'đặt cược ngược', holding: 'đang giữ' }
    : { listed_spot: 'listed (spot)', perp_only: 'perps only', not_listed: 'not listed', no_position: 'no position', sold_before: 'sold before', bought_after: 'bought after', opposite_position: 'opposite position', holding: 'holding' })[k])
  .replace(/\bsell_pressure\s*(?:=|:|là)?\s*['"]?(high|medium|low)['"]?/gi, (m, l) => (vi ? `áp lực bán ${{ high: 'cao', medium: 'trung bình', low: 'thấp' }[l.toLowerCase()]}` : `${l.toLowerCase()} sell pressure`))
  .replace(/\bpnl[ _]90d(?:_usd)?\b/gi, vi ? 'lãi/lỗ 90 ngày' : '90-day PnL')
  .replace(/\bwin_rate(?:_pct)?\b/gi, vi ? 'tỉ lệ thắng' : 'win rate')
  .replace(/\bconsistency(?:_pct)?\b/gi, vi ? 'độ nhất quán' : 'consistency')
  .replace(/\bverdict\b\s*/gi, vi ? 'trạng thái ' : 'status ')
  .replace(/(?:đã )?\bunlocked\b/g, (m) => (vi ? 'đã mở khóa' : m))
  .replace(/\s*\([^()]*(?:bằng chứng|evidence|dữ liệu cung cấp)[^()]*\)/gi, '')
  .replace(/\s{2,}/g, ' ')

/** Compact evidence bundle shared by the debaters and the judge. */
function evidencePack(ex, ev) {
  const { spark, ...dexNoSpark } = ev.dex || {}
  return { ...ev, dex: ev.dex ? dexNoSpark : null, extracted: { tokens: ex.tokens, claims: ex.claims, tactics: ex.tactics, asks_money: ex.asks_money, addresses: [...ex.evm, ...ex.sol], kols_cited: ex.kols, exchanges_mentioned: (ex.exchanges || []).map((e) => e.name) }, today: new Date().toISOString().slice(0, 10) }
}

/* ---------- 2b. Two-sided debate (inspired by TradingAgents' bull/bear researchers) ---------- */

async function debate(text, ex, ev, lang) {
  const vi = lang !== 'en'
  const pack = JSON.stringify(evidencePack(ex, ev)).slice(0, 14000)
  const side = (role) => chatJson(
    'gpt-5-mini',
    `You are the ${role === 'bull' ? 'ADVOCATE' : 'SKEPTIC'} in a two-sided review of a crypto call/token for retail users.
${role === 'bull'
  ? 'Build the strongest HONEST case FOR this token/call using only the evidence (real listings, liquidity, funding, safe contract, healthy holder spread, momentum). If there is little good to say, give fewer points — never invent.'
  : 'Build the strongest HONEST case AGAINST this token/call using only the evidence (false claims, manipulation tactics, contract traps, whale concentration, unlocks, drawdown, thin liquidity, missing data). Never invent.'}
Each point must cite a concrete number or fact from the evidence. Never mention JSON keys or field names.
Write in ${vi ? 'Vietnamese, simple words' : 'plain English'}. Return JSON:
{"points":[{"point": string (max 70 chars), "evidence": string (max 150 chars)}] (1-4, strongest first), "score": integer 0-100 (how trustworthy YOU think it is from your side)}`,
    `MESSAGE:\n${clip(text, 2500)}\n\nEVIDENCE:\n${pack}`,
    'minimal'
  ).catch(() => null)
  const [bull, bear] = await Promise.all([side('bull'), side('bear')])
  const norm = (j) => (j && Array.isArray(j.points)
    ? { points: j.points.filter((p) => p?.point).slice(0, 4).map((p) => ({ point: scrub(String(p.point), vi).slice(0, 110), evidence: scrub(String(p.evidence || ''), vi).slice(0, 220) })), score: Math.max(0, Math.min(100, Math.round(Number(j.score)) || 0)) }
    : null)
  const out = { bull: norm(bull), bear: norm(bear) }
  return out.bull || out.bear ? out : null
}

/* ---------- 3. Judge ---------- */

const VERDICTS = ['trusted', 'caution', 'risky', 'danger', 'unknown']
const CLAIM_STATUS = ['true', 'false', 'misleading', 'unverifiable']

/** "Sắp list X" claims are decided by live exchange data, not by the model's reading of it. */
const SOON_RE = /sắp|chuẩn bị|sẽ|tuần (?:này|sau)|soon|will|about to|preparing|upcoming|next week/i
function fixListingClaim(c, listing, vi) {
  if (!listing?.claimed?.length || !SOON_RE.test(c.claim)) return c
  const hit = listing.claimed.find((x) => EXCHANGES.find((e) => e.name === x.exchange)?.re.test(c.claim))
  if (!hit) return c
  const sym = listing.symbol
  if (hit.status === 'listed_spot' && c.status !== 'misleading' && c.status !== 'false') {
    return { ...c, status: 'misleading', evidence: vi ? `${hit.exchange} đã niêm yết ${sym} giao dịch giao ngay từ trước${hit.spot_pairs.length ? ` (${hit.spot_pairs.slice(0, 3).join(', ')})` : ''}, nên "sắp list" là tin cũ, không phải cơ hội mới.` : `${hit.exchange} already lists ${sym} spot${hit.spot_pairs.length ? ` (${hit.spot_pairs.slice(0, 3).join(', ')})` : ''}, so "listing soon" is old news.` }
  }
  if ((hit.status === 'not_listed' || hit.status === 'unknown' || hit.status === 'perp_only') && c.status === 'true') {
    return { ...c, status: 'unverifiable', evidence: vi ? `Không tìm thấy thông báo niêm yết chính thức nào của ${hit.exchange} cho ${sym}${hit.status === 'perp_only' ? ' (hiện chỉ có hợp đồng tương lai)' : ''}.` : `No official ${hit.exchange} listing announcement found for ${sym}${hit.status === 'perp_only' ? ' (futures only for now)' : ''}.` }
  }
  return c
}

async function judge(text, ex, ev, lang, dbt, profile) {
  const vi = lang !== 'en'
  const evidence = evidencePack(ex, ev)
  const j = await chatJson(
    'gpt-5-mini',
    `You are Makoto's "Kiểm kèo" (call checker): a calm, honest fact-checker protecting retail crypto users (mostly Vietnamese) from shills, pump-and-dumps and scams.
You receive the user's message and EVIDENCE gathered from live data (project profile, market data, funding, team, top holders, token unlocks, DEX trading history, on-chain transfers, news, the linked web page). Use ONLY this evidence plus well-known general crypto knowledge. Never invent numbers, listings, partnerships or investors. If data is missing, say it cannot be verified — missing data on a promoted token is itself a risk signal.

Scoring (score = trust 0-100, higher = safer). The score rates the CALL as a whole — would acting on THIS message be safe? — not just the token's quality:
- A real, established token shilled with false/misleading claims, unrealistic targets (x5, x10…) or "all-in"/urgency pressure is still a bad call → risky (25-49). Say clearly in the headline that the token itself may be legit but the call is not.
- Only score ≥ 50 when the main claims hold up AND there is no manipulation pressure.
- Asking to send money / pay for VIP or presale / share seed phrase / "inbox admin" → danger, score ≤ 15.
- Guaranteed profits, unrealistic multipliers (x10, x100), heavy urgency → strong red flags.
- Token not found anywhere, or very new (< 30 days), or tiny volume → risky/danger.
- Top 10 private wallets holding > 40% (exclude exchanges/contracts) → high concentration risk. 20-40% medium.
- Large unlocks (> 5% of supply in the next 90 days) → sell pressure.
- Down > 80% from peak, no real listing, no audited team/funding → caution.
- security = contract scan by GoPlus Security. Honeypot (cannot sell) → danger, score ≤ 10. Hidden owner, owner can change balances, owner can raise tax, hidden source code, creator with past honeypots, sell tax ≥ 10% → each is a high red flag (score ≤ 35 unless it is a major, long-established asset). Mention passed contract checks as green flags briefly.
- Established assets (large market cap, many major exchanges, long history) → trusted, but still judge the CLAIMS (a real coin can be shilled with false claims).
- verdict: trusted (≥75), caution (50-74), risky (25-49), danger (<25), unknown (only when there is nothing to check at all, e.g. no token and no claims).

Never mention JSON keys, field names or code-like terms, not even in parentheses (no "from_ath_pct", "team:[]", "exchanges includes X", "extracted", "tactics"); describe data in plain words with the number (e.g. "giá đang thấp hơn đỉnh 82%"). Holder lists may label exchange wallets (cex); if labels_available is false, say the biggest wallets may include exchanges.
HARD DATA BEATS CLAIMS. Rules for the new checks:
- listing = live check of the exchanges named in the message (authoritative; prefer it over project.exchanges, which may include futures-only venues). Per exchange status: listed_spot (already trades spot → "sắp list / sắp lên sàn X" is misleading: old news), perp_only (only futures/perp exists; a spot listing has NOT happened), announced (official upcoming listing found → the claim is true), not_listed (no pairs and no official announcement → "sắp list X" is unverifiable at best; if stated as a certain fact, with a date, or used to create urgency, mark it false), unknown (could not read that venue → unverifiable). recent_events = official listing events in the last ~13 months (cite the date when relevant).
- kol = the X/Twitter account the call cites, with its audited track record: consistency_pct = share of their calls where they actually held the token; token.verdict for THIS token: holding (they hold it — fair), bought_after (bought after tweeting), no_position (shilling without owning it), sold_before (sold before/while shilling → dumping on followers, high red flag), opposite_position (bet against it while shilling → high red flag). token=null means no recorded call/position of theirs on this token — never invent a verdict for them. tracked=false means we have no wallet data for that account (say so; do not treat as negative alone). Low consistency (< 30%) and negative pnl are cautions about following this KOL.
- kol_crowd = all tracked KOL tweets about this token by verdict. Many no_position plus some sold_before on a small token suggests a paid/coordinated shill. For major assets (BTC, ETH, SOL…) most KOLs having no on-chain position is normal; mention it only lightly.
- unlocks.sell_pressure (high/medium/low) uses next-30-day unlock % of supply and its USD value vs 24h volume; next_cliff / biggest_cliff_90d are single-day unlocks. Use them to check any unlock claim ("unlock nhỏ", "sắp mở khóa lớn") — say true/false with the numbers.
project.exchanges = exchanges where the token ALREADY trades (may include perp venues). If the call says it "will list on" an exchange that is already listed spot, the claim is misleading (already listed, not news).
You also get a DEBATE between an advocate and a skeptic. Act as the neutral risk manager: weigh both, discard points not backed by evidence, then decide.
${profile ? `USER PROFILE (personalize advice to it, never change the score because of it): ${clip(profile, 600)}` : ''}
Write in ${vi ? 'Vietnamese (simple words for non-experts, no jargon without explanation)' : 'English (plain words)'}. Return JSON:
{"score": integer 0-100,
"verdict": "trusted"|"caution"|"risky"|"danger"|"unknown",
"headline": string (max 80 chars, the one-line verdict, e.g. "Kèo có nhiều dấu hiệu lùa gà"),
"summary": string (2-3 sentences, max 360 chars),
"claims": [{"claim": string, "status": "true"|"false"|"misleading"|"unverifiable", "evidence": string (max 180 chars, cite the specific data point)}] (check every extracted claim),
"red_flags": [{"title": string (max 60), "detail": string (max 180, include the number), "severity": "high"|"medium"|"low"}] (max 6, most serious first),
"green_flags": [{"title": string (max 60), "detail": string (max 160)}] (max 4),
"advice": [string] (2-4 concrete next steps for this user, max 140 chars each),
"ask": [string] (0-3 sharp questions the user should send back to the PERSON WHO POSTED THE CALL to test it, e.g. "Link thông báo niêm yết chính thức của Binance ở đâu?"; max 110 chars each; never questions to the user)}`,
    `MESSAGE:\n${clip(text, 3500)}\n\nEVIDENCE:\n${JSON.stringify(evidence).slice(0, 16000)}${dbt ? `\n\nDEBATE:\n${JSON.stringify(dbt)}` : ''}`,
    'low'
  )
  // An empty or broken verdict is an error (the caller refunds), never a billed "score 0".
  if (!Number.isFinite(Number(j?.score)) || j?.score === null || j?.score === '' || typeof j?.headline !== 'string' || !j.headline.trim()) throw new Error('judge returned no verdict')
  const str = (x, n) => (typeof x === 'string' ? scrub(x.trim(), vi).slice(0, n) : '')
  let score = Math.max(0, Math.min(100, Math.round(Number(j.score)) || 0))
  let verdict = VERDICTS.includes(j.verdict) ? j.verdict : 'unknown'
  // Hard safety rail: requests for money/keys can never look safe.
  if (ex.asks_money && score > 15) { score = 15; verdict = 'danger' }
  const sec = ev.security
  if (sec?.honeypot && score > 10) { score = 10; verdict = 'danger' }
  // A call whose key claims don't hold up can't be "caution" or better, however solid the coin.
  const badClaims = (Array.isArray(j.claims) ? j.claims : []).filter((c) => c?.claim).map((c) => fixListingClaim({ claim: String(c.claim), status: c.status }, ev.listing, vi)).filter((c) => c.status === 'false' || c.status === 'misleading').length
  const pressure = (ex.tactics || []).length >= 2
  if ((badClaims >= 2 || (badClaims >= 1 && pressure)) && score > 45) score = 45
  // The cited KOL sold or bet against this token while promoting it.
  const kolBad = [ev.kol, ...(ev.kols_cited || [])].some((k) => ['sold_before', 'opposite_position'].includes(k?.token?.verdict))
  if (kolBad && score > 40) score = 40
  const bigAsset = (ev.market?.market_cap || 0) > 5e8
  if (!bigAsset && sec?.checks?.some((c) => !c.ok && c.severity === 'high') && score > 40) score = 40
  if (verdict !== 'unknown') verdict = score >= 75 ? 'trusted' : score >= 50 ? 'caution' : score >= 25 ? 'risky' : 'danger'
  return {
    score,
    verdict,
    headline: str(j.headline, 120),
    summary: str(j.summary, 520),
    claims: (Array.isArray(j.claims) ? j.claims : []).filter((c) => c?.claim).map((c) => fixListingClaim({ claim: str(c.claim, 200), status: CLAIM_STATUS.includes(c.status) ? c.status : 'unverifiable', evidence: str(c.evidence, 260) }, ev.listing, vi)).slice(0, 8),
    red_flags: (Array.isArray(j.red_flags) ? j.red_flags : []).filter((f) => f?.title).map((f) => ({ title: str(f.title, 90), detail: str(f.detail, 260), severity: ['high', 'medium', 'low'].includes(f.severity) ? f.severity : 'medium' })).slice(0, 6),
    green_flags: (Array.isArray(j.green_flags) ? j.green_flags : []).filter((f) => f?.title).map((f) => ({ title: str(f.title, 90), detail: str(f.detail, 220) })).slice(0, 4),
    advice: (Array.isArray(j.advice) ? j.advice : []).map((a) => str(a, 200)).filter(Boolean).slice(0, 4),
    ask: (Array.isArray(j.ask) ? j.ask : []).map((a) => str(a, 160)).filter(Boolean).slice(0, 3),
  }
}

/** Full pipeline. `onStep(key)` reports progress for the UI. */
async function runVerify(text, lang, onStep = () => {}, opts = {}) {
  onStep('read')
  const ex = await extract(text, lang)
  onStep('gather')
  const ev = await gather(ex)
  onStep('debate')
  const dbt = await debate(text, ex, ev, lang)
  onStep('judge')
  const verdict = await judge(text, ex, ev, lang, dbt, opts.profile)
  return {
    ...verdict,
    debate: dbt,
    tactics: ex.tactics,
    asks_money: ex.asks_money,
    token: ev.project ? { name: ev.project.name, symbol: ev.project.symbol, logo: ev.project.logo } : ex.tokens[0] ? { name: ex.tokens[0].name, symbol: ex.tokens[0].symbol, logo: null } : ev.contract ? { name: ev.security?.token_name || null, symbol: ev.security?.token_symbol || null, logo: null, address: ev.contract.address } : null,
    evidence: ev,
    checked_at: new Date().toISOString(),
  }
}

module.exports = { runVerify }
