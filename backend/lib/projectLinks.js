// Official links + team X verification for project profiles.
//  - Links: merged from the project data feed, the project's own website (footer/header links)
//    and CoinGecko (only when the coin's homepage or X handle matches the project).
//  - Team X: every member's X account is checked against the live X profile. A link is shown
//    only when the account exists and its display name matches the person; it is marked
//    "verified" when the bio also mentions the project.

const TTL = 12 * 60 * 60 * 1000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const fold = (s) => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase()
const compact = (s) => fold(s).replace(/[^a-z0-9]/g, '')

function cacheGet(map, k, ttl = TTL) {
  const c = map.get(k)
  return c && Date.now() - c.at < (c.ttl || ttl) ? c : null
}
function cacheSet(map, k, data, ttl) {
  map.set(k, { at: Date.now(), data, ttl })
  if (map.size > 1500) for (const key of [...map.keys()].slice(0, 300)) map.delete(key)
  return data
}

// Only public internet hosts: project websites come from third-party data, so never let a
// redirect or DNS answer point the server at localhost, cloud metadata or private networks.
const dns = require('dns').promises
const net = require('net')
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const x = ip.toLowerCase()
  if (x.startsWith('::ffff:')) return privateIp(x.slice(7))
  return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x)
}
async function publicUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return null }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && !['80', '443'].includes(u.port))) return null
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host.includes('.') || /\.(local|localhost|internal|intranet|lan|home|corp)$/.test(host)) return null
  if (net.isIP(host)) return privateIp(host) ? null : u
  const addrs = await dns.lookup(host, { all: true }).catch(() => [])
  return addrs.length && !addrs.some((a) => privateIp(a.address)) ? u : null
}

async function getText(url, ms = 8000, max = 2_500_000) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    let cur = url
    for (let hop = 0; hop < 4; hop++) {
      const u = await publicUrl(cur)
      if (!u) return { status: 0, text: null }
      const r = await fetch(u, { signal: ctl.signal, redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' } })
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        cur = new URL(r.headers.get('location'), u).toString()
        continue
      }
      if (!r.ok || !r.body) return { status: r.status, text: null }
      // Stream with a byte cap instead of buffering an arbitrarily large body.
      const reader = r.body.getReader()
      const dec = new TextDecoder()
      let text = ''
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        text += dec.decode(value, { stream: true })
        if (size >= max) { ctl.abort(); break }
      }
      return { status: r.status, text }
    }
    return { status: 0, text: null }
  } catch {
    return { status: 0, text: null }
  } finally { clearTimeout(t) }
}
async function getJson(url, ms = 7000) {
  const { status, text } = await getText(url, ms)
  if (!text) return { status, json: null }
  try { return { status, json: JSON.parse(text) } } catch { return { status, json: null } }
}

/* ---------- Link classification ---------- */

const KINDS = ['x', 'telegram', 'discord', 'github', 'blog', 'docs', 'youtube', 'linkedin', 'reddit', 'farcaster', 'instagram', 'tiktok']
const BAD_X = new Set(['intent', 'share', 'home', 'i', 'search', 'hashtag', 'explore', 'login', 'signup', 'settings', 'privacy', 'tos', 'messages', 'notifications'])
const BAD_GH = new Set(['sponsors', 'features', 'about', 'login', 'join', 'pricing', 'topics', 'orgs', 'settings', 'marketplace', 'apps', 'site', 'enterprise', 'collections', 'trending'])
const BAD_TG = new Set(['share', 's', 'iv', 'addstickers', 'proxy', 'socks', 'setlanguage', 'login'])
const BAD_MEDIUM = new Set(['p', 'tag', 'tags', 'm', 'plans', 'membership', 'about', 'creators', 'search', 'me'])

