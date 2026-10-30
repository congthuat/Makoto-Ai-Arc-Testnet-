import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { Blocks, Building2, Check, Clock, Gauge, Globe, Newspaper, Search, ShieldCheck, TrendingUp, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { AnimatedNumber, SpotlightCard } from '../Brand'
import { DemoTag, EASE, LiveDot, SectionHeader, fadeUpDelay, sleep, toNum, useArcStatus, useVi } from './shared'

/* ---------- Tile shell ---------- */

export function Tile({ className = '', delay = 0, visual, tag, icon: Icon, title, body }: {
  className?: string
  delay?: number
  visual: ReactNode
  tag?: ReactNode
  icon: ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <motion.div {...fadeUpDelay(delay)} className={className}>
      <SpotlightCard className="h-full">
        <div className="relative h-44 overflow-hidden border-b border-white/[0.05] bg-gradient-to-b from-white/[0.025] to-transparent">
          {visual}
          {tag && <div className="absolute right-3 top-3">{tag}</div>}
        </div>
        <div className="p-6">
          <h3 className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em] text-white">
            <Icon className="h-4 w-4 text-teal-300" />
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
        </div>
      </SpotlightCard>
    </motion.div>
  )
}

export function IllustrativeTag() {
  const vi = useVi()
  return <DemoTag>{vi ? 'Minh họa' : 'Illustrative'}</DemoTag>
}

/* ---------- 1. Sparkline drawing itself ---------- */

const SERIES = [38, 42, 40, 47, 45, 52, 49, 55, 53, 60, 57, 63, 58, 66, 64, 71, 68, 74, 70, 78, 75, 82, 80, 88]

function smoothPath(pts: [number, number][]) {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d
}

function SparklineVisual() {
  const W = 560, H = 176, padY = 28
  const min = Math.min(...SERIES), max = Math.max(...SERIES)
  const pts = SERIES.map((v, i) => [Math.round((i / (SERIES.length - 1)) * (W - 24)), Math.round(H - padY - ((v - min) / (max - min)) * (H - padY * 2 - 10))] as [number, number])
  const line = smoothPath(pts)
  const area = `${line} L${pts[pts.length - 1][0]},${H} L0,${H} Z`
  const end = pts[pts.length - 1]
  return (
    <>
      <div className="absolute left-4 top-3 z-10 flex gap-1 font-mono text-[10px] text-zinc-500">
        {['1D', '7D', '1M', '1Y'].map((r) => (
          <span key={r} className={`rounded-md px-1.5 py-0.5 ${r === '1M' ? 'bg-white/[0.08] text-white' : ''}`}>{r}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="mk-spark-stroke" x1="0" x2="1">
            <stop offset="0" stopColor="#2DD4BF" />
            <stop offset=".6" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id="mk-spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3B82F6" stopOpacity=".22" />
            <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} style={{ stroke: "var(--color-white)" }} strokeOpacity=".04" strokeDasharray="3 5" />)}
        <motion.path d={area} fill="url(#mk-spark-fill)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.1, duration: 0.8 }} />
        <motion.path
          d={line}
          fill="none"
          stroke="url(#mk-spark-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
        />
        <motion.g initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.5, type: 'spring', stiffness: 300, damping: 18 }}>
          <circle cx={end[0]} cy={end[1]} r="9" fill="#A78BFA" opacity=".18" />
          <circle cx={end[0]} cy={end[1]} r="4" style={{ fill: "var(--color-white)" }} />
        </motion.g>
      </svg>
    </>
  )
}

/* ---------- 2. Fear & Greed gauge ---------- */

