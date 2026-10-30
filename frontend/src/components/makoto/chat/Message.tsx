import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, ChevronDown, CircleAlert, Copy, Loader2, Pencil, RefreshCw, ThumbsDown, ThumbsUp, Zap, ArrowUpRight, CornerDownRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { LogoMark } from '../Brand'
import { WidgetView, type Widget } from '../Widgets'
import { Markdown } from './Markdown'
import { MemoryNote } from '../Memory'

export type Step = { id: string; tool: string; label: string; status: 'running' | 'done' | 'error'; args?: Record<string, unknown>; ms?: number }
export type Msg = {
  id?: number
  key: string
  role: 'user' | 'assistant'
  content: string
  steps?: Step[]
  widgets?: Widget[]
  credits?: number
  streaming?: boolean
  error?: string
  suggestions?: string[] | null
  feedback?: number | null
  memory?: { added?: string[]; updated?: string[]; removed?: string[] } | null
}

function StepsView({ steps, streaming }: { steps: Step[]; streaming?: boolean }) {
  const { lang } = useI18n()
  const [open, setOpen] = useState(true)
  const allDone = !streaming || steps.every((s) => s.status !== 'running')
  const total = steps.reduce((a, s) => a + (s.ms || 0), 0)
  useEffect(() => { if (!streaming && steps.length > 1) setOpen(false) }, [streaming, steps.length])
  const argText = (s: Step) => {
    const a = s.args || {}
    const v = (a.symbol || a.query || a.project || a.address || a.hash || a.url || a.sort_by || '') as string
    return v && v !== 'me' ? String(v).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) : ''
  }
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 rounded-lg py-0.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
        {allDone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" />}
        <span className={allDone ? '' : 'mk-thinking'}>
          {lang === 'vi' ? `Đã dùng ${steps.length} công cụ` : `Used ${steps.length} tool${steps.length > 1 ? 's' : ''}`}
        </span>
        {allDone && total > 0 && <span className="text-zinc-600">· {(total / 1000).toFixed(1)}s</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="ml-[7px] mt-2 space-y-1.5 border-l border-white/[0.08] pl-4">
              {steps.map((s) => (
                <motion.div key={s.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-2 text-xs">
                  {s.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin text-teal-300" /> : s.status === 'error' ? <CircleAlert className="h-3 w-3 text-rose-400" /> : <Check className="h-3 w-3 text-emerald-400" />}
                  <span className={s.status === 'running' ? 'mk-thinking font-medium' : 'text-zinc-400'}>{s.label}</span>
                  {argText(s) && <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">{argText(s)}</span>}
                  {s.ms != null && <span className="text-[11px] text-zinc-600">{(s.ms / 1000).toFixed(1)}s</span>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type Source = { url: string; title: string; host: string }
function collectSources(m: Msg): Source[] {
  const out: Source[] = []
  const seen = new Set<string>()
  const add = (url?: string, title?: string) => {
    if (!url || seen.has(url)) return
    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      seen.add(url)
      out.push({ url, title: title || host, host })
    } catch { /* ignore bad urls */ }
  }
  for (const w of m.widgets || []) if (w.type === 'web_results') for (const it of w.items || []) add(it?.url, it?.title)
  for (const s of m.steps || []) if (s.tool === 'read_webpage') add(s.args?.url as string)
  return out
}

function Sources({ items }: { items: Source[] }) {
  const { lang } = useI18n()
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 4)
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{lang === 'vi' ? 'Nguồn' : 'Sources'}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map((s, i) => (
          <motion.a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="group flex min-w-0 items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition hover:border-white/[0.14] hover:bg-white/[0.045]"
          >
            <img src={`https://www.google.com/s2/favicons?domain=${s.host}&sz=32`} alt="" className="mt-0.5 h-4 w-4 shrink-0 rounded" loading="lazy" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-zinc-200 group-hover:text-white">{s.title}</div>
              <div className="truncate text-[11px] text-zinc-500">{s.host}</div>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:text-zinc-300" />
          </motion.a>
        ))}
      </div>
      {items.length > 4 && (
        <button onClick={() => setAll(!all)} className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">
          {all ? (lang === 'vi' ? 'Thu gọn' : 'Show less') : `+${items.length - 4} ${lang === 'vi' ? 'nguồn khác' : 'more'}`}
        </button>
      )}
    </div>
  )
}

function ActionBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`flex h-7 items-center justify-center gap-1 rounded-lg px-1.5 transition [@media(hover:none)]:h-8 [@media(hover:none)]:min-w-8 hover:bg-white/[0.06] ${active ? 'text-teal-300' : 'text-zinc-500 hover:text-zinc-200'}`}>
      {children}
    </button>
  )
}

export function UserMessage({ m, canEdit, onEdit }: { m: Msg; canEdit: boolean; onEdit: (text: string) => void }) {
  const { lang, t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.content)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 260) + 'px'
  }, [draft, editing])
  if (editing) {
    const save = () => {
      const s = draft.trim()
      if (!s) return
      setEditing(false)
      if (s !== m.content) onEdit(s)
    }
    return (
      <div className="ml-auto w-full max-w-[85%] rounded-3xl border border-white/[0.12] bg-white/[0.05] p-3">
        <textarea
          ref={ref}
          autoFocus
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save() }
            if (e.key === 'Escape') { setEditing(false); setDraft(m.content) }
          }}
          className="mk-scroll block w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed text-white focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <span className="mr-auto px-1 text-[11px] text-zinc-500">{lang === 'vi' ? 'Gửi lại sẽ thay câu trả lời phía dưới' : 'Resending replaces the answers below'}</span>
          <button onClick={() => { setEditing(false); setDraft(m.content) }} className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06]">{lang === 'vi' ? 'Hủy' : 'Cancel'}</button>
          <button onClick={save} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black">{t('send')}</button>
        </div>
      </div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group flex flex-col items-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-white/[0.075] px-4 py-2.5 text-[15px] leading-relaxed text-white">{m.content}</div>
      {canEdit && (
        <div className="mt-1 flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <ActionBtn label={lang === 'vi' ? 'Sửa câu hỏi' : 'Edit message'} onClick={() => { setDraft(m.content); setEditing(true) }}><Pencil className="h-3.5 w-3.5" /></ActionBtn>
          <ActionBtn label={t('copy')} onClick={() => navigator.clipboard.writeText(m.content)}><Copy className="h-3.5 w-3.5" /></ActionBtn>
        </div>
      )}
    </motion.div>
  )
}

