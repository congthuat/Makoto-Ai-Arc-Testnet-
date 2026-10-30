import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, TrendingUp, TrendingDown, Minus, Newspaper, Eye, RefreshCw, Sparkles, ChevronDown, ArrowUpRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { fmtUsd } from '@/lib/format'
import { usePalette } from '@/lib/theme'

export type Quote = { symbol: string; name?: string; image?: string | null; price: number | null; change_24h: number | null; change_7d: number | null; spark?: number[] }
type Briefing = {
  id: number; day: string; headline: string; mood: 'bullish' | 'bearish' | 'neutral'; summary: string; bullets: string[]
  coins: { symbol: string; note: string }[]; watch: string[]; generated_at?: string
  data?: { fear_greed?: { value: number | null; classification: string | null; week_ago: number | null } | null; news?: { title: string; url: string | null; source: string | null }[] }
}

export const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Renders **bold** segments without pulling in the full markdown renderer. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const P = usePalette()
  if (!data || data.length < 2) return <div className="h-8" />
  const w = 100, h = 32
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const color = up ? P.up : P.down
  const id = `sp-${up ? 'u' : 'd'}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function TokenIcon({ q, size = 22 }: { q: { symbol: string; image?: string | null }; size?: number }) {
  const [err, setErr] = useState(false)
  if (q.image && !err) return <img src={q.image} alt="" width={size} height={size} onError={() => setErr(true)} className="shrink-0 rounded-full bg-white/5" />
  return <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-300/30 to-violet-500/30 text-[10px] font-semibold text-white">{q.symbol.slice(0, 2)}</span>
}

const Change = ({ v, className = '' }: { v: number | null; className?: string }) => {
  if (v == null) return <span className={`text-zinc-500 ${className}`}>—</span>
  const up = v >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${up ? 'text-emerald-300' : 'text-rose-300'} ${className}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{up ? '+' : ''}{v.toFixed(2)}%
    </span>
  )
}

function Section({ title, icon, right, children, delay = 0 }: { title: string; icon: ReactNode; right?: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="w-full">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-zinc-400">{icon}{title}</h2>
        {right}
      </div>
      {children}
    </motion.section>
  )
}

export function Watchlist({ onAsk }: { onAsk: (text: string) => void }) {
  const { authFetch, token } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [sym, setSym] = useState('')
  const [saving, setSaving] = useState(false)
  const { data, isLoading } = useQuery<{ items: Quote[] }>({
    queryKey: ['watchlist', token],
    enabled: Boolean(token),
    queryFn: () => authFetch('watchlist').then((r) => r.json()),
    refetchInterval: 120_000,
  })
  const items = data?.items ?? []

  const add = async () => {
    const s = sym.trim().toUpperCase()
    if (!s) { setAdding(false); return }
    setSaving(true)
    try {
      const r = await authFetch('watchlist', { method: 'POST', body: JSON.stringify({ symbol: s }) })
      const j = await r.json()
      if (!r.ok) {
        toast.error(j.error === 'not_found' ? (vi ? `Không tìm thấy token ${s}` : `Token ${s} not found`) : j.error === 'limit' ? (vi ? 'Tối đa 12 token' : 'Up to 12 tokens') : vi ? 'Mã token không hợp lệ' : 'Invalid ticker')
        return
      }
      setSym(''); setAdding(false)
      qc.invalidateQueries({ queryKey: ['watchlist'] })
    } catch {
      toast.error(vi ? `Chưa thêm được ${s}. Vui lòng thử lại.` : `Couldn’t add ${s}. Please try again.`)
    } finally { setSaving(false) }
  }
  const remove = async (s: string) => {
    const prev = qc.getQueryData<{ items: Quote[] }>(['watchlist', token])
    qc.setQueryData<{ items: Quote[] }>(['watchlist', token], (old) => old && { items: old.items.filter((x) => x.symbol !== s) })
    try {
      const r = await authFetch(`watchlist/${s}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } catch {
      qc.setQueryData(['watchlist', token], prev)
      toast.error(vi ? `Chưa bỏ theo dõi được ${s}. Vui lòng thử lại.` : `Couldn’t remove ${s}. Please try again.`)
    }
  }

  return (
    <Section
      title={vi ? 'Danh sách theo dõi' : 'Watchlist'}
      icon={<Eye className="h-3.5 w-3.5" />}
      delay={0.15}
      right={
        adding ? (
          <form onSubmit={(e) => { e.preventDefault(); add() }} className="flex items-center gap-1 rounded-lg border border-teal-300/30 bg-white/[0.03] pl-2">
            <input autoFocus value={sym} onChange={(e) => setSym(e.target.value.replace(/[^a-zA-Z0-9$]/g, '').slice(0, 12))} onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} onBlur={() => !sym && setAdding(false)} placeholder={vi ? 'VD: LINK' : 'e.g. LINK'} aria-label={vi ? 'Mã token' : 'Token ticker'} className="w-20 bg-transparent py-1 text-xs uppercase text-white placeholder:normal-case placeholder:text-zinc-600 focus:outline-none" />
            <button type="submit" disabled={saving} className="p-1.5 text-teal-300 disabled:opacity-50" aria-label={vi ? 'Thêm' : 'Add'}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="flex min-h-8 items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"><Plus className="h-3.5 w-3.5" />{vi ? 'Thêm token' : 'Add token'}</button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="mk-skel h-[104px] rounded-2xl" />)}
        <AnimatePresence initial={false}>
          {items.map((q) => {
            const up = (q.change_7d ?? q.change_24h ?? 0) >= 0
            return (
              <motion.div key={q.symbol} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="group relative">
                <button
                  onClick={() => onAsk(vi ? `Phân tích ${q.symbol} hôm nay: giá, tin tức và tâm lý thị trường` : `Analyze ${q.symbol} today: price, news and sentiment`)}
                  className="w-full rounded-2xl border border-white/[0.07] bg-[#0b0c14]/80 p-3 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-white/[0.14]"
                  title={vi ? `Hỏi Makoto về ${q.symbol}` : `Ask Makoto about ${q.symbol}`}
                >
                  <div className="flex items-center gap-2">
                    <TokenIcon q={q} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-white">{q.symbol}</div>
                    </div>
                    <Change v={q.change_24h} className="text-[11px]" />
                  </div>
                  <div className="mt-1.5 text-[15px] font-medium tabular-nums tracking-tight text-zinc-100">{fmtUsd(q.price)}</div>
                  <div className="mt-1"><Sparkline data={q.spark || []} up={up} /></div>
                  <div className="text-[10px] text-zinc-600">7d {q.change_7d == null ? '—' : `${q.change_7d >= 0 ? '+' : ''}${q.change_7d.toFixed(2)}%`}</div>
                </button>
                <button onClick={() => remove(q.symbol)} aria-label={vi ? `Bỏ theo dõi ${q.symbol}` : `Unwatch ${q.symbol}`} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#16171f] text-zinc-400 shadow hover:text-white group-hover:flex group-focus-within:flex [@media(hover:none)]:-right-2 [@media(hover:none)]:-top-2 [@media(hover:none)]:flex [@media(hover:none)]:h-8 [@media(hover:none)]:w-8">
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {!isLoading && items.length === 0 && (
          <button onClick={() => setAdding(true)} className="col-span-full rounded-2xl border border-dashed border-white/10 py-6 text-sm text-zinc-500 hover:border-teal-300/30 hover:text-zinc-300">{vi ? '+ Thêm token đầu tiên bạn muốn theo dõi' : '+ Add your first token to watch'}</button>
        )}
      </div>
    </Section>
  )
}

const MOOD = {
  bullish: { vi: 'Tích cực', en: 'Bullish', cls: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200', Icon: TrendingUp },
  bearish: { vi: 'Tiêu cực', en: 'Bearish', cls: 'border-rose-300/25 bg-rose-300/[0.08] text-rose-200', Icon: TrendingDown },
  neutral: { vi: 'Trung lập', en: 'Neutral', cls: 'border-white/15 bg-white/[0.05] text-zinc-300', Icon: Minus },
}

export const FG_VI: Record<string, string> = { 'extreme fear': 'Cực kỳ sợ hãi', fear: 'Sợ hãi', neutral: 'Trung lập', greed: 'Tham lam', 'extreme greed': 'Cực kỳ tham lam' }
export const fgLabel = (l: string | null, vi: boolean) => (l && vi ? FG_VI[l.toLowerCase()] || l : l)

function FearGreed({ v, label, weekAgo, vi }: { v: number; label: string | null; weekAgo: number | null; vi: boolean }) {
  return (
    <div className="min-w-[150px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-zinc-500">{vi ? 'Sợ hãi & Tham lam' : 'Fear & Greed'}</span>
        <span className="text-sm font-semibold tabular-nums text-white">{v}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-gradient-to-r from-rose-400/70 via-zinc-400/60 to-emerald-400/70">
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b0c14] bg-white shadow" style={{ left: `${Math.min(100, Math.max(0, v))}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{fgLabel(label, vi)}{weekAgo != null && ` · ${vi ? 'tuần trước' : 'last week'} ${weekAgo}`}</div>
    </div>
  )
}

export function BriefingCard({ onAsk }: { onAsk: (text: string) => void }) {
  const { authFetch, token } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const qc = useQueryClient()
  const day = localDay()
  const key = ['briefing', token, day, lang]
  const [open, setOpen] = useState(() => typeof localStorage === 'undefined' || localStorage.getItem('mk_brief_closed') !== day)
  const { data, isLoading, isError, refetch } = useQuery<{ briefing: Briefing | null }>({
    queryKey: key,
    enabled: Boolean(token),
    queryFn: async () => {
      const r = await authFetch(`briefing?day=${day}&lang=${lang}`)
      if (!r.ok) throw new Error('failed')
      return r.json()
    },
    staleTime: 5 * 60_000,
  })
  const gen = useMutation({
    mutationFn: async () => {
      const r = await authFetch('briefing', { method: 'POST', body: JSON.stringify({ day, lang }) })
      if (!r.ok) throw new Error('failed')
      return r.json() as Promise<{ briefing: Briefing }>
    },
    onSuccess: (d) => qc.setQueryData(key, d),
  })
  const tried = useRef('')
  useEffect(() => {
    const k = `${day}|${lang}`
    if (data && !data.briefing && tried.current !== k && !gen.isPending) { tried.current = k; gen.mutate() }
  }, [data, day, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const b = data?.briefing
  const dateLabel = new Date().toLocaleDateString(vi ? 'vi-VN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  const toggle = () => { const n = !open; setOpen(n); localStorage.setItem('mk_brief_closed', n ? '' : day) }

  return (
    <Section
      title={vi ? 'Bản tin hôm nay' : "Today's briefing"}
      icon={<Sparkles className="h-3.5 w-3.5" />}
      delay={0.22}
      right={<span className="px-1 text-[11px] capitalize text-zinc-600">{dateLabel}</span>}
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-teal-300/[0.04] via-[#0b0c14]/85 to-violet-500/[0.05] backdrop-blur">
        {(isLoading || gen.isPending) && !b && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" />{vi ? 'Makoto đang đọc thị trường và soạn bản tin cho bạn…' : 'Makoto is reading the market and writing your briefing…'}</div>
            <div className="mt-3 space-y-2"><div className="mk-skel h-5 w-3/4" /><div className="mk-skel h-3.5 w-full" /><div className="mk-skel h-3.5 w-5/6" /></div>
          </div>
        )}
        {(gen.isError || (isError && !data)) && !b && !isLoading && !gen.isPending && (
          <div className="flex items-center justify-between gap-3 p-4 text-sm text-zinc-400">
            {gen.isError ? (vi ? 'Chưa soạn được bản tin lúc này.' : "Couldn't write the briefing right now.") : vi ? 'Không tải được bản tin.' : "Couldn't load the briefing."}
            <button onClick={() => (gen.isError ? gen.mutate() : refetch())} className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/5"><RefreshCw className="h-3 w-3" />{vi ? 'Thử lại' : 'Retry'}</button>
          </div>
        )}
        {b && (
          <div>
            <button onClick={toggle} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
              <div className="min-w-0 flex-1">
                {(() => { const m = MOOD[b.mood] || MOOD.neutral; return <span className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.cls}`}><m.Icon className="h-3 w-3" />{vi ? m.vi : m.en}</span> })()}
                <div className="text-[15px] font-semibold leading-snug tracking-tight text-white">{b.headline.replace(/\*\*/g, '')}</div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400"><Rich text={b.summary} /></p>
              </div>
              <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-zinc-500 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                  <div className="space-y-4 border-t border-white/[0.05] px-4 pb-4 pt-3.5">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <ul className="flex-1 space-y-2">
                        {(b.bullets || []).map((x, i) => (
                          <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-zinc-300">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300/80" /><span><Rich text={x} /></span>
                          </li>
                        ))}
                      </ul>
                      {b.data?.fear_greed?.value != null && <FearGreed v={b.data.fear_greed.value} label={b.data.fear_greed.classification} weekAgo={b.data.fear_greed.week_ago} vi={vi} />}
                    </div>
                    {(b.coins || []).length > 0 && (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {(b.coins || []).map((c) => (
                          <div key={c.symbol} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12.5px] leading-snug text-zinc-400">
                            <span className="mr-1.5 font-semibold text-white">{c.symbol}</span><Rich text={c.note} />
                          </div>
                        ))}
                      </div>
                    )}
                    {(b.watch || []).length > 0 && (
                      <div>
                        <div className="mb-1.5 text-[11px] font-medium text-zinc-500">{vi ? 'Đáng chú ý hôm nay' : 'Worth watching today'}</div>
                        <div className="flex flex-wrap gap-1.5">{(b.watch || []).map((w, i) => <span key={i} className="rounded-lg border border-amber-300/15 bg-amber-300/[0.05] px-2.5 py-1 text-xs text-amber-100/90">{w}</span>)}</div>
                      </div>
                    )}
                    {!!b.data?.news?.length && (
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500"><Newspaper className="h-3 w-3" />{vi ? 'Tin nổi bật' : 'Top stories'}</div>
                        <div className="space-y-1">
                          {b.data.news.map((n, i) => (
                            <a key={i} href={n.url || '#'} target="_blank" rel="noreferrer" className="group flex items-start gap-2 rounded-lg px-1 py-1 text-[13px] text-zinc-300 transition hover:bg-white/[0.03] hover:text-white">
                              <span className="min-w-0 flex-1 leading-snug">{n.title}{n.source && <span className="ml-1.5 text-[11px] text-zinc-600">{n.source}</span>}</span>
                              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-teal-300" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button onClick={() => onAsk(vi ? `Giải thích kỹ hơn bản tin hôm nay: "${b.headline}". Điều này ảnh hưởng gì tới các coin tôi đang theo dõi?` : `Explain today's briefing in more depth: "${b.headline}". How does it affect the coins I follow?`)} className="flex min-h-8 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:shadow-[0_0_24px_rgba(94,234,212,.35)]">
                        <Sparkles className="h-3.5 w-3.5" />{vi ? 'Hỏi Makoto sâu hơn' : 'Ask Makoto for more'}
                      </button>
                      <span className="text-[11px] text-zinc-600">{vi ? 'Bản tin miễn phí · không phải lời khuyên đầu tư' : 'Free briefing · not financial advice'}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Section>
  )
}