function GaugeVisual() {
  const vi = useVi()
  const r = 72, cx = 100, cy = 96
  const arc = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`
  return (
    <div className="absolute inset-0 flex items-end justify-center pb-7">
      <div className="relative h-[110px] w-[200px]">
        <svg viewBox="0 0 200 110" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="mk-gauge" x1="0" x2="1">
              <stop offset="0" stopColor="#FB7185" />
              <stop offset=".5" stopColor="#FBBF24" />
              <stop offset="1" stopColor="#34D399" />
            </linearGradient>
          </defs>
          <path d={arc} fill="none" style={{ stroke: "var(--color-white)" }} strokeOpacity=".06" strokeWidth="12" strokeLinecap="round" />
          <motion.path d={arc} fill="none" stroke="url(#mk-gauge)" strokeWidth="12" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0.4 }} whileInView={{ pathLength: 1, opacity: 0.85 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI - (i / 8) * Math.PI
            return <line key={i} x1={cx + Math.cos(a) * (r - 14)} y1={cy - Math.sin(a) * (r - 14)} x2={cx + Math.cos(a) * (r - 19)} y2={cy - Math.sin(a) * (r - 19)} style={{ stroke: "var(--color-white)" }} strokeOpacity=".18" strokeWidth="1.5" strokeLinecap="round" />
          })}
        </svg>
        <motion.div
          className="absolute h-[58px] w-[3px] origin-bottom rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,.5)]"
          style={{ left: cx - 1.5, top: cy - 58 }}
          initial={{ rotate: -90 }}
          whileInView={{ rotate: 38 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 60, damping: 9 }}
        />
        <div className="absolute h-3 w-3 rounded-full border-2 border-white bg-[#05060B]" style={{ left: cx - 6, top: cy - 6 }} />
        <div className="absolute -bottom-4 left-0 right-0 flex justify-between px-1 text-[10px] font-medium uppercase tracking-wider">
          <span className="text-rose-400/80">{vi ? 'Sợ hãi' : 'Fear'}</span>
          <span className="text-emerald-400/80">{vi ? 'Tham lam' : 'Greed'}</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- 3. News list sliding in ---------- */

function NewsVisual() {
  const rows = [
    { src: 'CoinDesk', w: ['82%', '58%'] },
    { src: 'The Block', w: ['74%', '46%'] },
    { src: 'Decrypt', w: ['88%', '52%'] },
  ]
  return (
    <div className="absolute inset-x-4 top-10 space-y-2.5">
      {rows.map((r, i) => (
        <motion.div
          key={r.src}
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.16, duration: 0.6, ease: EASE }}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2"
        >
          <span className="w-[62px] shrink-0 font-mono text-[10px] text-zinc-500">{r.src}</span>
          <div className="flex-1 space-y-1.5">
            <div className="h-1.5 rounded-full bg-white/[0.14]" style={{ width: r.w[0] }} />
            <div className="h-1.5 rounded-full bg-white/[0.07]" style={{ width: r.w[1] }} />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ---------- 4. Arc block ticker (real data) ---------- */

function ArcBlocksVisual() {
  const vi = useVi()
  const { data } = useArcStatus()
  const latest = toNum(data?.latest_block)
  const gas = toNum(data?.gas_price_gwei)
  const blocks = latest ? Array.from({ length: 6 }, (_, i) => latest - i) : []
  return (
    <div className="absolute inset-0 flex flex-col justify-between p-5 pt-4">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{vi ? 'Block mới nhất trên Arc' : 'Latest Arc block'}</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="font-mono text-3xl font-medium tabular-nums tracking-tight text-white">
            {latest ? <>#<AnimatedNumber value={latest} /></> : <span className="mk-skel inline-block h-8 w-44 align-middle" />}
          </span>
          {gas !== undefined && <span className="font-mono text-xs text-zinc-500">{gas.toFixed(1)} gwei</span>}
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden" aria-hidden>
        <AnimatePresence initial={false} mode="popLayout">
          {blocks.map((b, i) => (
            <motion.div
              key={b}
              layout
              initial={{ opacity: 0, scale: 0.6, x: -16 }}
              animate={{ opacity: 1 - i * 0.13, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className={`flex h-12 min-w-[64px] flex-1 flex-col justify-center rounded-lg border px-2.5 ${i === 0 ? 'border-teal-300/40 bg-teal-300/[0.08] shadow-[0_0_24px_-6px_rgba(94,234,212,.5)]' : 'border-white/[0.07] bg-white/[0.025]'}`}
            >
              <Blocks className={`h-3 w-3 ${i === 0 ? 'text-teal-300' : 'text-zinc-600'}`} />
              <span className="mt-1 font-mono text-[10px] tabular-nums text-zinc-400">…{String(b).slice(-4)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!latest && Array.from({ length: 6 }, (_, i) => <div key={i} className="mk-skel h-12 min-w-[64px] flex-1" />)}
      </div>
    </div>
  )
}

export function LiveTag() {
  const vi = useVi()
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
      <LiveDot />{vi ? 'Trực tiếp' : 'Live'}
    </span>
  )
}

/* ---------- 5. Web search with typing query ---------- */

function SearchVisual() {
  const vi = useVi()
  const queries = vi ? ['Arc mainnet khi nào ra mắt?', 'Circle CPN là gì?', 'Tài liệu Arc về phí gas'] : ['When does Arc mainnet launch?', 'What is Circle CPN?', 'Arc docs on gas fees']
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-10% 0px' })
  const reduce = useReducedMotion()
  const [text, setText] = useState(queries[0])
  const [showResults, setShowResults] = useState(true)

  useEffect(() => {
    if (reduce || !inView) { setText(queries[0]); setShowResults(true); return }
    let cancelled = false
    ;(async () => {
      for (let q = 0; !cancelled; q = (q + 1) % queries.length) {
        setShowResults(false)
        const s = queries[q]
        for (let i = 0; i <= s.length && !cancelled; i++) { setText(s.slice(0, i)); await sleep(45) }
        await sleep(350); if (cancelled) return
        setShowResults(true)
        await sleep(2600); if (cancelled) return
        for (let i = s.length; i >= 0 && !cancelled; i--) { setText(s.slice(0, i)); await sleep(14) }
        await sleep(250)
      }
    })()
    return () => { cancelled = true }
  }, [inView, reduce, vi]) // queries derive from `vi`

  return (
    <div ref={ref} className="absolute inset-x-4 top-10">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#05060B]/80 px-3 text-[13px] text-zinc-200">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span className="truncate">{text}</span>
        {!showResults && <span className="mk-cursor -ml-0.5" />}
      </div>
      <div className="mt-2.5 space-y-2">
        {[0, 1].map((i) => (
          <motion.div key={i} animate={{ opacity: showResults ? 1 : 0, y: showResults ? 0 : 6 }} transition={{ delay: showResults ? i * 0.12 : 0, duration: 0.35 }} className="flex items-center gap-2.5 px-1">
            <span className="h-4 w-4 shrink-0 rounded-md bg-gradient-to-br from-teal-300/40 to-blue-500/40" />
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 rounded-full bg-white/[0.14]" style={{ width: i ? '62%' : '78%' }} />
              <div className="h-1.5 rounded-full bg-white/[0.06]" style={{ width: i ? '84%' : '70%' }} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ---------- 6. Bilingual toggle ---------- */

const BI = {
  vi: { q: 'Hôm nay thị trường thế nào?', a: 'Đang truy xuất dữ liệu mới nhất…' },
  en: { q: "How's the market today?", a: 'Retrieving the latest data…' },
}

function BilingualVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const reduce = useReducedMotion()
  const { lang: siteLang } = useI18n()
  const [lang, setLang] = useState<'vi' | 'en'>(siteLang)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (touched || reduce || !inView) return
    const id = setInterval(() => setLang((l) => (l === 'vi' ? 'en' : 'vi')), 2800)
    return () => clearInterval(id)
  }, [touched, reduce, inView])

  const c = BI[lang]
  return (
    <div ref={ref} className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5">
      <div role="group" aria-label={siteLang === 'vi' ? 'Chọn ngôn ngữ minh họa' : 'Pick demo language'} className="relative flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs font-medium">
        {(['vi', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => { setTouched(true); setLang(l) }}
            className={`relative rounded-full px-3 py-1 transition-colors ${lang === l ? 'text-black' : 'text-zinc-400 hover:text-white'}`}
          >
            {lang === l && <motion.span layoutId="mk-bento-lang" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative">{l.toUpperCase()}</span>
          </button>
        ))}
      </div>
      <div className="w-full space-y-2 text-[13px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={lang} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.3 }} className="space-y-2">
            <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-white/[0.08] px-3 py-1.5 text-white">{c.q}</div>
            <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-zinc-300">{c.a}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ---------- Section ---------- */

/* ---------- 7. Project profiles ---------- */

const PROJECTS = [
  { n: 'Nebula', t: 'Layer 2 · Paradigm, a16z', r: '$40M', c: '#34D399', s: { vi: 'Chưa có token', en: 'No token yet' } },
  { n: 'Orbit Swap', t: 'DEX · Coinbase Ventures', r: '$25M', c: '#38BDF8', s: { vi: 'Đã có token', en: 'Token live' } },
  { n: 'Lumen', t: 'Payments · Pantera Capital', r: '$12M', c: '#A78BFA', s: { vi: 'Sắp ra token', en: 'Token soon' } },
]

function MiniRing({ v, c, delay }: { v: number; c: string; delay: number }) {
  const r = 13, L = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 34 34" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden>
      <circle cx="17" cy="17" r={r} fill="none" style={{ stroke: 'var(--color-white)' }} strokeOpacity=".08" strokeWidth="3" />
      <motion.circle cx="17" cy="17" r={r} fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray={L} initial={{ strokeDashoffset: L }} whileInView={{ strokeDashoffset: L * (1 - v / 100) }} viewport={{ once: true }} transition={{ delay, duration: 1, ease: EASE }} />
    </svg>
  )
}

function ProjectVisual() {
  const vi = useVi()
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-5">
      {PROJECTS.map((d, i) => (
        <motion.div key={d.n} initial={{ opacity: 0, x: -14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: EASE }} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white" style={{ background: d.c + '33', color: d.c }}>{d.n.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">{d.n}</div>
            <div className="truncate text-[11px] text-zinc-500">{d.t}</div>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] text-zinc-400 sm:inline">{vi ? d.s.vi : d.s.en}</span>
          <div className="shrink-0 text-right font-mono text-[12px] font-semibold text-zinc-200">{d.r}<div className="font-sans text-[9.5px] font-normal text-zinc-500">{vi ? 'gọi vốn' : 'raised'}</div></div>
        </motion.div>
      ))}
    </div>
  )
}

/* ---------- 8. Call check with hard data ---------- */

function CallCheckVisual() {
  const vi = useVi()
  const rows = [
    { icon: X, tone: 'text-rose-300 bg-rose-400/10', k: vi ? 'Ví KOL' : 'KOL wallet', v: vi ? 'Quảng bá nhưng không nắm giữ' : 'Promoted, holds none' },
    { icon: Check, tone: 'text-emerald-300 bg-emerald-400/10', k: vi ? 'Sàn' : 'Exchange', v: vi ? '"Sắp niêm yết" nhưng đã niêm yết' : '"Listing soon", already listed' },
    { icon: Clock, tone: 'text-amber-300 bg-amber-400/10', k: vi ? 'Mở khóa' : 'Unlocks', v: vi ? 'Mở khóa 2,7% nguồn cung trong 30 ngày' : '2.7% of supply unlocks in 30d' },
  ]
  return (
    <div className="absolute inset-0 flex items-center gap-4 px-5">
      <div className="hidden shrink-0 flex-col items-center sm:flex">
        <div className="relative">
          <MiniRing v={38} c="#FB7185" delay={0.9} />
          <span className="absolute inset-0 grid place-items-center font-mono text-[10px] font-semibold text-white">38</span>
        </div>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-rose-300/90">{vi ? 'Rủi ro' : 'High risk'}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {rows.map((r, i) => (
          <motion.div key={r.k} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.15, duration: 0.45, ease: EASE }} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${r.tone}`}><r.icon className="h-3.5 w-3.5" /></span>
            <span className="w-14 shrink-0 text-[11px] text-zinc-500">{r.k}</span>
            <span className="min-w-0 truncate text-[12.5px] text-zinc-200">{r.v}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function Bento() {
  const vi = useVi()
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-3 px-5 py-24 md:px-6 md:py-32">
      <SectionHeader
        eyebrow={vi ? 'Tính năng' : 'Features'}
        title={vi ? 'Một nền tảng, đầy đủ công cụ phân tích' : 'One platform, a complete analysis toolkit'}
        sub={vi ? 'Mọi câu trả lời đều dựa trên dữ liệu được truy xuất theo thời gian thực.' : 'Every answer is grounded in data retrieved in real time.'}
      />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Tile
          className="md:col-span-2"
          visual={<SparklineVisual />}
          tag={<IllustrativeTag />}
          icon={TrendingUp}
          title={vi ? 'Giá & biểu đồ trực tiếp' : 'Live prices & charts'}
          body={vi ? 'Giá của hàng nghìn token, biểu đồ từ 1 ngày đến 1 năm và biến động nổi bật của thị trường.' : 'Prices for thousands of tokens, 1D to 1Y charts and the biggest market movers.'}
        />
        <Tile
          delay={0.06}
          visual={<GaugeVisual />}
          tag={<IllustrativeTag />}
          icon={Gauge}
          title={vi ? 'Tâm lý thị trường' : 'Market sentiment'}
          body={vi ? 'Chỉ số Sợ hãi & Tham lam, so sánh theo tuần và theo tháng.' : 'Fear & Greed index with weekly and monthly comparisons.'}
        />
        <Tile
          delay={0.12}
          visual={<NewsVisual />}
          tag={<IllustrativeTag />}
          icon={Newspaper}
          title={vi ? 'Tổng hợp tin tức' : 'News intelligence'}
          body={vi ? 'Tổng hợp từ CoinDesk, The Block và các nguồn uy tín, chắt lọc những điểm quan trọng.' : 'Aggregated from CoinDesk, The Block and other reputable sources, distilled to what matters.'}
        />
        <Tile
          className="md:col-span-2"
          visual={<ProjectVisual />}
          tag={<IllustrativeTag />}
          icon={Building2}
          title={vi ? 'Hồ sơ dự án' : 'Project profiles'}
          body={vi ? 'Giới thiệu, đội ngũ, lịch sử gọi vốn, quỹ đầu tư, token và hợp đồng chính thức của từng dự án.' : 'Overview, team, funding history, investors, token and official contracts for each project.'}
        />
        <Tile
          delay={0.06}
          visual={<SearchVisual />}
          tag={<IllustrativeTag />}
          icon={Search}
          title={vi ? 'Nghiên cứu web' : 'Web research'}
          body={vi ? 'Tra cứu trang web và tài liệu dự án để trả lời các câu hỏi chuyên sâu.' : 'Reads websites and project docs to answer in-depth questions.'}
        />
        <Tile
          delay={0.12}
          visual={<BilingualVisual />}
          icon={Globe}
          title={vi ? 'Đa ngôn ngữ' : 'Multilingual'}
          body={vi ? 'Hỗ trợ đầy đủ tiếng Việt và tiếng Anh.' : 'Full support for English and Vietnamese.'}
        />
        <Tile
          className="md:col-span-2"
          delay={0.12}
          visual={<ArcBlocksVisual />}
          tag={<LiveTag />}
          icon={Blocks}
          title={vi ? 'Tích hợp Arc' : 'Native to Arc'}
          body={vi ? 'Số dư, token, giao dịch và trạng thái mạng Arc theo thời gian thực.' : 'Balances, tokens, transactions and network health on Arc, in real time.'}
        />
        <Tile
          className="md:col-span-2"
          delay={0.06}
          visual={<CallCheckVisual />}
          tag={<IllustrativeTag />}
          icon={ShieldCheck}
          title={vi ? 'Xác minh bằng dữ liệu thực' : 'Verification on hard data'}
          body={vi ? 'Kiểm tra vị thế thực tế của ví KOL, trạng thái niêm yết trên sàn và lịch mở khóa token sắp tới.' : 'Checks actual KOL wallet positions, exchange listing status and upcoming token unlocks.'}
        />
      </div>
    </section>
  )
}
