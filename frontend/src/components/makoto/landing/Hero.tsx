import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Check, Loader2, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ARC } from '@/lib/wallet'
import { Aurora } from '../Aurora'
import { AnimatedNumber, LogoMark } from '../Brand'
import { ConnectCta, DemoTag, EASE, LiveDot, sleep, toNum, useArcStatus } from './shared'

/* ---------- Headline: word-by-word blur-in, gradient on the last words ---------- */

const GRAD = 'var(--mk-grad)'

function Headline({ text, grad }: { text: string; grad: number }) {
  const words = text.split(' ').filter(Boolean)
  // Gradient on the opening word(s): "Xác minh" / "Verify"
  const gradCount = Math.min(grad, words.length)
  const gradStart = 0
  return (
    <h1 className="text-balance text-[clamp(36px,11vw,42px)] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[52px] md:text-[64px]">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => {
          const g = i - gradStart
          return (
            <motion.span
              key={`${text}-${i}`}
              initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.8, ease: EASE }}
              className="inline-block pb-[0.08em]"
              style={
                g >= 0 && g < gradCount
                  ? {
                      backgroundImage: GRAD,
                      backgroundSize: `${gradCount * 100}% 100%`,
                      backgroundPosition: `${gradCount > 1 ? (g / (gradCount - 1)) * 100 : 0}% 0`,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                    }
                  : undefined
              }
            >
              {w}
              {i < words.length - 1 && ' '}
            </motion.span>
          )
        })}
      </span>
    </h1>
  )
}

/* ---------- Hero demo conversation (loops while visible) ---------- */

const DEMO = {
  vi: { q: 'Xác minh: "$MOONCAT sắp niêm yết trên Binance, tăng x10 trong tuần này."', steps: ['Đang quét hợp đồng token', 'Đang đối chiếu sàn niêm yết, ví KOL và tin tức', 'Đang đánh giá các góc nhìn ủng hộ và phản biện'], a: 'Binance chưa niêm yết hay công bố token này. "x10 trong tuần" là **cam kết lợi nhuận** không có cơ sở. Hợp đồng áp **thuế bán 12%** và 10 ví lớn nhất nắm 61% nguồn cung.' },
  en: { q: 'Verify: "$MOONCAT is listing on Binance soon, 10x this week."', steps: ['Scanning the token contract', 'Cross-checking listings, KOL wallets and news', 'Weighing the bull and bear case'], a: 'Binance has neither listed nor announced this token. "10x this week" is an **unsupported return claim**. The contract applies a **12% sell tax** and the top 10 wallets hold 61% of supply.' },
}
const SCORE = 22

function renderBold(s: string) {
  return s.split(/(\*\*[^*]*\*\*?)/g).map((part, i) =>
    part.startsWith('**') ? <b key={i} className="font-semibold text-white">{part.replace(/\*/g, '')}</b> : <span key={i}>{part.replace(/\*/g, '')}</span>
  )
}

