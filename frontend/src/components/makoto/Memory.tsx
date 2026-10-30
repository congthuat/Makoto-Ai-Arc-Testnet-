import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Brain, Check, Pencil, Plus, Trash2, X, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { timeAgo } from '@/lib/format'

type Mem = { id: number; content: string; category: string | null; source: string | null; created_at: string; updated_at: string }
type Data = { enabled: boolean; items: Mem[]; max: number }

const CAT: Record<string, { vi: string; en: string; cls: string }> = {
  holdings: { vi: 'Danh mục', en: 'Holdings', cls: 'text-teal-200 bg-teal-300/10' },
  risk: { vi: 'Rủi ro', en: 'Risk', cls: 'text-amber-200 bg-amber-300/10' },
  style: { vi: 'Phong cách', en: 'Style', cls: 'text-sky-200 bg-sky-300/10' },
  goal: { vi: 'Mục tiêu', en: 'Goal', cls: 'text-violet-200 bg-violet-300/10' },
  experience: { vi: 'Kinh nghiệm', en: 'Experience', cls: 'text-emerald-200 bg-emerald-300/10' },
  preference: { vi: 'Sở thích', en: 'Preference', cls: 'text-rose-200 bg-rose-300/10' },
  other: { vi: 'Khác', en: 'Other', cls: 'text-zinc-300 bg-white/[0.06]' },
}

/** Opens Settings and scrolls to the memory panel (used from chat "remembered" notes). */
export function openMemory() {
  window.dispatchEvent(new CustomEvent('mk:open-memory'))
}