// Root domain of a host ("app.kast.xyz" → "kast.xyz").
function rootDomain(host) {
  const parts = String(host || '').toLowerCase().replace(/^www\./, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  const sld = parts[parts.length - 2]
  return (sld.length <= 3 && /^(co|com|org|net|gov|edu|ac)$/.test(sld) ? parts.slice(-3) : parts.slice(-2)).join('.')
}

function classify(raw, siteRoot) {
  let u
  try { u = new URL(String(raw).replace(/&amp;/g, '&')) } catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./g, '')
  const seg = u.pathname.split('/').filter(Boolean)
  const s0 = seg[0] || ''
  const ok = (kind, url, slug) => ({ kind, url, slug: compact(slug) })
  if (host === 'x.com' || host === 'twitter.com') {
    if (!/^[A-Za-z0-9_]{1,15}$/.test(s0) || BAD_X.has(s0.toLowerCase()) || seg.length > 1) return null
    return ok('x', `https://x.com/${s0}`, s0)
  }
  if (host === 't.me' || host === 'telegram.me') {
    if (!s0 || BAD_TG.has(s0.toLowerCase())) return null
    if (s0 === 'joinchat' && seg[1]) return ok('telegram', `https://t.me/joinchat/${seg[1]}`, '')
    if (!/^\+?[A-Za-z0-9_-]{3,64}$/.test(s0)) return null
    return ok('telegram', `https://t.me/${s0}`, s0)
  }
  if (host === 'discord.gg' && /^[A-Za-z0-9-]{2,40}$/.test(s0)) return ok('discord', `https://discord.gg/${s0}`, s0)
  if ((host === 'discord.com' || host === 'discordapp.com') && s0 === 'invite' && /^[A-Za-z0-9-]{2,40}$/.test(seg[1] || '')) return ok('discord', `https://discord.gg/${seg[1]}`, seg[1])
  if (host === 'github.com') {
    if (!/^[A-Za-z0-9-]{1,39}$/.test(s0) || BAD_GH.has(s0.toLowerCase())) return null
    return ok('github', `https://github.com/${s0}`, s0)
  }
  if (host === 'medium.com') {
    if (!s0 || BAD_MEDIUM.has(s0.toLowerCase())) return null
    return ok('blog', `https://medium.com/${s0}`, s0.replace(/^@/, ''))
  }
  if (/^[a-z0-9-]+\.medium\.com$/.test(host) && !/^(help|policy|blog)\./.test(host)) return ok('blog', `https://${host}`, host.split('.')[0])
  if (host === 'mirror.xyz' && s0) return ok('blog', `https://mirror.xyz/${s0}`, s0.replace(/\.eth$/, ''))
  if (/^[a-z0-9-]+\.mirror\.xyz$/.test(host)) return ok('blog', `https://${host}`, host.split('.')[0])
  if (/^[a-z0-9-]+\.substack\.com$/.test(host)) return ok('blog', `https://${host}`, host.split('.')[0])
  if (host === 'paragraph.xyz' || host === 'paragraph.com') return s0 ? ok('blog', `https://${host}/${s0}`, s0.replace(/^@/, '')) : null
  if (host === 'youtube.com') {
    if (/^@[\w.-]{2,}$/.test(s0)) return ok('youtube', `https://www.youtube.com/${s0}`, s0.slice(1))
    if (['c', 'channel', 'user'].includes(s0) && seg[1]) return ok('youtube', `https://www.youtube.com/${s0}/${seg[1]}`, seg[1])
    return null
  }
  if (host === 'linkedin.com' && (s0 === 'company' || s0 === 'school') && seg[1]) return ok('linkedin', `https://www.linkedin.com/company/${seg[1]}`, seg[1])
  if (host === 'reddit.com' && s0 === 'r' && seg[1]) return ok('reddit', `https://www.reddit.com/r/${seg[1]}`, seg[1])
  if ((host === 'warpcast.com' || host === 'farcaster.xyz') && /^[a-z0-9][\w.-]{1,30}$/i.test(s0) && s0 !== '~' && seg.length === 1) return ok('farcaster', `https://farcaster.xyz/${s0}`, s0)
  if (host === 'instagram.com' && /^[\w.]{2,30}$/.test(s0) && !['p', 'reel', 'explore', 'accounts'].includes(s0)) return ok('instagram', `https://www.instagram.com/${s0}`, s0)
  if (host === 'tiktok.com' && /^@[\w.]{2,30}$/.test(s0)) return ok('tiktok', `https://www.tiktok.com/${s0}`, s0.slice(1))
  // Docs: docs.<project domain>, <project>.gitbook.io, or <project domain>/docs
  if (siteRoot) {
    const r = rootDomain(host)
    if (r === siteRoot && /^(docs|doc|developers?|learn|wiki|help)\./.test(host)) return ok('docs', `https://${host}`, '')
    if (r === siteRoot && /^(docs|documentation)$/i.test(s0) && seg.length === 1) return ok('docs', `https://${host}/${s0}`, '')
  }
  if (/^[a-z0-9-]+\.gitbook\.io$/.test(host)) return ok('docs', `https://${host}${seg.length ? '/' + seg[0] : ''}`, host.split('.')[0])
  return null
}

