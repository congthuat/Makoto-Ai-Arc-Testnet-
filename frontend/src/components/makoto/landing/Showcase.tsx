import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { ArrowUp, Check, CornerDownRight, Loader2, RotateCcw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { LogoMark } from '../Brand'
import { EASE, SectionHeader, fadeUp, sleep, useVi } from './shared'

const SCRIPT = {
  vi: {
    q: 'ETH tháng này thế nào? Có tin gì đáng chú ý không?',
    steps: ['Lấy giá ETH · 30 ngày', 'Đọc tin từ CoinDesk, The Block', 'Xem chỉ số Sợ hãi & Tham lam', 'Tìm thêm trên web'],
    a: 'Trong 30 ngày qua, ETH nhìn chung **đi lên**, xen kẽ vài nhịp điều chỉnh ngắn. Tin tức chủ yếu xoay quanh dòng tiền vào quỹ ETF và các bản nâng cấp mạng. Tâm lý thị trường đang nghiêng về **tham lam**, nên hãy cẩn thận với những đợt biến động mạnh.',
    chips: ['So sánh với BTC', 'Tin ETH hôm nay', 'Phí gas trên Arc lúc này?'],
  },
  en: {
    q: 'How has ETH done this month? Any news worth knowing?',
    steps: ['Fetching ETH price · 30D', 'Reading CoinDesk, The Block', 'Checking Fear & Greed', 'Searching the web'],
    a: 'Over the past 30 days ETH has trended **up**, with a few short pullbacks along the way. Headlines center on ETF inflows and upcoming network upgrades. Sentiment leans toward **greed**, so expect sharper swings.',
    chips: ['Compare with BTC', "Today's ETH news", 'Arc gas price right now?'],
  },
}

// Illustrative series for the demo chart (not market data).
const DEMO_SERIES = [30, 34, 31, 38, 36, 42, 40, 39, 45, 43, 50, 47, 52, 49, 55, 58, 54, 60, 63, 59, 66, 64, 70, 68, 73, 71, 77, 80, 76, 82]

/** Stage: 0 idle · 1 question · 2 tools · 3 chart · 4 streaming · 5 done */
function useScript(active: boolean, nSteps: number, answer: string, runKey: number) {
  const reduce = useReducedMotion()
  const [stage, setStage] = useState(0)
  const [stepN, setStepN] = useState(0)
  const [words, setWords] = useState(0)
  const total = answer.split(' ').length

  useEffect(() => {
    if (reduce) { setStage(5); setStepN(nSteps); setWords(total); return }
    if (!active) return
    let cancelled = false
    ;(async () => {
      setStage(0); setStepN(0); setWords(0)
      await sleep(300); if (cancelled) return
      setStage(1)
      await sleep(900); if (cancelled) return
      setStage(2)
      for (let i = 1; i <= nSteps; i++) { setStepN(i); await sleep(820); if (cancelled) return }
      setStepN(nSteps + 1) // all done
      await sleep(250); if (cancelled) return
      setStage(3)
      await sleep(1400); if (cancelled) return
      setStage(4)
      for (let i = 1; i <= total; i++) { setWords(i); await sleep(42); if (cancelled) return }
      setStage(5)
    })()
    return () => { cancelled = true }
  }, [active, reduce, nSteps, total, runKey])

  return { stage, stepN, words }
}

function renderBold(s: string) {
  return s.split(/(\*\*[^*]*\*\*?)/g).map((part, i) =>
    part.startsWith('**') ? <b key={i} className="font-semibold text-white">{part.replace(/\*/g, '')}</b> : <span key={i}>{part.replace(/\*/g, '')}</span>
  )
}

function DemoChart() {
  const vi = useVi()
  const W = 520, H = 120
  const min = Math.min(...DEMO_SERIES), max = Math.max(...DEMO_SERIES)
  const pts = DEMO_SERIES.map((v, i) => `${((i / (DEMO_SERIES.length - 1)) * W).toFixed(1)},${(H - 8 - ((v - min) / (max - min)) * (H - 24)).toFixed(1)}`)
  const line = `M${pts.join(' L')}`
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-semibold text-white">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[10px]">Ξ</span>ETH · 30D
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{vi ? 'Dữ liệu minh họa' : 'Demo data'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" aria-hidden>
        <defs>
          <linearGradient id="mk-show-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2DD4BF" stopOpacity=".25" />
            <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mk-show-stroke" x1="0" x2="1">
            <stop offset="0" stopColor="#2DD4BF" /><stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <motion.path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#mk-show-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }} />
        <motion.path d={line} fill="none" stroke="url(#mk-show-stroke)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }} />
      </svg>
    </motion.div>
  )
}

export function Showcase() {
  const { lang, t } = useI18n()
  const vi = lang === 'vi'
  const s = SCRIPT[lang]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const [runKey, setRunKey] = useState(0)
  const { stage, stepN, words } = useScript(inView, s.steps.length, s.a, runKey + (vi ? 0.5 : 0))
  const answer = s.a.split(' ').slice(0, words).join(' ')
  const credits = 1 + s.steps.length

  const phases = [
    { t: vi ? 'Phân tích yêu cầu' : 'Understands the request', d: vi ? 'Xử lý ngôn ngữ tự nhiên, không cần cú pháp đặc biệt.' : 'Natural language, no special syntax.' },
    { t: vi ? 'Truy xuất dữ liệu thực' : 'Retrieves live data', d: vi ? 'Giá, tin tức, tâm lý thị trường, web và dữ liệu on-chain.' : 'Prices, news, sentiment, the web and on-chain data.' },
    { t: vi ? 'Trực quan hóa' : 'Visualizes', d: vi ? 'Biểu đồ hiển thị trực tiếp trong câu trả lời.' : 'Charts render directly in the answer.' },
    { t: vi ? 'Kết luận có căn cứ' : 'Grounded conclusions', d: vi ? 'Tổng hợp kết quả kèm các hướng phân tích tiếp theo.' : 'A synthesized answer with suggested follow-ups.' },
  ]
  const activePhase = stage <= 1 ? 0 : stage === 2 ? 1 : stage === 3 ? 2 : 3

  return (
    <section id="demo" className="relative mx-auto max-w-6xl scroll-mt-3 px-5 py-24 md:px-6 md:py-32">
      <SectionHeader
        center
        eyebrow={vi ? 'Trợ lý phân tích' : 'Research assistant'}
        title={vi ? 'Từ câu hỏi đến phân tích có dữ liệu' : 'From question to data-backed analysis'}
        sub={vi ? 'Makoto tự lập kế hoạch, truy xuất dữ liệu từ nhiều nguồn và trả lời kèm biểu đồ.' : 'Makoto plans, pulls data from multiple sources and answers with charts.'}
      />

      <div ref={ref} className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] lg:gap-14">
        {/* Phase list */}
        <motion.ol {...fadeUp} className="relative hidden space-y-2 lg:block">
          {phases.map((p, i) => {
            const on = i === activePhase && stage > 0
            const done = i < activePhase || stage === 5
            return (
              <li key={i} className={`relative rounded-2xl border p-5 transition-colors duration-500 ${on ? 'border-white/[0.09] bg-white/[0.035]' : 'border-transparent'}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-colors duration-500 ${done ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : on ? 'border-teal-300/50 text-teal-200' : 'border-white/10 text-zinc-500'}`}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={`text-[15px] font-medium transition-colors duration-500 ${on || done ? 'text-white' : 'text-zinc-500'}`}>{p.t}</span>
                </div>
                <p className={`mt-2 pl-9 text-sm leading-relaxed transition-colors duration-500 ${on ? 'text-zinc-400' : 'text-zinc-600'}`}>{p.d}</p>
              </li>
            )
          })}
        </motion.ol>

        {/* Mock chat window */}
        <motion.div {...fadeUp} className="relative">
          <div aria-hidden className="absolute -inset-x-10 -inset-y-8 -z-10 rounded-[40px] bg-gradient-to-br from-teal-400/10 via-blue-500/10 to-violet-600/10 blur-3xl" />
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#07080e]/90 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="ml-3 text-xs text-zinc-500">makotoai.xyz</span>
              <span className="ml-auto rounded-full border border-teal-300/25 bg-teal-300/10 px-2.5 py-0.5 text-[11px] font-medium text-teal-200">{vi ? 'Minh họa' : 'Demo'}</span>
            </div>

            <div className="min-h-[560px] space-y-5 p-5 md:p-7" aria-live="off">
              <AnimatePresence>
                {stage >= 1 && (
                  <motion.div key="q" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-3 text-[15px] text-white">{s.q}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {stage >= 2 && (
                <div className="flex gap-3">
                  <LogoMark size={28} />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3.5">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{vi ? 'Công cụ' : 'Tools'}</div>
                      <ul className="space-y-2">
                        {s.steps.slice(0, Math.min(stepN, s.steps.length)).map((st, i) => {
                          const running = i === stepN - 1
                          return (
                            <motion.li key={st} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} className="flex items-center gap-2.5 text-[13px] text-zinc-400">
                              <span className="flex h-4 w-4 items-center justify-center">
                                <AnimatePresence mode="wait" initial={false}>
                                  {running ? (
                                    <motion.span key="spin" exit={{ opacity: 0, scale: 0.5 }}><Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" /></motion.span>
                                  ) : (
                                    <motion.span key="ok" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </span>
                              <span className={running ? 'mk-thinking' : ''}>{st}</span>
                            </motion.li>
                          )
                        })}
                      </ul>
                    </div>

                    {stage >= 3 && <DemoChart />}

                    {stage >= 4 && (
                      <p className="text-[15px] leading-relaxed text-zinc-300">
                        {renderBold(answer)}
                        {stage === 4 && <span className="mk-cursor" />}
                      </p>
                    )}

                    <AnimatePresence>
                      {stage === 5 && (
                        <motion.div key="chips" initial="h" animate="v" variants={{ v: { transition: { staggerChildren: 0.08 } } }} className="flex flex-wrap gap-2 pt-1">
                          {s.chips.map((c) => (
                            <motion.span
                              key={c}
                              variants={{ h: { opacity: 0, y: 6 }, v: { opacity: 1, y: 0 } }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-zinc-300"
                            >
                              <CornerDownRight className="h-3 w-3 text-teal-300" />{c}
                            </motion.span>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-white/[0.06] p-4">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] py-2 pl-4 pr-2">
                <span className="flex-1 truncate text-sm text-zinc-500">{t('placeholder')}</span>
                <AnimatePresence>
                  {stage === 5 && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden font-mono text-[11px] text-zinc-500 sm:inline">
                      {vi ? `Đã dùng ${credits} credit` : `Used ${credits} credits`}
                    </motion.span>
                  )}
                </AnimatePresence>
                {stage === 5 ? (
                  <button
                    type="button"
                    onClick={() => setRunKey((k) => k + 1)}
                    aria-label={vi ? 'Phát lại demo' : 'Replay demo'}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.08] text-zinc-300 transition-colors hover:bg-white/[0.14] hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black"><ArrowUp className="h-4 w-4" /></span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
