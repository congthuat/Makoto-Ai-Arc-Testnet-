import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Search, ArrowDownLeft, ArrowUpRight, Repeat, FileCode2, ExternalLink, Sparkles, Copy, Activity, Coins, Clock, Fuel, AlertCircle, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { openConnections } from './Connections'
import { useI18n } from '@/lib/i18n'
import { ARC, shortAddr } from '@/lib/wallet'
import { fmtNum, timeAgo } from '@/lib/format'
import { AnimatedNumber } from './Brand'
import { AddressAvatar } from './Sidebar'

type Tx = { hash: string; time: string; from: string | null; to: string | null; direction: 'in' | 'out' | 'self'; kind: 'transfer' | 'contract' | 'create'; method: string | null; to_name: string | null; value_usdc: number; fee_usdc: number | null; ok: boolean }
type WalletData = { address: string; usdc: number; is_contract: boolean; name: string | null; tx_count: number | null; transfer_count: number | null; tokens: { symbol: string; name: string; address: string; balance: number }[]; transactions: Tx[]; last_active: string | null; fees_recent: number }

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim())

/** Turn contract method names into plain words. */
function methodLabel(m: string | null, vi: boolean) {
  if (!m) return null
  const map: [RegExp, string, string][] = [
    [/bridge/i, 'Bridge', 'Bridge'],
    [/^approve$/i, 'Cấp quyền token', 'Token approval'],
    [/^transfer(from)?$/i, 'Chuyển token', 'Token transfer'],
    [/swap/i, 'Swap', 'Swap'],
    [/deposit/i, 'Nạp', 'Deposit'],
    [/withdraw/i, 'Rút', 'Withdraw'],
    [/mint/i, 'Mint', 'Mint'],
    [/stake/i, 'Stake', 'Stake'],
  ]
  for (const [re, v, e] of map) if (re.test(m)) return vi ? v : e
  return m.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())
}