// Among several candidates for one kind, prefer the one named like the project.
function pick(cands, names) {
  if (!cands.length) return null
  const keys = names.map(compact).filter((k) => k.length >= 3)
  const score = (c) => (c.slug && keys.some((k) => c.slug === k) ? 3 : c.slug && keys.some((k) => c.slug.includes(k) || k.includes(c.slug)) ? 2 : 0)
  return cands.slice().sort((a, b) => score(b) - score(a))[0]
}

/* ---------- Sources ---------- */

const siteCache = new Map()
async function fromWebsite(site) {
  if (!site) return []
  const hit = cacheGet(siteCache, site)
  if (hit) return hit.data
  const { text } = await getText(site, 8000)
  if (!text) return cacheSet(siteCache, site, [], 60 * 60 * 1000)
  const html = text.replace(/\\u002F/gi, '/').replace(/\\\//g, '/')
  const urls = new Set()
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>()\\`]+/g)) urls.add(m[0].replace(/[.,;]+$/, ''))
  return cacheSet(siteCache, site, [...urls].slice(0, 3000))
}

const cgCache = new Map()
async function fromCoinGecko(p, siteRoot) {
  if (!p.symbol || !p.name) return []
  const key = `${compact(p.name)}:${compact(p.symbol)}`
  const hit = cacheGet(cgCache, key)
  if (hit) return hit.data
  const { status, json } = await getJson(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(p.name)}`)
  if (!json) return cacheSet(cgCache, key, [], status === 429 ? 10 * 60 * 1000 : 60 * 60 * 1000)
  const nm = compact(p.name)
  const coin = (json.coins || []).find((c) => compact(c.symbol) === compact(p.symbol) && (compact(c.name) === nm || compact(c.name).startsWith(nm) || nm.startsWith(compact(c.name))))
  if (!coin?.id) return cacheSet(cgCache, key, [])
  const { json: d } = await getJson(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin.id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
  const l = d?.links
  if (!l) return cacheSet(cgCache, key, [], 10 * 60 * 1000)
  // Only trust it if it is clearly the same project (same website or same X account).
  const homes = (l.homepage || []).filter(Boolean).map((h) => { try { return rootDomain(new URL(h).hostname) } catch { return '' } })
  const sameSite = siteRoot && homes.includes(siteRoot)
  const sameX = p.x_handle && l.twitter_screen_name && compact(l.twitter_screen_name) === compact(p.x_handle)
  if (!sameSite && !sameX) return cacheSet(cgCache, key, [])
  const out = [
    ...(l.chat_url || []),
    ...(l.announcement_url || []),
    l.telegram_channel_identifier ? `https://t.me/${l.telegram_channel_identifier}` : null,
    l.subreddit_url,
    l.twitter_screen_name ? `https://x.com/${l.twitter_screen_name}` : null,
    ...(l.repos_url?.github || []),
  ].filter((u) => typeof u === 'string' && u)
  return cacheSet(cgCache, key, out)
}

/* ---------- Team X verification ---------- */

const xCache = new Map()
async function xProfile(handle) {
  const k = handle.toLowerCase()
  const hit = cacheGet(xCache, k)
  if (hit) return hit.data
  const { status, json } = await getJson(`https://api.fxtwitter.com/${encodeURIComponent(handle)}`, 6000)
  const u = json?.user
  if (json?.code === 200 && u?.screen_name) {
    return cacheSet(xCache, k, { ok: true, handle: u.screen_name, name: String(u.name || ''), bio: String(u.description || ''), site: String(u.website?.url || u.website?.display_url || ''), followers: Number(u.followers) || null })
  }
  // 404 = account gone/renamed (cache long); anything else = lookup failed (retry soon).
  const gone = json?.code === 404 || status === 404
  return cacheSet(xCache, k, { ok: false, gone }, gone ? TTL : 10 * 60 * 1000)
}

const NAME_STOP = new Set(['dr', 'mr', 'mrs', 'ms', 'phd', 'jr', 'sr', 'the', 'and', 'von', 'van', 'der', 'den', 'de', 'la', 'le', 'da', 'bin'])
function nameTokens(n) {
  return fold(n).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !NAME_STOP.has(t))
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Does this X profile say the person works on the project? (bio mention, @handle or same website)
function mentionsProject(pr, p, siteRoot) {
  const bio = fold(pr.bio)
  const site = fold(pr.site)
  const nm = fold(p.name).replace(/[^a-z0-9 ]+/g, ' ').trim()
  if (p.x_handle && bio.includes('@' + fold(p.x_handle))) return true
  if (siteRoot && (bio.includes(siteRoot) || (site && rootDomain(site.replace(/^https?:\/\//, '').split('/')[0]) === siteRoot))) return true
  if (compact(nm).length >= 3 && bio.includes('@' + compact(nm))) return true
  if (nm.length >= 3 && new RegExp(`(^|[^a-z0-9])${esc(nm)}([^a-z0-9]|$)`).test(bio)) return true
  return false
}

async function verifyMember(m, p, siteRoot) {
  const m1 = typeof m.x === 'string' ? m.x.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i) : null
  if (!m1 || BAD_X.has(m1[1].toLowerCase())) return { ...m, x: null, x_status: null }
  const pr = await xProfile(m1[1])
  if (!pr.ok) return { ...m, x: null, x_status: null, failed: !pr.gone }
  const toks = nameTokens(m.name)
  const hay = compact(pr.name) + ' ' + compact(pr.handle)
  const found = toks.filter((t) => hay.includes(t)).length
  const projMatch = mentionsProject(pr, p, siteRoot)
  const nameMatch = toks.length > 0 && (found >= 2 || (toks.length === 1 && found === 1))
  // Pseudonymous accounts are fine when the bio names the project; otherwise the name must match.
  if (!nameMatch && !projMatch) return { ...m, x: null, x_status: null }
  return { ...m, x: `https://x.com/${pr.handle}`, x_handle: pr.handle, x_followers: pr.followers, x_status: projMatch ? 'verified' : 'matched' }
}

/* ---------- Public ---------- */

const enrichCache = new Map()

async function enrich(p) {
  if (!p?.id) return { links: [], team: p?.team || [] }
  const hit = cacheGet(enrichCache, p.id)
  if (hit) return hit.data
  let siteRoot = null
  try { siteRoot = p.website ? rootDomain(new URL(p.website).hostname) : null } catch {}
  const feed = [p.socials?.discord?.url, p.socials?.telegram?.url, p.socials?.github?.url].filter(Boolean)
  const [site, cg, team] = await Promise.all([
    fromWebsite(p.website).catch(() => []),
    fromCoinGecko(p, siteRoot).catch(() => []),
    Promise.all((p.team || []).map((m) => verifyMember(m, p, siteRoot).catch(() => ({ ...m, x: null, x_status: null, failed: true })))),
  ])
  const names = [p.name, p.x_handle, siteRoot?.split('.')[0], p.symbol].filter(Boolean)
  const by = {}
  // Priority: data feed → official website → CoinGecko.
  for (const [src, list] of [['feed', feed], ['site', site], ['cg', cg]]) {
    const groups = {}
    for (const u of list) {
      const c = classify(u, siteRoot)
      if (c) (groups[c.kind] ||= []).push(c)
    }
    for (const k of Object.keys(groups)) if (!by[k]) { const c = pick(groups[k], names); if (c) by[k] = { ...c, src } }
  }
  // The project's own X account comes from the data feed; never let a website link override it.
  if (p.x_handle) delete by.x
  const links = KINDS.filter((k) => by[k]).map((k) => ({ kind: k, url: by[k].url }))
  // A failed X lookup (rate limit, timeout) should not stick for 12h.
  const partial = team.some((m) => m.failed)
  const data = { links, team: team.map(({ failed, ...m }) => m) }
  return cacheSet(enrichCache, p.id, data, partial ? 10 * 60 * 1000 : TTL)
}

module.exports = { enrich, classify }
