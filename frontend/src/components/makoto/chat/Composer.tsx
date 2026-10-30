import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUp, Square, Zap, Sparkles, TrendingUp, Newspaper, Wallet, Blocks, Gauge, Search, Trophy, CircleAlert } from 'lucide-react'
import { useI18n, creditsText } from '@/lib/i18n'

const COMMANDS = [
  { key: 'gia', en: 'price', icon: TrendingUp, vi_label: 'Giá & biểu đồ', en_label: 'Price & chart', vi: 'Giá và biểu đồ 30 ngày của ', en_t: '30-day price and chart for ' },
  { key: 'top', en: 'top', icon: Trophy, vi_label: 'Bảng xếp hạng', en_label: 'Rankings', vi: 'Top 10 token tăng mạnh nhất 24 giờ qua', en_t: 'Top 10 gainers in the last 24 hours' },
  { key: 'tin', en: 'news', icon: Newspaper, vi_label: 'Tin tức', en_label: 'News', vi: 'Tin tức mới nhất về ', en_t: 'Latest news about ' },
  { key: 'tamly', en: 'sentiment', icon: Gauge, vi_label: 'Tâm lý thị trường', en_label: 'Market sentiment', vi: 'Tâm lý thị trường crypto hiện tại thế nào?', en_t: 'What is the crypto market sentiment right now?' },
  { key: 'vi', en: 'wallet', icon: Wallet, vi_label: 'Ví của tôi trên Arc', en_label: 'My Arc wallet', vi: 'Kiểm tra ví của tôi trên Arc', en_t: 'Check my wallet on Arc' },
  { key: 'arc', en: 'arc', icon: Blocks, vi_label: 'Mạng Arc', en_label: 'Arc network', vi: 'Mạng Arc Testnet đang hoạt động thế nào?', en_t: 'How is the Arc Testnet network doing?' },
  { key: 'web', en: 'web', icon: Search, vi_label: 'Tìm trên web', en_label: 'Search the web', vi: 'Tìm trên web: ', en_t: 'Search the web for ' },
]

export type ComposerHandle = { focus: () => void; setText: (s: string) => void }

