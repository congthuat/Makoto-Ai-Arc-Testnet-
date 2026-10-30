const { dataApi } = require('@surf-ai/sdk/server')
const arc = require('./arc')
const { ARC } = require('./config')
const { runVerify } = require('./verify')
const projects = require('./projects')
const { isPublicHttpUrl } = require('./safe')
const { enrich } = require('./projectLinks')

const fn = (name, description, properties, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
})

function downsample(arr, n) {
  if (arr.length <= n) return arr
  const step = (arr.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)])
}

const clip = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s)

const TOOLS = {
  get_token_price: {
    label: { vi: 'Đang lấy giá', en: 'Fetching price' },
    def: fn('get_token_price', 'Get current price and price history of a crypto token (BTC, ETH, SOL...). Shows a chart to the user.', {
      symbol: { type: 'string', description: 'Token ticker, e.g. BTC' },
      time_range: { type: 'string', enum: ['1d', '7d', '30d', '90d', '180d', '365d'], description: 'History window' },
    }, ['symbol', 'time_range']),
    async run({ symbol, time_range }) {
      const sym = String(symbol || 'BTC').toUpperCase()
      const r = await dataApi.market.price({ symbol: sym, time_range: time_range || '7d' })
      const pts = (r?.data || []).filter((d) => typeof d?.value === 'number').sort((a, b) => a.timestamp - b.timestamp)
      if (!pts.length) return { result: { error: `No price data for ${sym}` } }
      const s = r.summary || {}
      return {
        result: { symbol: sym, time_range, summary: s, sample: downsample(pts, 12).map((p) => [p.timestamp, p.value]) },
        widget: { type: 'price_chart', symbol: sym, time_range, summary: s, points: downsample(pts, 120).map((p) => [p.timestamp, p.value]) },
      }
    },
  },

  get_market_ranking: {
    label: { vi: 'Đang xem bảng xếp hạng thị trường', en: 'Checking market rankings' },
    def: fn('get_market_ranking', 'Token leaderboard: top by market cap, top gainers/losers (24h) or volume, optional category.', {
      sort_by: { type: 'string', enum: ['market_cap', 'top_gainers', 'top_losers', 'volume'] },
      category: { type: 'string', enum: ['ALL', 'MEME', 'AI', 'AI_AGENTS', 'L1', 'L2', 'DEFI', 'GAMING', 'STABLECOIN', 'RWA', 'DEPIN', 'SOL_ECO', 'BASE_ECO', 'LST'] },
      limit: { type: 'integer', minimum: 3, maximum: 20 },
    }, ['sort_by', 'category', 'limit']),
    async run({ sort_by, category, limit }) {
      const map = { market_cap: ['market_cap', 'desc'], top_gainers: ['change_24h', 'desc'], top_losers: ['change_24h', 'asc'], volume: ['volume_24h', 'desc'] }
      const [field, order] = map[sort_by] || map.market_cap
      const params = { sort_by: field, order, limit: Math.min(Math.max(limit || 10, 3), 20) }
      if (category && category !== 'ALL') params.category = category
      const r = await dataApi.market.ranking(params)
      const rows = (r?.data || []).map((d) => ({
        rank: d.rank, symbol: d.symbol, name: d.name, image: d.image, price: d.price_usd,
        change_24h: d.change_24h_pct, market_cap: d.market_cap_usd, volume_24h: d.volume_24h_usd,
      }))
      return { result: { sort_by: sort_by || 'market_cap', category: category || 'ALL', rows: rows.map(({ image, ...x }) => x) }, widget: { type: 'ranking', sort_by: sort_by || 'market_cap', category: category || 'ALL', rows } }
    },
  },

  get_crypto_news: {
    label: { vi: 'Đang đọc tin tức', en: 'Reading the news' },
    def: fn('get_crypto_news', 'Latest or trending crypto news, optionally about a project (e.g. "bitcoin", "ethereum", "circle").', {
      project: { type: 'string', description: 'Project name, empty for all' },
      sort_by: { type: 'string', enum: ['recency', 'trending'] },
      limit: { type: 'integer', minimum: 3, maximum: 10 },
    }, ['project', 'sort_by', 'limit']),
    async run({ project, sort_by, limit }) {
      const params = { sort_by: sort_by || 'recency', limit: Math.min(limit || 6, 10) }
      let r
      if (project) r = await dataApi.search.news({ q: project, limit: params.limit }).catch(() => null)
      if (!r?.data?.length) r = await dataApi.news.feed(project ? { ...params, project } : params).catch(() => dataApi.news.feed(params))
      const items = (r?.data || []).map((n) => ({ id: n.id, title: n.title, summary: clip(n.summary, 400), source: n.source, url: n.url, published_at: n.published_at, project: n.project_name }))
      return { result: { items }, widget: { type: 'news', items } }
    },
  },

  web_search: {
    label: { vi: 'Đang tìm trên web', en: 'Searching the web' },
    def: fn('web_search', 'Search the web for any topic. Use for facts, docs, events not covered by other tools.', {
      query: { type: 'string' },
    }, ['query']),
    async run({ query }) {
      const r = await dataApi.search.web({ q: query, limit: 6 })
      const items = (r?.data || []).map((d) => ({ title: d.title, url: d.url, description: clip(d.description, 300) }))
      return { result: { query, items }, widget: { type: 'web_results', query, items } }
    },
  },

  read_webpage: {
    label: { vi: 'Đang đọc trang web', en: 'Reading a web page' },
    def: fn('read_webpage', 'Fetch a web page and read its content as markdown.', { url: { type: 'string' } }, ['url']),
    async run({ url }) {
      if (!isPublicHttpUrl(url)) return { result: { error: 'Only normal public web pages (http/https links, max 2000 characters) can be read.' } }
      const r = await dataApi.web.fetch({ url, timeout: 20000 })
      return { result: { url, title: r?.data?.title, content: clip(r?.data?.content || '', 9000) } }
    },
  },

  search_project: {
    label: { vi: 'Đang tra cứu dự án', en: 'Looking up project' },
    def: fn('search_project', 'Crypto project profiles: description, sector, chains, token status (launched or not, TGE), funding rounds and total raised, investors/backers, team, official website and socials, official contract addresses. Pass a project name to look it up (fuzzy: "kast.xyz", "$KAST" work), or null to list projects recently funded by top-tier funds.', {
      query: { type: ['string', 'null'], description: 'Project name, ticker or website; null = recently funded projects' },
    }, ['query']),
    async run({ query }) {
      const q = String(query || '').trim()
      const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : null)
      const rows = q ? await projects.search(q) : (await projects.list()).items.slice(0, 8).map(projects.card)
      const top = rows.slice(0, q ? 3 : 6)
      if (!top.length) return { result: { count: 0, note: 'No project found with this name. Say so honestly; you may web_search for news, but do not invent facts.' } }
      let profile = null
      if (q) {
        const p = await projects.projectInfo(top[0].id).catch(() => null)
        const extra = p ? await enrich(p).catch(() => null) : null
        if (p) profile = {
          name: p.name, symbol: p.symbol, description: clip(p.description, 900), sectors: p.tags, chains: p.chains, website: p.website, x: p.x_handle ? `@${p.x_handle}` : null, x_followers: p.x_followers,
          token_status: p.tge_status === 'post' ? 'launched' : p.tge_status === 'upcoming' ? 'launching soon' : p.tge_status === 'pre' ? 'not launched yet' : 'unknown', token_event_date: day(p.tge_time), listed_on: p.exchanges,
          total_raised_usd: p.total_raise, rounds: p.rounds.slice(0, 6).map((r) => ({ round: r.name, amount_usd: r.amount, date: day(r.date), valuation_usd: r.valuation || undefined, investors: r.investors.map((i) => i.name + (i.lead ? ' (lead)' : '')) })),
          official_links: (extra?.links || []).map((l) => l.url),
          // Only X accounts that were checked against the live profile are given to the model.
          team: (extra?.team || p.team).slice(0, 6).map((m) => `${m.name}${m.role ? ` — ${m.role}` : ''}${extra && m.x_handle ? ` (X: @${m.x_handle})` : ''}`), contracts: p.contracts.slice(0, 4),
        }
      }
      const brief = (x) => ({ name: x.name, symbol: x.symbol, sectors: x.tags, summary: clip(x.summary, 240), latest_raise_usd: x.last_raise, latest_raise_date: day(x.raised_at), backers: x.backers })
      return {
        result: { count: rows.length, profile, items: top.map(brief), note: 'Present facts only. Makoto does not track airdrops, tasks or reward campaigns: never list farming tasks or steps.' },
        widget: { type: 'projects', query: q || null, total: rows.length, items: top },
      }
    },
  },

  get_fear_greed: {
    label: { vi: 'Đang đo tâm lý thị trường', en: 'Measuring market sentiment' },
    def: fn('get_fear_greed', 'Crypto Fear & Greed index (current and last 30 days).', {}, []),
    async run() {
      const from = Math.floor(Date.now() / 1000) - 31 * 86400
      const r = await dataApi.market.fear_greed({ from: String(from) })
      const items = (r?.data || []).sort((a, b) => a.timestamp - b.timestamp)
      const last = items[items.length - 1]
      return {
        result: { current: last, week_ago: items[items.length - 8], month_ago: items[0] },
        widget: { type: 'fear_greed', value: last?.value, classification: last?.classification, history: items.map((d) => [d.timestamp, d.value]) },
      }
    },
  },

  check_call: {
    label: { vi: 'Đang xác minh thông tin', en: 'Verifying the signal' },
    def: fn('check_call', 'Fact-check a crypto "call", shill or promo message, or a token (ticker or contract address), for scam / pump-and-dump risk: verifies claims (listings, investors, team), holder concentration, unlocks, token age, liquidity, and gives a trust score. Use whenever the user pastes a call/tip/presale invite, or asks whether a token or project is legit, safe, a scam or a rug. Shows a verdict card.', {
      text: { type: 'string', description: 'The full message to check, verbatim (or just the ticker / contract address)' },
    }, ['text']),
    async run({ text }, ctx) {
      const r = await runVerify(String(text || '').slice(0, 3000), ctx.lang === 'en' ? 'en' : 'vi', () => {}, { profile: ctx.profile })
      const ev = { ...r.evidence, page: r.evidence.page ? { url: r.evidence.page.url, title: r.evidence.page.title } : null }
      const { spark, ...dex } = ev.dex || {}
      return {
        result: { ...r, evidence: { ...ev, dex: ev.dex ? dex : null, news: (ev.news || []).slice(0, 3) } },
        widget: { type: 'verdict', ...r, evidence: ev },
      }
    },
  },

  arc_wallet: {
    label: { vi: 'Đang đọc ví trên Arc', en: 'Reading wallet on Arc' },
    def: fn('arc_wallet', 'Read an Arc Testnet wallet: USDC balance, token balances and recent transactions. Use "me" for the user\'s connected wallet.', {
      address: { type: 'string', description: '0x address or "me"' },
    }, ['address']),
    async run({ address }, ctx) {
      const addr = !address || address === 'me' ? ctx.address : address
      if (!addr) return { result: { error: 'The user has not connected a wallet yet. Tell them to connect one in Settings → Connections, or give a wallet address.' } }
      if (!arc.isAddress(addr)) return { result: { error: 'Invalid address' } }
      const [bal, tokens, txs] = await Promise.all([
        arc.getBalance(addr),
        arc.getTokenBalances(addr).catch(() => []),
        arc.getAddressTransactions(addr, 8).catch(() => []),
      ])
      const data = { address: addr, usdc: bal.usdc, tokens, transactions: txs, explorer: `${ARC.explorer}/address/${addr}` }
      return { result: data, widget: { type: 'arc_wallet', ...data } }
    },
  },

  arc_transaction: {
    label: { vi: 'Đang tra giao dịch trên Arc', en: 'Looking up Arc transaction' },
    def: fn('arc_transaction', 'Look up a transaction on Arc Testnet by hash.', { hash: { type: 'string' } }, ['hash']),
    async run({ hash }) {
      if (!arc.isHash(hash)) return { result: { error: 'Invalid transaction hash' } }
      const { tx, receipt } = await arc.getTransaction(hash)
      const { formatEther } = require('viem')
      const data = {
        hash, from: tx.from, to: tx.to, value_usdc: formatEther(tx.value), block: Number(tx.blockNumber ?? 0),
        status: receipt?.status ?? 'pending', gas_used: receipt ? Number(receipt.gasUsed) : null,
        fee_usdc: receipt ? formatEther(receipt.gasUsed * (receipt.effectiveGasPrice || 0n)) : null,
        explorer: `${ARC.explorer}/tx/${hash}`,
      }
      return { result: data, widget: { type: 'arc_tx', ...data } }
    },
  },

  arc_network: {
    label: { vi: 'Đang kiểm tra mạng Arc', en: 'Checking Arc network' },
    def: fn('arc_network', 'Live Arc Testnet stats: latest block, gas price, total transactions, utilization.', {}, []),
    async run() {
      const data = await arc.getNetworkStatus()
      return { result: data, widget: { type: 'arc_network', ...data } }
    },
  },
}

const toolDefs = Object.values(TOOLS).map((t) => t.def)

async function runTool(name, args, ctx) {
  const tool = TOOLS[name]
  if (!tool) return { result: { error: `Unknown tool ${name}` } }
  try {
    return await tool.run(args || {}, ctx)
  } catch (e) {
    return { result: { error: e?.message || 'Tool failed' } }
  }
}

const toolLabel = (name, lang) => TOOLS[name]?.label?.[lang] || name

module.exports = { toolDefs, runTool, toolLabel }
