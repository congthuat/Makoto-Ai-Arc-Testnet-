import { motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Sparkles, Wallet, TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, FileCode2 } from 'lucide-react'
import { api } from '@/lib/api'
import { usePalette } from '@/lib/theme'
import { AnimatedNumber } from '../Brand'
import { EASE, SectionHeader, useVi } from './shared'
import { Tile, IllustrativeTag, LiveTag } from './Bento'

/* ---------- Watchlist (illustrative shapes, no prices) ---------- */

const SHAPES: { sym: string; up: boolean; d: number[] }[] = [
  { sym: 'BTC', up: true, d: [8, 10, 9, 12, 11, 14, 13, 16, 15, 18] },
  { sym: 'ETH', up: true, d: [10, 9, 11, 10, 12, 12, 14, 13, 15, 16] },
  { sym: 'SOL', up: false, d: [16, 15, 16, 13, 14, 12, 12, 10, 11, 9] },
]

function Spark({ d, up, delay }: { d: number[]; up: boolean; delay: number }) {
  const P = usePalette()
  const W = 80, H = 24
  const min = Math.min(...d), max = Math.max(...d)
  const path = d.map((v, i) => `${i ? 'L' : 'M'}${((i / (d.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min)) * (H - 4)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-20" aria-hidden>
      <motion.path d={path} fill="none" stroke={up ? P.up : P.down} strokeWidth="1.6" strokeLinejoin="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay, duration: 1, ease: EASE }} />
    </svg>
  )
}

function WatchVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-6 pt-7">
      {SHAPES.map((s, i) => (
        <motion.div key={s.sym} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: EASE }} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-teal-300/30 to-violet-500/30 text-[9px] font-semibold text-white">{s.sym.slice(0, 2)}</span>
          <span className="w-9 text-xs font-semibold text-white">{s.sym}</span>
          <span className="ml-auto"><Spark d={s.d} up={s.up} delay={0.3 + i * 0.12} /></span>
          {s.up ? <TrendingUp className="h-3.5 w-3.5 text-emerald-300" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-300" />}
        </motion.div>
      ))}
    </div>
  )
}

/* ---------- Daily briefing (illustrative layout) ---------- */

function BriefVisual() {
  const vi = useVi()
  return (
    <div className="flex h-full items-center px-6 pt-7">
      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }} className="w-full rounded-2xl border border-white/[0.07] bg-gradient-to-br from-teal-300/[0.06] to-violet-500/[0.06] p-3.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-medium text-teal-200"><Sparkles className="h-3 w-3" />{vi ? 'Bản tin hôm nay' : "Today's briefing"}</span>
          <span className="rounded-full border border-white/15 px-1.5 py-px text-[9px] text-zinc-300">{vi ? 'Trung lập' : 'Neutral'}</span>
        </div>
        <div className="mt-2.5 h-2.5 w-4/5 rounded-full bg-white/70" />
        <div className="mt-2 space-y-1.5">
          {[92, 78, 85].map((w, i) => (
            <motion.div key={i} initial={{ width: 0 }} whileInView={{ width: `${w}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease: EASE }} className="flex h-1.5 items-center gap-1.5">
              <span className="h-1 w-1 shrink-0 rounded-full bg-teal-300" /><span className="h-1.5 flex-1 rounded-full bg-white/[0.14]" />
            </motion.div>
          ))}
        </div>
        <div className="relative mt-3 h-1 rounded-full bg-gradient-to-r from-rose-400/60 via-zinc-400/50 to-emerald-400/60">
          <motion.span initial={{ left: '10%' }} whileInView={{ left: '52%' }} viewport={{ once: true }} transition={{ delay: 0.6, duration: 1, ease: EASE }} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b0c14] bg-white" />
        </div>
      </motion.div>
    </div>
  )
}

/* ---------- Arc wallet explorer (real data: Makoto treasury) ---------- */

type W = { usdc: number; tx_count: number | null; transactions: { hash: string; direction: string; kind: string }[] }

function WalletVisual() {
  const vi = useVi()
  const { data: pk } = useQuery<{ treasury?: string }>({
    queryKey: ['packages'],
    queryFn: () => fetch(api('payments/packages')).then((r) => r.json()),
  })
  const { data } = useQuery<W>({
    queryKey: ['arc-wallet', pk?.treasury?.toLowerCase()],
    enabled: Boolean(pk?.treasury),
    queryFn: () => fetch(api(`arc/wallet/${pk!.treasury}`)).then((r) => { if (!r.ok) throw new Error(); return r.json() }),
    refetchInterval: 30_000,
  })
  return (
    <div className="flex h-full flex-col justify-center px-6">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{vi ? 'Ví kho bạc Makoto · Arc' : 'Makoto treasury · Arc'}</div>
      <div className="mt-1 flex items-baseline gap-1.5 font-mono text-2xl font-medium text-white">
        {data ? <AnimatedNumber value={data.usdc} decimals={2} /> : <span className="mk-skel inline-block h-7 w-24" />}
        <span className="text-xs text-zinc-500">USDC</span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {(data?.transactions || []).slice(0, 6).map((t, i) => {
          const Icon = t.kind !== 'transfer' ? FileCode2 : t.direction === 'in' ? ArrowDownLeft : ArrowUpRight
          return (
            <motion.span key={t.hash} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.kind !== 'transfer' ? 'bg-violet-400/10 text-violet-300' : t.direction === 'in' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[0.06] text-zinc-300'}`}>
              <Icon className="h-3.5 w-3.5" />
            </motion.span>
          )
        })}
      </div>
      {data?.tx_count != null && <div className="mt-2 text-[11px] text-zinc-500">{data.tx_count.toLocaleString('en-US')} {vi ? 'giao dịch' : 'transactions'}</div>}
    </div>
  )
}

export function Daily() {
  const vi = useVi()
  return (
    <section id="daily" className="mx-auto max-w-6xl scroll-mt-3 px-5 py-20 md:px-6 md:py-24">
      <SectionHeader
        eyebrow={vi ? 'Hằng ngày' : 'Daily'}
        title={vi ? 'Thông tin quan trọng, sẵn sàng mỗi ngày' : 'What matters, ready every day'}
        sub={vi ? 'Danh sách theo dõi và bản tin thị trường được cá nhân hóa, cập nhật tự động. Miễn phí cho mọi tài khoản.' : 'A personalized watchlist and market briefing, updated automatically. Free for every account.'}
      />
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        <Tile visual={<WatchVisual />} tag={<IllustrativeTag />} icon={Eye} title={vi ? 'Danh sách theo dõi' : 'Watchlist'} body={vi ? 'Theo dõi tối đa 12 token với giá, biến động 24 giờ và xu hướng 7 ngày.' : 'Track up to 12 tokens with price, 24h change and 7-day trend.'} />
        <Tile delay={0.06} visual={<BriefVisual />} tag={<IllustrativeTag />} icon={Sparkles} title={vi ? 'Bản tin thị trường' : 'Market briefing'} body={vi ? 'Diễn biến chính, chỉ số Sợ hãi & Tham lam, nhận định cho từng token bạn theo dõi và tin nổi bật.' : 'Key moves, Fear & Greed, a note on each token you track and top stories.'} />
        <Tile delay={0.12} visual={<WalletVisual />} tag={<LiveTag />} icon={Wallet} title={vi ? 'Tra cứu ví trên Arc' : 'Arc wallet explorer'} body={vi ? 'Số dư, token và lịch sử giao dịch của bất kỳ địa chỉ nào, kèm phân tích từ Makoto.' : 'Balance, tokens and activity for any address, with analysis from Makoto.'} />
      </div>
    </section>
  )
}