export function MemoryPanel() {
  const { token, authFetch } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const qc = useQueryClient()
  const key = ['memory', token]
  const { data, isLoading } = useQuery<Data>({
    queryKey: key,
    enabled: Boolean(token),
    queryFn: async () => {
      const r = await authFetch('memory')
      if (!r.ok) throw new Error('load')
      return r.json()
    },
  })
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const items = data?.items || []
  const enabled = data?.enabled !== false

  const set = (fn: (d: Data) => Data) => qc.setQueryData<Data>(key, (d) => (d ? fn(d) : d))
  const errMsg = (code?: string) =>
    code === 'SENSITIVE'
      ? vi ? 'Không lưu được: có vẻ chứa thông tin nhạy cảm (seed, khóa ví, email, số điện thoại).' : 'Looks sensitive (seed, key, email, phone) — not saved.'
      : code === 'FULL'
        ? vi ? 'Trí nhớ đã đầy, hãy xóa bớt.' : 'Memory is full — delete some first.'
        : vi ? 'Không lưu được, thử lại nhé.' : 'Could not save.'

  const toggle = async () => {
    const next = !enabled
    set((d) => ({ ...d, enabled: next }))
    const r = await authFetch('memory/settings', { method: 'PUT', body: JSON.stringify({ enabled: next }) })
    if (!r.ok) { set((d) => ({ ...d, enabled: !next })); toast.error(errMsg()) }
    else toast.success(next ? (vi ? 'Đã bật trí nhớ' : 'Memory on') : vi ? 'Đã tắt trí nhớ — Makoto sẽ không dùng hay học thêm' : 'Memory off')
  }

  const add = async () => {
    const content = draft.trim()
    if (content.length < 3) return
    setAdding(true)
    try {
      const r = await authFetch('memory', { method: 'POST', body: JSON.stringify({ content }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(errMsg(j.code)); return }
      set((d) => ({ ...d, items: [j.item, ...d.items] }))
      setDraft('')
    } catch {
      toast.error(errMsg())
    } finally {
      setAdding(false)
    }
  }

  const save = async (id: number) => {
    const content = editText.trim()
    if (content.length < 3) return
    const r = await authFetch(`memory/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return toast.error(errMsg(j.code))
    set((d) => ({ ...d, items: d.items.map((m) => (m.id === id ? j.item : m)) }))
    setEditId(null)
  }

  const remove = async (id: number) => {
    set((d) => ({ ...d, items: d.items.filter((m) => m.id !== id) }))
    const r = await authFetch(`memory/${id}`, { method: 'DELETE' })
    if (!r.ok) qc.invalidateQueries({ queryKey: key })
  }

  const clearAll = async () => {
    setConfirmClear(false)
    const fail = () => toast.error(vi ? 'Không xóa được trí nhớ, thử lại nhé.' : 'Couldn’t clear memories. Please try again.')
    try {
      const r = await authFetch('memory', { method: 'DELETE' })
      if (r.ok) { set((d) => ({ ...d, items: [] })); toast.success(vi ? 'Makoto đã quên hết' : 'All memories cleared') }
      else fail()
    } catch {
      fail()
    }
  }

  return (
    <section id="memory" className="mt-6 scroll-mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="flex flex-col gap-3 border-b border-white/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-200"><Brain className="h-4.5 w-4.5" /></span>
          <div>
            <div className="font-semibold text-white">{vi ? 'Trí nhớ của Makoto' : "Makoto's memory"}</div>
            <div className="text-sm text-zinc-500">{vi ? 'Những điều Makoto nhớ về bạn để trả lời sát hơn: coin đang giữ, khẩu vị rủi ro, mục tiêu…' : 'What Makoto remembers to personalize answers: holdings, risk appetite, goals…'}</div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={vi ? 'Cho Makoto ghi nhớ' : 'Let Makoto remember'}
          onClick={toggle}
          disabled={isLoading}
          className={`relative h-6 w-11 shrink-0 rounded-full transition mk-no-press before:absolute before:-inset-2.5 before:content-[''] ${enabled ? 'bg-teal-400' : 'bg-white/[0.12]'}`}
          title={enabled ? (vi ? 'Đang bật' : 'On') : vi ? 'Đang tắt' : 'Off'}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      <div className={`px-5 py-4 transition ${enabled ? '' : 'opacity-50'}`}>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 200))}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder={vi ? 'Tự thêm, ví dụ: "Mình chỉ đầu tư tối đa 10 triệu/tháng"' : 'Add one, e.g. "I invest at most $500/month"'}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/[0.2]"
          />
          <button onClick={add} disabled={adding || draft.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition disabled:opacity-40">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{vi ? 'Thêm' : 'Add'}
          </button>
        </div>

        {isLoading ? (
          <div className="mt-3 space-y-2">{[0, 1].map((i) => <div key={i} className="mk-skel h-11 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-white/[0.08] px-4 py-5 text-center text-sm text-zinc-500">
            {vi ? 'Chưa có gì. Cứ trò chuyện bình thường, ví dụ "mình đang giữ 0,2 BTC, thích an toàn" — Makoto sẽ tự ghi nhớ.' : 'Nothing yet. Just chat, e.g. "I hold 0.2 BTC and prefer safe plays" — Makoto will remember.'}
          </div>
        ) : (
          <ul className="mt-3 space-y-1.5">
            <AnimatePresence initial={false}>
              {items.map((m) => {
                const c = CAT[m.category || 'other'] || CAT.other
                return (
                  <motion.li key={m.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }} className="group flex items-start gap-2.5 rounded-xl border border-white/[0.05] px-3 py-2.5">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${c.cls}`}>{vi ? c.vi : c.en}</span>
                    {editId === m.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value.slice(0, 200))} onKeyDown={(e) => { if (e.key === 'Enter') save(m.id); if (e.key === 'Escape') setEditId(null) }} className="min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-transparent px-2 py-1 text-sm text-white outline-none" />
                        <button onClick={() => save(m.id)} className="rounded-lg p-1.5 text-emerald-300 hover:bg-white/[0.05]" aria-label={vi ? 'Lưu' : 'Save'}><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditId(null)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05]" aria-label={vi ? 'Hủy' : 'Cancel'}><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-zinc-200">{m.content}</div>
                          <div className="mt-0.5 text-[11px] text-zinc-600">{m.source === 'manual' ? (vi ? 'Bạn tự thêm' : 'Added by you') : vi ? 'Học từ trò chuyện' : 'Learned from chat'} · {timeAgo(m.updated_at, vi ? 'vi' : 'en')}</div>
                        </div>
                        <div className="flex shrink-0 opacity-60 transition group-hover:opacity-100">
                          <button onClick={() => { setEditId(m.id); setEditText(m.content) }} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-white" title={vi ? 'Sửa' : 'Edit'} aria-label={vi ? 'Sửa' : 'Edit'}><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(m.id)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-rose-300" title={vi ? 'Quên điều này' : 'Forget this'} aria-label={vi ? 'Quên điều này' : 'Forget this'}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" />{vi ? 'Makoto không bao giờ ghi nhớ seed phrase, khóa ví, mật khẩu, email hay số điện thoại.' : 'Makoto never stores seed phrases, keys, passwords, emails or phone numbers.'}</span>
          {items.length > 0 && (
            confirmClear ? (
              <span className="ml-auto inline-flex items-center gap-2">
                {vi ? 'Xóa hết trí nhớ?' : 'Forget everything?'}
                <button onClick={clearAll} className="rounded-lg bg-rose-500/15 px-2 py-1 font-semibold text-rose-200 hover:bg-rose-500/25">{vi ? 'Xóa hết' : 'Clear all'}</button>
                <button onClick={() => setConfirmClear(false)} className="rounded-lg px-2 py-1 hover:text-white">{vi ? 'Hủy' : 'Cancel'}</button>
              </span>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="ml-auto rounded-lg px-2 py-1 hover:text-rose-300">{vi ? 'Quên tất cả' : 'Forget all'} ({items.length})</button>
            )
          )}
        </div>
      </div>
    </section>
  )
}

/** Small note under an answer: "Makoto remembered …". */
export function MemoryNote({ mem }: { mem: { added?: string[]; updated?: string[]; removed?: string[] } }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const changed = [...(mem.added || []), ...(mem.updated || [])]
  const removed = (mem.removed || []).filter(Boolean)
  if (!changed.length && !removed.length) return null
  const first = changed[0] || removed[0]
  const more = changed.length + removed.length - 1
  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={openMemory}
      title={[...changed.map((x) => `+ ${x}`), ...removed.map((x) => `− ${x}`)].join('\n')}
      className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/[0.06] py-1 pl-2 pr-3 text-left text-xs text-violet-100 transition hover:border-violet-300/30"
    >
      <Brain className="h-3.5 w-3.5 shrink-0 text-violet-300" />
      <span className="shrink-0 font-medium">{changed.length ? (vi ? 'Đã ghi nhớ:' : 'Remembered:') : vi ? 'Đã quên:' : 'Forgot:'}</span>
      <span className="truncate text-violet-100/80">{first}</span>
      {more > 0 && <span className="shrink-0 text-violet-200/60">+{more}</span>}
    </motion.button>
  )
}