function TxRow({ t, vi }: { t: Tx; vi: boolean }) {
  const label = t.kind === 'create' ? (vi ? 'Tạo hợp đồng' : 'Contract created') : t.kind === 'contract' ? methodLabel(t.method, vi) || (vi ? 'Gọi hợp đồng' : 'Contract call') : t.direction === 'in' ? (vi ? 'Nhận USDC' : 'Received USDC') : t.direction === 'self' ? (vi ? 'Tự chuyển' : 'Self transfer') : vi ? 'Gửi USDC' : 'Sent USDC'
  const Icon = t.kind !== 'transfer' ? FileCode2 : t.direction === 'in' ? ArrowDownLeft : t.direction === 'self' ? Repeat : ArrowUpRight
  const tone = t.kind !== 'transfer' ? 'text-violet-300 bg-violet-400/10' : t.direction === 'in' ? 'text-emerald-300 bg-emerald-400/10' : 'text-zinc-300 bg-white/[0.06]'
  const counter = t.direction === 'in' ? t.from : t.to
  return (
    <a href={`${ARC.explorer}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="group flex items-center gap-3 border-b border-white/[0.04] px-4 py-3 transition last:border-0 hover:bg-white/[0.025]">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-zinc-100">
          <span className="truncate">{label}</span>
          {!t.ok && <span className="rounded bg-rose-400/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">{vi ? 'Thất bại' : 'Failed'}</span>}
        </div>
        <div className="truncate text-xs text-zinc-500">
          {t.direction === 'in' ? (vi ? 'Từ ' : 'From ') : vi ? 'Đến ' : 'To '}
          <span className="font-mono">{t.to_name && t.direction !== 'in' ? t.to_name : shortAddr(counter || '')}</span> · {timeAgo(t.time, vi ? 'vi' : 'en')}
        </div>
      </div>
      <div className="text-right">
        {t.value_usdc > 0 ? (
          <div className={`text-sm font-medium tabular-nums ${t.direction === 'in' ? 'text-emerald-300' : 'text-zinc-200'}`}>{t.direction === 'in' ? '+' : '−'}{fmtNum(t.value_usdc, 4)} USDC</div>
        ) : <div className="text-sm text-zinc-600">—</div>}
        {t.fee_usdc != null && t.direction !== 'in' && <div className="text-[11px] text-zinc-600">{vi ? 'phí' : 'fee'} {fmtNum(t.fee_usdc, 5)}</div>}
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition group-hover:text-zinc-400" />
    </a>
  )
}

export function WalletView({ onAsk }: { onAsk: (text: string) => void }) {
  const { me } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const mine = me?.user.wallet || ''
  const [target, setTarget] = useState(mine)
  const [input, setInput] = useState('')
  useEffect(() => { if (mine && !target) setTarget(mine) }, [mine, target])

  const { data: pk } = useQuery<{ treasury: string }>({ queryKey: ['packages'], queryFn: () => fetch(api('payments/packages')).then((r) => r.json()) })
  const { data, isLoading, isError, refetch, isFetching } = useQuery<WalletData>({
    queryKey: ['arc-wallet', target.toLowerCase()],
    enabled: isAddr(target),
    queryFn: async () => {
      const r = await fetch(api(`arc/wallet/${target}`))
      if (!r.ok) throw new Error('failed')
      return r.json()
    },
    refetchInterval: 30_000,
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (!isAddr(v)) { toast.error(vi ? 'Địa chỉ ví không hợp lệ (0x… 42 ký tự)' : 'Invalid address (0x…, 42 chars)'); return }
    setTarget(v); setInput('')
  }
  const isMine = Boolean(mine) && target.toLowerCase() === mine.toLowerCase()
  const chip = (active: boolean) => `min-h-9 rounded-full border px-3 py-1.5 text-xs transition md:min-h-0 md:py-1 ${active ? 'border-teal-300/40 bg-teal-300/[0.08] text-teal-100' : 'border-white/[0.08] text-zinc-400 hover:text-white'}`

  const stats = data && [
    { icon: Activity, l: vi ? 'Tổng giao dịch' : 'Transactions', v: data.tx_count != null ? fmtNum(data.tx_count, 0) : '—' },
    { icon: Repeat, l: vi ? 'Lượt chuyển token' : 'Token transfers', v: data.transfer_count != null ? fmtNum(data.transfer_count, 0) : '—' },
    { icon: Clock, l: vi ? 'Hoạt động gần nhất' : 'Last active', v: data.last_active ? timeAgo(data.last_active, vi ? 'vi' : 'en') : vi ? 'Chưa có' : 'Never' },
    { icon: Fuel, l: vi ? 'Phí gas (25 GD gần nhất)' : 'Gas paid (last 25 txs)', v: `${fmtNum(data.fees_recent, 4)} USDC` },
  ]

  return (
    <div className="mk-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">{vi ? 'Ví trên Arc' : 'Arc wallets'}</h1>
        <p className="mt-1.5 text-sm text-zinc-400">{vi ? 'Xem số dư, token và hoạt động của bất kỳ ví nào trên Arc Testnet. Miễn phí.' : 'See balance, tokens and activity of any wallet on Arc Testnet. Free.'}</p>

        <form onSubmit={submit} className="mt-6 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-1.5 pl-4 focus-within:border-teal-300/35">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={vi ? 'Dán địa chỉ ví 0x…' : 'Paste a 0x… address'} aria-label={vi ? 'Địa chỉ ví' : 'Wallet address'} className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm text-white placeholder:font-sans placeholder:text-zinc-600 focus:outline-none" spellCheck={false} />
          <button type="submit" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_0_24px_rgba(94,234,212,.35)]">{vi ? 'Xem' : 'View'}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => (mine ? setTarget(mine) : openConnections())} className={chip(isMine)}>{vi ? 'Ví của tôi' : 'My wallet'}</button>
          {pk?.treasury && <button onClick={() => setTarget(pk.treasury)} className={chip(target.toLowerCase() === pk.treasury.toLowerCase())}>{vi ? 'Ví kho bạc Makoto' : 'Makoto treasury'}</button>}
        </div>

        {!target && (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-white">{vi ? 'Bạn chưa kết nối ví' : 'No wallet connected yet'}</div>
              <div className="mt-1 text-sm text-zinc-400">{vi ? 'Dán bất kỳ địa chỉ nào ở trên để xem, hoặc kết nối ví của bạn để xem nhanh mỗi lần.' : 'Paste any address above, or connect your wallet to see it here every time.'}</div>
            </div>
            <button onClick={openConnections} className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_0_24px_rgba(94,234,212,.35)]">{vi ? 'Kết nối ví' : 'Connect wallet'}</button>
          </div>
        )}
        {isLoading && (
          <div className="mt-6 space-y-3">
            <div className="mk-skel h-36 rounded-3xl" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="mk-skel h-20 rounded-2xl" />)}</div>
            <div className="mk-skel h-64 rounded-2xl" />
          </div>
        )}
        {isError && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.04] p-4 text-sm text-rose-100">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{vi ? 'Không đọc được dữ liệu từ mạng Arc lúc này.' : "Couldn't reach the Arc network right now."}</span>
            <button onClick={() => refetch()} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white hover:bg-white/5">{vi ? 'Thử lại' : 'Retry'}</button>
          </div>
        )}

        {data && (
          <motion.div key={data.address} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-3">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-teal-300/[0.07] via-[#0b0c14] to-violet-500/[0.08] p-6">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AddressAvatar address={data.address} size={40} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white">{shortAddr(data.address)}</span>
                      <button onClick={() => { navigator.clipboard.writeText(data.address); toast.success(vi ? 'Đã sao chép' : 'Copied') }} aria-label={vi ? 'Sao chép địa chỉ' : 'Copy address'} className="text-zinc-500 hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                      <a href={`${ARC.explorer}/address/${data.address}`} target="_blank" rel="noreferrer" aria-label={vi ? "Xem trên trình khám phá Arc" : "View on Arc explorer"} className="text-zinc-500 hover:text-white"><ExternalLink className="h-3.5 w-3.5" /></a>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px]">
                      {isMine && <span className="rounded-full bg-teal-300/10 px-2 py-0.5 text-teal-200">{vi ? 'Ví của bạn' : 'Your wallet'}</span>}
                      {data.is_contract && <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-200">{vi ? 'Hợp đồng' : 'Contract'}{data.name ? ` · ${data.name}` : ''}</span>}
                      <span className="flex items-center gap-1 text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{ARC.name}{isFetching && ' · …'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => onAsk(vi ? `Phân tích ví ${data.address} trên Arc: số dư, token, các giao dịch gần đây và ví này thường làm gì` : `Analyze wallet ${data.address} on Arc: balance, tokens, recent transactions and what this wallet typically does`)} className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:shadow-[0_0_24px_rgba(94,234,212,.35)]">
                  <Sparkles className="h-3.5 w-3.5" />{vi ? 'Nhờ Makoto phân tích' : 'Ask Makoto to analyze'}
                </button>
              </div>
              <div className="relative mt-6">
                <div className="text-xs text-zinc-400">{vi ? 'Số dư USDC (dùng làm gas)' : 'USDC balance (also gas)'}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <AnimatedNumber value={data.usdc} decimals={4} className="text-4xl font-semibold tracking-tight text-white" />
                  <span className="text-zinc-400">USDC</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats!.map((s) => (
                <div key={s.l} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <s.icon className="h-4 w-4 text-zinc-500" />
                  <div className="mt-2 text-lg font-semibold tracking-tight text-white">{s.v}</div>
                  <div className="text-[11px] text-zinc-500">{s.l}</div>
                </div>
              ))}
            </div>

            {data.tokens.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <div className="flex items-center gap-2 px-4 pb-1 pt-3.5 text-[13px] font-medium text-zinc-400"><Coins className="h-3.5 w-3.5" />{vi ? 'Token đang nắm giữ' : 'Token holdings'}</div>
                <div className="grid gap-1 p-2 sm:grid-cols-2">
                  {data.tokens.map((tk) => (
                    <a key={tk.address} href={`${ARC.explorer}/token/${tk.address}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.03]">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-300/25 to-violet-500/25 text-[10px] font-semibold text-white">{tk.symbol.slice(0, 4)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white">{tk.symbol}</div>
                        <div className="truncate text-[11px] text-zinc-500">{tk.name}</div>
                      </div>
                      <div className="text-sm tabular-nums text-zinc-200">{fmtNum(tk.balance, 4)}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
                <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-400"><Activity className="h-3.5 w-3.5" />{vi ? 'Hoạt động gần đây' : 'Recent activity'}</span>
                <a href={`${ARC.explorer}/address/${data.address}`} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-white">{vi ? 'Xem tất cả' : 'View all'} ↗</a>
              </div>
              {data.transactions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-zinc-500">
                  <Wallet className="h-6 w-6 text-zinc-600" />
                  {vi ? 'Ví này chưa có giao dịch nào.' : 'No transactions yet.'}
                  {isMine && <a href={ARC.faucet} target="_blank" rel="noreferrer" className="text-teal-300 hover:underline">{vi ? 'Nhận USDC testnet miễn phí →' : 'Get free testnet USDC →'}</a>}
                </div>
              ) : data.transactions.map((t) => <TxRow key={t.hash} t={t} vi={vi} />)}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