export function AssistantMessage({ m, isLast, busy, onRegenerate, onFeedback, onSuggest }: {
  m: Msg
  isLast: boolean
  busy: boolean
  onRegenerate?: () => void
  onFeedback: (v: number) => void
  onSuggest: (s: string) => void
}) {
  const { t, lang } = useI18n()
  const [copied, setCopied] = useState(false)
  const thinking = m.streaming && !m.content && !(m.steps?.length)
  const sources = useMemo(() => collectSources(m), [m])
  const widgets = (m.widgets || []).filter((w) => w.type !== 'web_results')
  const done = !m.streaming
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group flex gap-3.5">
      <div className="relative mt-0.5 shrink-0">
        <LogoMark size={28} animated={m.streaming} />
        {m.streaming && <span className="absolute inset-0 rounded-[8px] border border-teal-300/60" style={{ animation: 'mk-pulse-ring 1.4s ease-out infinite' }} />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {thinking && <div className="mk-thinking pt-1 text-sm font-medium">{t('thinking')}…</div>}
        {m.steps && m.steps.length > 0 && <StepsView steps={m.steps} streaming={m.streaming} />}
        {sources.length > 0 && <Sources items={sources} />}
        {widgets.length > 0 && <div className="mb-4 grid gap-3">{widgets.map((w, i) => <WidgetView key={i} w={w} />)}</div>}
        {m.content && (
          <div className={`mk-md ${m.streaming ? 'mk-stream mk-cursor-last' : ''}`}>
            <Markdown text={m.content} />
          </div>
        )}
        {m.error && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-200">
            <CircleAlert className="h-4 w-4 shrink-0" /><span className="flex-1">{m.error}</span>
            {onRegenerate && !busy && <button onClick={onRegenerate} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/15">{t('retry')}</button>}
          </div>
        )}
        {done && (m.content || m.error) && (
          <div className={`mt-2 flex items-center gap-0.5 text-xs text-zinc-500 transition ${isLast ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'}`}>
            {m.content && (
              <ActionBtn label={copied ? t('copied') : t('copy')} onClick={() => { navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </ActionBtn>
            )}
            {onRegenerate && !busy && !m.error && (
              <ActionBtn label={lang === 'vi' ? 'Tạo lại câu trả lời' : 'Regenerate'} onClick={onRegenerate}><RefreshCw className="h-3.5 w-3.5" /></ActionBtn>
            )}
            {m.id != null && (
              <>
                <ActionBtn label={lang === 'vi' ? 'Câu trả lời tốt' : 'Good response'} active={m.feedback === 1} onClick={() => onFeedback(m.feedback === 1 ? 0 : 1)}><ThumbsUp className={`h-3.5 w-3.5 ${m.feedback === 1 ? 'fill-current' : ''}`} /></ActionBtn>
                <ActionBtn label={lang === 'vi' ? 'Câu trả lời chưa tốt' : 'Bad response'} active={m.feedback === -1} onClick={() => onFeedback(m.feedback === -1 ? 0 : -1)}><ThumbsDown className={`h-3.5 w-3.5 ${m.feedback === -1 ? 'fill-current' : ''}`} /></ActionBtn>
              </>
            )}
            {m.credits != null && m.credits > 0 && <span className="ml-1.5 flex items-center gap-1 text-zinc-600"><Zap className="h-3 w-3" />{t('used', { n: m.credits })}</span>}
          </div>
        )}
        {m.memory && <MemoryNote mem={m.memory} />}
        <AnimatePresence>
          {isLast && done && !busy && m.suggestions && m.suggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 border-t border-white/[0.05] pt-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{lang === 'vi' ? 'Hỏi tiếp' : 'Follow up'}</div>
              <div className="flex flex-col items-start gap-1.5">
                {m.suggestions.map((s, i) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.06 }}
                    onClick={() => onSuggest(s)}
                    className="group/s flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover/s:text-teal-300" />{s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-5 pt-10" aria-hidden>
      <div className="flex justify-end"><div className="mk-skel h-10 w-2/5 rounded-3xl" /></div>
      <div className="flex gap-3.5">
        <div className="mk-skel h-7 w-7 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="mk-skel h-3.5 w-11/12" /><div className="mk-skel h-3.5 w-4/5" /><div className="mk-skel h-3.5 w-3/5" />
          <div className="mk-skel mt-4 h-40 w-full rounded-2xl" />
        </div>
      </div>
      <div className="flex justify-end"><div className="mk-skel h-10 w-1/3 rounded-3xl" /></div>
    </div>
  )
}
