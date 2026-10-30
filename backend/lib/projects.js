// "Dự án" — crypto project profiles: overview, team, funding & backers, token, contracts.
// Default list = projects recently funded by top-tier funds; any project can be found by name.
const { dataApi } = require('@surf-ai/sdk/server')

const DAY = 86400
const LIST_TTL = 30 * 60 * 1000
const DETAIL_TTL = 12 * 60 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : 0)
const str = (v, n = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
const nowS = () => Math.floor(Date.now() / 1000)
const compact = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
const isId = (s) => UUID_RE.test(String(s || ''))

// Drop tracking / referral params so links land on the clean official page.
function cleanLink(u) {
  if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) return null
  try {
    const url = new URL(u)
    for (const k of [...url.searchParams.keys()]) if (/^(r|ref|ref[-_]?\w*|referr\w*|invit\w*|code|invite_?code|via|source|aff\w*|kol|partner\w*|promo\w*|share\w*|from|utm_\w+)$/i.test(k)) url.searchParams.delete(k)
    return url.toString()
  } catch { return null }
}
function cleanSite(u) {
  try {
    const x = new URL(String(u))
    return /^https?:$/.test(x.protocol) ? x.origin : null
  } catch { return null }
}
// Dates arrive as unix seconds, ms or 'YYYY-MM-DD' — always return unix seconds.
function toSec(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : v
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}
const XRE = /^https?:\/\/(www\.)?(x|twitter)\.com\//i

/* ---------- Project profile ---------- */

const detailCache = new Map() // id -> { at, data }

async function projectInfo(id) {
  if (!isId(id)) return null
  const c = detailCache.get(id)
  if (c && Date.now() - c.at < DETAIL_TTL) return c.data
  const r = await dataApi.project.detail({ id, fields: 'overview,funding,social,tge_status,team,contracts' }).catch(() => null)
  const d = r?.data
  if (!d?.overview?.name) return null
  const ov = d.overview || {}
  const rounds = (d.funding?.rounds || []).slice().sort((x, y) => (toSec(y.date) || 0) - (toSec(x.date) || 0))
  const investors = []
  const seen = new Set()
  for (const rd of rounds) for (const i of rd.investors || []) {
    if (!i?.name || seen.has(i.name)) continue
    seen.add(i.name)
    investors.push({ name: i.name, logo: i.logo || null, lead: !!i.is_lead, person: i.type === 'PERSON' })
  }
  investors.sort((a, b) => Number(b.lead) - Number(a.lead) || Number(a.person) - Number(b.person))
  const so = d.social || {}
  const social = (k) => {
    const x = so[k]
    if (!x) return null
    const url = cleanLink(x.url) || (k === 'twitter' && x.handle ? `https://x.com/${x.handle}` : null)
    return url ? { url, handle: str(x.handle, 60), followers: num(x.followers_count) || null } : null
  }
  const tge = d.tge_status || {}
  const data = {
    id,
    name: str(ov.name, 80),
    logo: ov.logo_url || null,
    symbol: str(ov.token_symbol, 20),
    description: str(ov.description, 1500),
    website: cleanSite(ov.website),
    x_handle: str(ov.x_handle, 60) || str(so.twitter?.handle, 60),
    x_followers: num(ov.x_followers) || num(so.twitter?.followers_count) || null,
    socials: { discord: social('discord'), telegram: social('telegram'), github: social('github') },
    tags: (ov.tags || []).filter((t) => typeof t === 'string').slice(0, 8),
    chains: (ov.chains || []).filter((t) => typeof t === 'string').slice(0, 8),
    exchanges: [...new Set([...(ov.exchanges || []), ...(tge.exchanges || [])].filter((t) => typeof t === 'string'))].slice(0, 12),
    tge_status: ov.tge_status || tge.current_status || null,
    tge_time: toSec(tge.last_event_time),
    total_raise: num(d.funding?.total_raise) || null,
    rounds: rounds.slice(0, 10).map((rd) => ({
      name: str(rd.round_name, 40), amount: num(rd.amount) || null, date: toSec(rd.date), valuation: num(rd.valuation) || null,
      investors: (rd.investors || []).filter((i) => i?.name).sort((x, y) => Number(!!y.is_lead) - Number(!!x.is_lead)).slice(0, 6).map((i) => ({ name: i.name, lead: !!i.is_lead })),
    })),
    investors: investors.slice(0, 30),
    team: (d.team?.members || []).filter((m) => m?.name).slice(0, 10).map((m) => {
      const l = m.social_links || {}
      const x = Object.values(l).find((u) => typeof u === 'string' && XRE.test(u))
      const li = typeof l.linkedin === 'string' ? l.linkedin : null
      return { name: str(m.name, 60), role: str(m.role, 60), image: m.image || null, x: cleanLink(x || null), linkedin: cleanLink(li) }
    }),
    contracts: (d.contracts?.contracts || []).filter((x) => x?.address && x?.chain).slice(0, 8).map((x) => ({ chain: str(x.chain, 30), address: str(x.address, 120), label: str(x.label, 30) })),
  }
  detailCache.set(id, { at: Date.now(), data })
  if (detailCache.size > 800) for (const k of [...detailCache.keys()].slice(0, 200)) detailCache.delete(k)
  return data
}

