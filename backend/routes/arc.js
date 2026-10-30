const { withErrorHandler } = require('../lib/safe')
const { Router } = require('express')
const { getNetworkStatus, getBalance, getTokenBalances, explorer, isAddress } = require('../lib/arc')
const { formatEther } = require('viem')

const router = Router()
let cache = { at: 0, data: null }

// Public live Arc Testnet stats (cached 10s)
router.get('/', async (_req, res) => {
  try {
    if (!cache.data || Date.now() - cache.at > 10_000) {
      cache = { at: Date.now(), data: await getNetworkStatus() }
    }
    res.json(cache.data)
  } catch (e) {
    res.status(502).json({ error: 'Arc network is unreachable right now' })
  }
})

const walletCache = new Map()

// Public wallet overview for any Arc Testnet address (cached 20s)
router.get('/wallet/:address', require('../lib/ratelimit').limit('wallet', 40, 60_000), async (req, res) => {
  const addr = String(req.params.address || '').trim()
  if (!isAddress(addr)) return res.status(400).json({ error: 'invalid_address' })
  const key = addr.toLowerCase()
  const hit = walletCache.get(key)
  if (hit && Date.now() - hit.at < 20_000) return res.json(hit.data)
  try {
    const [bal, info, counters, tokens, txs] = await Promise.all([
      getBalance(addr),
      explorer(`addresses/${addr}`).catch(() => null),
      explorer(`addresses/${addr}/counters`).catch(() => null),
      getTokenBalances(addr).catch(() => []),
      explorer(`addresses/${addr}/transactions`).then((d) => d?.items || []).catch(() => []),
    ])
    const transactions = txs.slice(0, 25).map((t) => {
      const from = t.from?.hash?.toLowerCase() || null
      const to = t.to?.hash?.toLowerCase() || null
      const types = t.transaction_types || []
      return {
        hash: t.hash,
        time: t.timestamp,
        from, to,
        direction: from === key && to === key ? 'self' : from === key ? 'out' : 'in',
        kind: types.includes('contract_creation') ? 'create' : types.includes('contract_call') ? 'contract' : 'transfer',
        method: t.method && !/^0x[0-9a-f]{8}$/i.test(t.method) ? t.method : null,
        to_name: t.to?.name || null,
        value_usdc: t.value ? Number(formatEther(BigInt(t.value))) : 0,
        fee_usdc: t.fee?.value ? Number(formatEther(BigInt(t.fee.value))) : null,
        ok: t.status === 'ok',
      }
    })
    const data = {
      address: addr,
      usdc: Number(bal.usdc),
      is_contract: Boolean(info?.is_contract),
      name: info?.name || null,
      tx_count: counters?.transactions_count != null ? Number(counters.transactions_count) : null,
      transfer_count: counters?.token_transfers_count != null ? Number(counters.token_transfers_count) : null,
      tokens: tokens.filter((t) => t.balance > 0),
      transactions,
      first_seen: transactions.length ? transactions[transactions.length - 1].time : null,
      last_active: transactions[0]?.time || null,
      fees_recent: transactions.reduce((a, t) => a + (t.direction !== 'in' && t.fee_usdc ? t.fee_usdc : 0), 0),
    }
    walletCache.set(key, { at: Date.now(), data })
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: 'Arc network is unreachable right now' })
  }
})

// Also installs the app-wide error handler (no stack traces to clients).
module.exports = withErrorHandler(router)
