const { createPublicClient, http, defineChain, formatEther, isAddress, isHash } = require('viem')
const { ARC } = require('./config')

const arcTestnet = defineChain({
  id: ARC.chainId,
  name: ARC.name,
  nativeCurrency: ARC.nativeCurrency,
  rpcUrls: { default: { http: [ARC.rpcUrl] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: ARC.explorer } },
})

const client = createPublicClient({ chain: arcTestnet, transport: http(ARC.rpcUrl, { timeout: 15000 }) })

async function explorer(path) {
  const res = await fetch(`${ARC.explorer}/api/v2/${path}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Arc explorer ${res.status}`)
  return res.json()
}

async function getBalance(address) {
  const wei = await client.getBalance({ address })
  return { wei: wei.toString(), usdc: formatEther(wei) }
}

async function getNetworkStatus() {
  const [block, gasPrice, stats] = await Promise.all([
    client.getBlock(),
    client.getGasPrice(),
    explorer('stats').catch(() => null),
  ])
  return {
    chain: ARC.name,
    chain_id: ARC.chainId,
    latest_block: Number(block.number),
    block_time: Number(block.timestamp),
    txs_in_block: block.transactions?.length ?? 0,
    gas_price_gwei: Number(gasPrice) / 1e9,
    total_transactions: stats?.total_transactions ?? null,
    total_addresses: stats?.total_addresses ?? null,
    transactions_today: stats?.transactions_today ?? null,
    network_utilization_pct: stats?.network_utilization_percentage ?? null,
  }
}

async function getTransaction(hash) {
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }).catch(() => null),
  ])
  return { tx, receipt }
}

async function getAddressTransactions(address, limit = 10) {
  const data = await explorer(`addresses/${address}/transactions`)
  return (data?.items || []).slice(0, limit).map((t) => ({
    hash: t.hash,
    time: t.timestamp,
    from: t.from?.hash,
    to: t.to?.hash,
    value_usdc: t.value ? formatEther(BigInt(t.value)) : '0',
    method: t.method || t.decoded_input?.method_call?.split('(')[0] || null,
    status: t.status,
    fee_usdc: t.fee?.value ? formatEther(BigInt(t.fee.value)) : null,
  }))
}

async function getTokenBalances(address) {
  const data = await explorer(`addresses/${address}/token-balances`).catch(() => [])
  return (Array.isArray(data) ? data : []).slice(0, 20).map((b) => {
    const dec = Number(b.token?.decimals ?? 18)
    const raw = b.value ? Number(BigInt(b.value)) / 10 ** dec : 0
    return { symbol: b.token?.symbol ?? '?', name: b.token?.name ?? '', address: b.token?.address_hash ?? b.token?.address, balance: raw }
  })
}

module.exports = { client, arcTestnet, explorer, getBalance, getNetworkStatus, getTransaction, getAddressTransactions, getTokenBalances, isAddress, isHash }