function HeroDemo() {
  const { lang } = useI18n()
  const d = DEMO[lang]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-10% 0px' })
  const reduce = useReducedMotion()
  // Opens on the finished answer so the card is never blank on first look, then replays.
  const [phase, setPhase] = useState(2) // 0 typing, 1 steps, 2 answer
  const [typed, setTyped] = useState(d.q)
  const [stepN, setStepN] = useState(d.steps.length)
  const [ans, setAns] = useState(d.a)

  useEffect(() => {
    if (reduce) {
      setTyped(d.q); setStepN(d.steps.length); setPhase(2); setAns(d.a)
      return
    }
    if (!inView) return
    let cancelled = false
    setTyped(d.q); setStepN(d.steps.length); setPhase(2); setAns(d.a)
    ;(async () => {
      await sleep(4200)
      while (!cancelled) {
        setPhase(0); setTyped(''); setStepN(0); setAns('')
        for (let i = 1; i <= d.q.length && !cancelled; i += 2) { setTyped(d.q.slice(0, i + 1)); await sleep(32) }
        await sleep(400); if (cancelled) return
        setPhase(1)
        for (let i = 1; i <= d.steps.length && !cancelled; i++) { setStepN(i); await sleep(750) }
        if (cancelled) return
        setPhase(2)
        for (let i = 1; i <= d.a.length && !cancelled; i += 2) { setAns(d.a.slice(0, i + 1)); await sleep(16) }
        await sleep(5200)
      }
    })()
    return () => { cancelled = true }
  }, [d, inView, reduce])

  return (
    <div ref={ref} className="mk-border-spin rounded-3xl" aria-label={lang === 'vi' ? 'Minh họa một lần xác minh với Makoto' : 'Illustrative Makoto verification'} role="img">
      <div className="rounded-3xl border border-white/[0.08] bg-[#08080f]/85 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="ml-3 text-xs text-zinc-500">makotoai.xyz</span>
          <span className="ml-auto"><DemoTag>{lang === 'vi' ? 'Minh họa' : 'Demo'}</DemoTag></span>
        </div>
        {/* Invisible copy of the finished conversation reserves the card height, so nothing below jumps while it replays. */}
        <div className="grid">
          <div aria-hidden className="invisible [grid-area:1/1]">
            <DemoBody d={d} lang={lang} typed={d.q} phase={2} stepN={d.steps.length} ans={d.a} ghost />
          </div>
          <div className="[grid-area:1/1]">
            <DemoBody d={d} lang={lang} typed={typed} phase={phase} stepN={stepN} ans={ans} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoBody({ d, lang, typed, phase, stepN, ans, ghost = false }: { d: (typeof DEMO)['vi']; lang: 'vi' | 'en'; typed: string; phase: number; stepN: number; ans: string; ghost?: boolean }) {
  const streaming = !ghost && phase === 2 && ans.length < d.a.length
  return (
    <>
          <div className="grid min-h-[44px] justify-items-end">
            <div aria-hidden className="invisible max-w-[85%] px-4 py-2.5 text-sm [grid-area:1/1]">{d.q}</div>
            <div className="max-w-[85%] self-start rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-sm text-white [grid-area:1/1]">
              {typed}{!ghost && phase === 0 && <span className="mk-cursor" />}
            </div>
          </div>
          <div className="mt-4 flex min-h-[216px] gap-3">
            <LogoMark size={26} />
            <div className="min-w-0 flex-1 space-y-2">
              <AnimatePresence>
                {phase >= 1 && d.steps.slice(0, stepN).map((s, i) => (
                  <motion.div key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-xs text-zinc-400">
                    {i < stepN - 1 || phase === 2 ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" />}
                    <span className={i === stepN - 1 && phase === 1 ? 'mk-thinking' : ''}>{s}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {phase === 2 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-rose-300/15 bg-rose-400/[0.04] p-3">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-zinc-400">{lang === 'vi' ? 'Điểm tin cậy' : 'Trust score'}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] font-medium text-rose-300"><ShieldAlert className="h-3 w-3" />{lang === 'vi' ? 'Rủi ro cao' : 'High risk'}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1"><span className="font-mono text-3xl font-semibold tabular-nums text-white">{SCORE}</span><span className="text-sm text-zinc-500">/100</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${SCORE}%` }} transition={{ duration: 0.9, ease: EASE }} className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300" />
                  </div>
                </motion.div>
              )}
              {phase === 2 && (
                <p className="text-sm leading-relaxed text-zinc-300">
                  {renderBold(ans)}
                  {streaming && <span className="mk-cursor" />}
                </p>
              )}
            </div>
          </div>
    </>
  )
}

/* ---------- Live Arc stats (real data) ---------- */

function LiveArc() {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const { data, isError } = useArcStatus()
  const items = [
    { k: vi ? 'Block mới nhất' : 'Latest block', v: toNum(data?.latest_block) },
    { k: vi ? 'Tổng giao dịch' : 'Total transactions', v: toNum(data?.total_transactions) },
    { k: vi ? 'Giao dịch hôm nay' : 'Transactions today', v: toNum(data?.transactions_today) },
    { k: vi ? 'Phí gas (gwei)' : 'Gas price (gwei)', v: toNum(data?.gas_price_gwei), d: 1 },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8, ease: EASE }} className="mx-auto mt-20 max-w-6xl">
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-zinc-500">
        <span className="flex items-center gap-2"><LiveDot />{vi ? 'Số liệu trực tiếp từ Arc Testnet' : 'Live from Arc Testnet'}</span>
        <a href={ARC.explorer} target="_blank" rel="noopener noreferrer" className="-my-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 transition-colors hover:text-zinc-300">
          {vi ? 'Mở explorer' : 'Open explorer'}<ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] md:grid-cols-4">
        {items.map((it) => (
          <div key={it.k} className="bg-[#05060B]/90 px-5 py-4 backdrop-blur">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{it.k}</div>
            <div className="mt-1.5 font-mono text-xl font-medium tabular-nums text-white">
              {typeof it.v === 'number' ? <AnimatedNumber value={it.v} decimals={it.d ?? 0} /> : isError ? <span className="text-zinc-500" title={vi ? 'Tạm thời chưa lấy được số liệu' : 'Temporarily unavailable'}>—</span> : <span className="mk-skel inline-block h-6 w-24 align-middle" />}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ---------- Hero ---------- */

export function Hero() {
  const { t, lang } = useI18n()
  const vi = lang === 'vi'
  return (
    <section id="top" className="relative overflow-hidden pb-20 pt-28 sm:pt-36 md:pb-32 md:pt-44">
      <Aurora />
      <div aria-hidden className="mk-noise pointer-events-none absolute inset-0" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#030308]" />
      <div className="relative mx-auto max-w-6xl px-5 md:px-6">
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Headline text={t('tagline')} grad={vi ? 2 : 1} />
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.8, ease: EASE }}
              className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400"
            >
              {t('sub')}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.8, ease: EASE }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <ConnectCta big label={t('start')} />
              <a
                href="#verify"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 text-[15px] font-medium text-zinc-200 backdrop-blur transition-colors hover:border-white/20 hover:bg-white/[0.07]"
              >
                {vi ? 'Tìm hiểu thêm' : 'Learn more'}
              </a>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: EASE }}
          >
            <div style={{ animation: 'mk-float 7s ease-in-out infinite' }}>
              <HeroDemo />
            </div>
          </motion.div>
        </div>
        <LiveArc />
      </div>
    </section>
  )
}