type Props = {
  onSend: (s: string) => void
  onStop: () => void
  busy: boolean
  model: 'fast' | 'pro'
  setModel: (m: 'fast' | 'pro') => void
  credits: number
  onTopUp: () => void
  autoFocus?: boolean
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, onStop, busy, model, setModel, credits, onTopUp, autoFocus }, handle) {
  const { t, lang } = useI18n()
  const vi = lang === 'vi'
  const [text, setText] = useState('')
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(handle, () => ({
    focus: () => ref.current?.focus(),
    setText: (s: string) => { setText(s); requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(s.length, s.length) } }) },
  }))
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [text])
  useEffect(() => { if (autoFocus && window.matchMedia('(pointer: fine)').matches) ref.current?.focus() }, [autoFocus])

  const slash = /^\/\S*$/.test(text)
  const matches = useMemo(() => {
    if (!slash) return []
    const q = text.slice(1).toLowerCase()
    return COMMANDS.filter((c) => !q || c.key.startsWith(q) || c.en.startsWith(q) || (vi ? c.vi_label : c.en_label).toLowerCase().includes(q))
  }, [slash, text, vi])
  useEffect(() => setSel(0), [matches.length])

  const pick = (c: (typeof COMMANDS)[number]) => {
    const s = vi ? c.vi : c.en_t
    setText(s)
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(s.length, s.length) } })
  }
  const submit = () => {
    const s = text.trim()
    if (!s || busy || slash) return
    onSend(s)
    setText('')
  }
  const base = model === 'pro' ? 5 : 1
  const low = credits < 10
  const out = credits < base

  return (
    <div className="relative">
      <AnimatePresence>
        {low && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className={`mb-2 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 text-sm ${out ? 'border-rose-400/25 bg-rose-400/[0.07] text-rose-100' : 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100'}`}>
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span className="flex-1">{out ? t('noCredits') : vi ? `Bạn còn ${credits} credit. Nạp thêm để không bị gián đoạn.` : `${creditsText(credits, 'en')} left. Top up to keep going.`}</span>
            <button onClick={onTopUp} className="min-h-8 shrink-0 rounded-full bg-white px-3 py-1 text-xs md:min-h-0 font-semibold text-black transition hover:bg-zinc-200">{t('topUp')}</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d0e16]/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{vi ? 'Lệnh nhanh' : 'Quick commands'}</div>
            {matches.map((c, i) => (
              <button
                key={c.key}
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(c)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${i === sel ? 'bg-white/[0.07] text-white' : 'text-zinc-300'}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]"><c.icon className="h-3.5 w-3.5 text-teal-300" /></span>
                <span className="flex-1">{vi ? c.vi_label : c.en_label}</span>
                <span className="font-mono text-xs text-zinc-500">/{vi ? c.key : c.en}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mk-border-spin rounded-[26px]">
        <div className="rounded-[26px] border border-white/[0.09] bg-[#0c0d15]/95 p-2 shadow-[0_10px_60px_-10px_rgba(0,0,0,.8)] backdrop-blur-xl transition-colors focus-within:border-white/20">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (matches.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % matches.length); return }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + matches.length) % matches.length); return }
                if ((e.key === 'Enter' || e.key === 'Tab') && !e.nativeEvent.isComposing) { e.preventDefault(); pick(matches[sel]); return }
                if (e.key === 'Escape') { e.preventDefault(); setText(''); return }
              }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
            }}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            rows={1}
            maxLength={4000}
            className="mk-scroll block w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[15px] leading-relaxed text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="flex items-center gap-2">
              <div className="flex rounded-full bg-white/[0.04] p-0.5 text-xs font-medium" role="radiogroup" aria-label={vi ? "Chọn mô hình" : "Model"}>
                {(['fast', 'pro'] as const).map((k) => (
                  <button key={k} role="radio" aria-checked={model === k} onClick={() => setModel(k)} className={`relative flex min-h-8 items-center gap-1 rounded-full px-3 py-1.5 transition ${model === k ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {model === k && <motion.span layoutId="mk-model-pill" className="absolute inset-0 rounded-full bg-white/[0.1]" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                    <span className="relative flex items-center gap-1">
                      {k === 'fast' ? <Zap className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      {k === 'fast' ? 'Fast' : 'Pro'}
                      <span className="text-zinc-500">· {k === 'fast' ? 1 : 5}</span>
                    </span>
                  </button>
                ))}
              </div>
              <span className="hidden text-[11px] text-zinc-600 sm:inline">{vi ? `+${model === 'pro' ? 2 : 1} credit / công cụ` : `+${model === 'pro' ? 2 : 1} credit / tool`}</span>
            </div>
            <div className="flex items-center gap-2">
              {text.length > 3000 && <span className={`font-mono text-[11px] ${text.length >= 4000 ? 'text-rose-400' : 'text-zinc-500'}`}>{text.length}/4000</span>}
              {busy ? (
                <button onClick={onStop} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105" aria-label={t('stop')} title={`${t('stop')} (Esc)`}><Square className="h-3.5 w-3.5 fill-current" /></button>
              ) : (
                <button onClick={submit} disabled={!text.trim() || slash} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 hover:shadow-[0_0_24px_rgba(94,234,212,.5)] disabled:bg-white/10 disabled:text-zinc-500 disabled:shadow-none disabled:hover:scale-100" aria-label={t('send')}><ArrowUp className="h-4 w-4" /></button>
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2 hidden text-center text-[11px] text-zinc-600 sm:block">
        <span className="mk-kbd !h-4 !min-w-0 !px-1 !text-[10px]">/</span> {vi ? 'lệnh nhanh' : 'commands'} · <span className="mk-kbd !h-4 !min-w-0 !px-1 !text-[10px]">⇧↵</span> {vi ? 'xuống dòng' : 'new line'} · {vi ? 'Makoto có thể sai. Không phải lời khuyên đầu tư.' : 'Makoto can make mistakes. Not financial advice.'}
      </p>
      <p className="mt-2 text-center text-[11px] text-zinc-600 sm:hidden">{vi ? 'Makoto có thể sai. Không phải lời khuyên đầu tư.' : 'Makoto can make mistakes. Not financial advice.'}</p>
    </div>
  )
})