// Price data changes fast — cached separately for 10 minutes.
const tokenCache = new Map()
async function tokenInfo(id) {
  if (!isId(id)) return null
  const c = tokenCache.get(id)
  if (c && Date.now() - c.at < 10 * 60 * 1000) return c.data
  const r = await dataApi.project.detail({ id, fields: 'token_info,tokenomics' }).catch(() => null)
  const t = r?.data?.token_info
  const tk = r?.data?.tokenomics || {}
  const data = t && num(t.price_usd) ? {
    symbol: str(t.symbol, 20), name: str(t.name, 60), price: num(t.price_usd),
    change_24h: Number.isFinite(t.price_change_24h) ? t.price_change_24h : null, change_7d: Number.isFinite(t.price_change_7d) ? t.price_change_7d : null, change_30d: Number.isFinite(t.price_change_30d) ? t.price_change_30d : null,
    market_cap: num(t.market_cap_usd) || num(tk.market_cap_usd) || null, fdv: num(t.fdv) || num(tk.fdv) || null, volume_24h: num(t.volume_24h) || null,
    circulating: num(t.circulating_supply) || num(tk.circulating_supply) || null, total_supply: num(t.total_supply) || num(tk.total_supply) || null,
    ath: num(t.all_time_high) || null, ath_date: num(t.all_time_high_date) || null, atl: num(t.all_time_low) || null, atl_date: num(t.all_time_low_date) || null,
    at: nowS(),
  } : null
  tokenCache.set(id, { at: Date.now(), data })
  if (tokenCache.size > 400) for (const k of [...tokenCache.keys()].slice(0, 100)) tokenCache.delete(k)
  return data
}

/* ---------- Recently funded list ---------- */

let listCache = null // { at, items, pending }

async function fetchList() {
  const pages = await Promise.all([0, 100].map((offset) => dataApi.fund.ranking({ metric: 'tier', limit: 100, offset }).then((r) => r?.data || []).catch(() => (offset === 0 ? null : []))))
  if (pages[0] == null) throw new Error('project source unavailable')
  const since = nowS() - 365 * DAY
  const map = new Map()
  for (const f of pages.flat()) {
    if (!f?.name) continue
    for (const p of f.top_projects || []) {
      if (!isId(p?.project_id) || !p.project_name) continue
      const at = num(p.invested_at)
      if (!at || at < since) continue
      const cur = map.get(p.project_id) || { id: p.project_id, name: str(p.project_name, 80), logo: p.project_logo || null, raised_at: 0, last_raise: null, backers: [] }
      if (at > cur.raised_at) { cur.raised_at = at; cur.last_raise = num(p.recent_raise) || cur.last_raise }
      if (!cur.backers.some((b) => b.name === f.name)) cur.backers.push({ name: f.name, lead: !!p.is_lead, tier: num(f.tier) || null })
      map.set(p.project_id, cur)
    }
  }
  const items = [...map.values()].map((x) => ({ ...x, backers: x.backers.sort((a, b) => Number(b.lead) - Number(a.lead)) }))
  return items.sort((a, b) => b.raised_at - a.raised_at)
}

// Profiles are fetched in the background (a few at a time, cached 12h) so list cards can show sector and summary.
let warming = false
async function warm(items) {
  if (warming) return
  warming = true
  try {
    const ids = items.map((a) => a.id).filter((id) => !detailCache.has(id)).slice(0, 160)
    for (let i = 0; i < ids.length; i += 3) await Promise.all(ids.slice(i, i + 3).map((id) => projectInfo(id).catch(() => null)))
  } finally { warming = false }
}

async function list() {
  if (listCache?.items && Date.now() - listCache.at < LIST_TTL) return { items: listCache.items, updated_at: listCache.at }
  if (listCache?.pending) return listCache.pending
  const prev = listCache
  const pending = fetchList()
    .then((items) => { listCache = { at: Date.now(), items }; warm(items); return { items, updated_at: listCache.at } })
    .catch((e) => {
      listCache = prev ? { ...prev, pending: null } : null
      if (prev?.items) return { items: prev.items, updated_at: prev.at, stale: true }
      throw e
    })
  listCache = { ...(prev || {}), pending }
  return pending
}

/** List row enriched with whatever profile data is already cached (no extra calls). */
function card(x) {
  const d = detailCache.get(x.id)?.data
  return {
    id: x.id,
    name: d?.name || x.name,
    logo: d?.logo || x.logo || null,
    symbol: d?.symbol || x.symbol || null,
    tags: d?.tags?.slice(0, 3) || x.tags || [],
    chains: d?.chains?.slice(0, 4) || x.chains || [],
    summary: str(d?.description || x.description, 240),
    total_raise: d?.total_raise || null,
    last_raise: x.last_raise || null,
    raised_at: x.raised_at || null,
    backers: x.backers?.length ? x.backers.map((b) => b.name).slice(0, 4) : d ? d.investors.filter((i) => !i.person).slice(0, 4).map((i) => i.name) : [],
    tge_status: d?.tge_status || null,
  }
}

/* ---------- Search ---------- */

const searchCache = new Map()
function cleanQuery(q) {
  return String(q || '').trim().slice(0, 60)
    .replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^(x\.com|twitter\.com)\//i, '').replace(/^[@$]/, '')
    .replace(/\.(xyz|io|fi|com|app|finance|network|org|net|gg|ai|so|co|tech|money|exchange)(\/.*)?$/i, '')
    .trim()
}

async function search(query) {
  const q = cleanQuery(query)
  const c = compact(q)
  if (c.length < 2) return []
  const hit = searchCache.get(c)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.rows
  const [remote, { items }] = await Promise.all([
    dataApi.search.project({ q, limit: 12 }).then((r) => r?.data || []).catch(() => []),
    list().catch(() => ({ items: [] })),
  ])
  const out = new Map()
  // Funded projects already in the list come first when they match.
  for (const x of items) if (compact(x.name).includes(c)) out.set(x.id, card(x))
  for (const p of remote) {
    if (!isId(p?.id) || !p.name || out.has(p.id)) continue
    const known = items.find((x) => x.id === p.id)
    out.set(p.id, card({ ...(known || {}), id: p.id, name: p.name, logo: p.logo_url, symbol: p.symbol, tags: (p.tags || []).slice(0, 3), chains: (p.chains || []).slice(0, 4), description: p.description }))
  }
  const rank = (x) => { const n = compact(x.name), s = compact(x.symbol); return n === c || s === c ? 0 : n.startsWith(c) ? 1 : 2 }
  const rows = [...out.values()].sort((a, b) => rank(a) - rank(b)).slice(0, 12)
  searchCache.set(c, { at: Date.now(), rows })
  if (searchCache.size > 300) for (const k of [...searchCache.keys()].slice(0, 100)) searchCache.delete(k)
  return rows
}

/** UUID → itself; anything else (e.g. an old saved name) → best name match. */
async function resolve(key, name) {
  if (isId(key)) return key
  const rows = await search(name || String(key).replace(/^n-/, '').replace(/-/g, ' ')).catch(() => [])
  const c = compact(name)
  return (rows.find((r) => compact(r.name) === c) || rows[0])?.id || null
}

/** Other recently funded projects sharing a backer (from the cached list only — no extra calls). */
async function related(id, info) {
  const names = new Set((info?.investors || []).filter((i) => !i.person).map((i) => i.name))
  const { items } = await list().catch(() => ({ items: [] }))
  const me = items.find((x) => x.id === id)
  for (const b of me?.backers || []) names.add(b.name)
  if (!names.size) return []
  const out = []
  for (const x of items) {
    if (x.id === id) continue
    const shared = x.backers.filter((b) => names.has(b.name)).map((b) => b.name)
    if (shared.length) out.push({ ...card(x), shared: shared.slice(0, 3) })
  }
  return out.sort((a, b) => b.shared.length - a.shared.length || (b.raised_at || 0) - (a.raised_at || 0)).slice(0, 6)
}

module.exports = { list, card, search, resolve, projectInfo, tokenInfo, related, isId }
