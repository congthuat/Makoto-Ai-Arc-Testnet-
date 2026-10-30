import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ClipboardPaste, Loader2, Check as CheckIcon, ShieldCheck, Trash2, ArrowLeft, Sparkles, History } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/lib/session'
import { useI18n, creditsText } from '@/lib/i18n'
import { timeAgo } from '@/lib/format'
import { VerdictReport, VerdictBadge, type Check, type Verdict } from './Report'

const COST = 3
const MAX = 3000

const STEPS: { key: string; vi: string; en: string }[] = [
  { key: 'read', vi: 'Đọc tin nhắn, tìm token & nhận định', en: 'Reading the message' },
  { key: 'gather', vi: 'Soi ví KOL, sàn niêm yết, lịch xả token & hợp đồng', en: 'Checking KOL wallets, listings, unlocks & contract' },
  { key: 'debate', vi: 'Đánh giá hai chiều: ủng hộ và phản biện', en: 'Advocate vs skeptic debate' },
  { key: 'judge', vi: 'Trọng tài đối chiếu và chấm điểm', en: 'Referee cross-checks & scores' },
]

const EXAMPLES: { vi: string; en: string; text: string }[] = [
  { vi: 'Tin nhắn quảng bá trong nhóm', en: 'Group shill', text: '🚀🚀 $PEPE sắp x10 trong tuần này!! Binance chuẩn bị list, cá voi đang gom mạnh. Vào ngay kẻo lỡ, chỉ còn vài giờ!!! 💎🙌' },
  { vi: 'Lời mời presale', en: 'Presale invite', text: 'Chào bạn, mình là admin dự án. Presale token MOONX còn 2 slot cuối, cam kết lãi 300% sau 1 tuần. Gửi 500 USDT vào ví 0x8f3a...c21d để giữ chỗ nhé, hết hạn tối nay.' },
  { vi: 'Hỏi về token', en: 'Ask about token', text: 'ARB có đáng ôm dài hạn không? Nghe nói sắp có đợt mở khóa lớn.' },
]

type Item = { id: number; input: string; score: number; verdict: Verdict; symbol: string | null; created_at: string; token?: Check['token']; headline?: string }

export function VerifyView({ onAsk, onNeedCredits }: { onAsk: (text: string) => void; onNeedCredits: () => void }) {
  const { token, authFetch, setCredits, me } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(-1)
  const [result, setResult] = useState<Check | null>(null)
  const [opening, setOpening] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => () => {
    // The server keeps running a check after we disconnect, so refresh balance + history.
    if (abortRef.current) {
      abortRef.current.abort()
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['checks'] })
    }
  }, [qc])
  useEffect(() => {
    if (!busy) return
    const t0 = Date.now()
    setElapsed(0)
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [busy])

  const { data: hist, isLoading: histLoading, isError: histError, refetch: refetchHist } = useQuery<{ checks: Item[] }>({
    queryKey: ['checks', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const r = await authFetch('verify')
      if (!r.ok) throw new Error('load')
      return r.json()
    },
  })
  const items = hist?.checks || []
  const credits = me?.user?.credits ?? null

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setText(t.slice(0, MAX))
      taRef.current?.focus()
    } catch {
      toast(vi ? 'Trình duyệt chặn dán tự động — bấm Ctrl+V vào ô nhé' : 'Clipboard blocked — press Ctrl+V in the box')
      taRef.current?.focus()
    }
  }

  const run = async () => {
    const body = text.trim()
    if (body.length < 2 || busy) return
    if (credits != null && credits < COST) return onNeedCredits()
    setBusy(true)
    setResult(null)
    setStep(0)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await authFetch('verify', { method: 'POST', body: JSON.stringify({ text: body, lang }), signal: ctrl.signal })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        if (err.code === 'NO_CREDITS') { onNeedCredits(); return }
        if (res.status === 429) throw new Error(vi ? 'Bạn kiểm tra hơi nhanh, đợi một phút rồi thử lại nhé.' : 'Too many checks — wait a minute.')
        throw new Error(vi ? 'Không gửi được yêu cầu, thử lại sau.' : 'Request failed, try again.')
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let finished = false
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const ev = block.match(/^event: (.+)$/m)?.[1]
          const raw = block.match(/^data: (.*)$/m)?.[1]
          if (!ev || raw == null) continue
          const data = JSON.parse(raw)
          if (ev === 'step') {
            const i = STEPS.findIndex((s) => s.key === data.key)
            if (i >= 0) setStep(i)
          } else if (ev === 'done') {
            finished = true
            setStep(STEPS.length)
            setCredits(data.balance)
            setResult(data.check)
            qc.invalidateQueries({ queryKey: ['checks'] })
            qc.invalidateQueries({ queryKey: ['me'] })
            requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
          } else if (ev === 'error') {
            throw new Error(vi ? 'Kiểm tra thất bại — bạn chưa bị trừ credit. Thử lại nhé.' : 'Check failed — you were not charged. Try again.')
          }
        }
      }
      if (!finished) throw new Error(vi ? 'Kết nối bị ngắt — bạn chưa bị trừ credit.' : 'Connection dropped — you were not charged.')
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(e?.message || 'Error')
      setStep(-1)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const open = async (id: number) => {
    setOpening(id)
    try {
      const r = await authFetch(`verify/${id}`)
      if (!r.ok) throw new Error()
      const { check } = await r.json()
      setResult(check)
      setText(check.input || '')
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch {
      toast.error(vi ? 'Không mở được kết quả này' : 'Could not open this check')
    } finally {
      setOpening(null)
    }
  }

  const remove = async (id: number) => {
    if (!window.confirm(vi ? 'Xóa kết quả xác minh này?' : 'Delete this verification?')) return
    try {
      const r = await authFetch(`verify/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      qc.setQueryData<{ checks: Item[] }>(['checks', token], (d) => (d ? { checks: d.checks.filter((x) => x.id !== id) } : d))
      if (result?.id === id) setResult(null)
      toast.success(vi ? 'Đã xóa' : 'Deleted')
    } catch {
      toast.error(vi ? 'Không xóa được. Vui lòng thử lại.' : 'Couldn’t delete. Please try again.')
    }
  }

  const reset = () => {
    setResult(null)
    setText('')
    setStep(-1)
    requestAnimationFrame(() => taRef.current?.focus())
  }

  return (
    <div className="mk-scroll h-full overflow-y-auto">
    <div className="mx-auto w-full max-w-3xl px-5 py-10">
      <div ref={topRef} className="scroll-mt-6" />
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-teal-300/20 bg-teal-300/[0.07] px-2.5 py-1 text-[11px] font-medium text-teal-200">
          <ShieldCheck className="h-3.5 w-3.5" />{vi ? 'Xác minh trước khi đầu tư' : 'Verify before you invest'}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">{vi ? 'Xác minh' : 'Verify'}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          {vi
            ? 'Tín hiệu giao dịch, lời mời presale, tên token hoặc địa chỉ hợp đồng. Makoto đối chiếu từng nhận định với dữ liệu thực (giá, ví cá voi, lịch mở khóa, tin tức) và đưa ra điểm tin cậy trong khoảng 20 giây.'
            : 'Trading signals, presale invites, token names or contract addresses. Makoto checks every claim against live data (price, whale wallets, unlocks, news) and scores it in about 20 seconds.'}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key={`r-${result.id ?? 'new'}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-zinc-400 transition hover:text-white">
                <ArrowLeft className="h-4 w-4" />{vi ? 'Xác minh tín hiệu khác' : 'Verify another'}
              </button>
            </div>
            {result.input && (
              <div className="mb-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="mb-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500">{vi ? 'Nội dung đã kiểm' : 'Checked text'}</div>
                <p className="line-clamp-4 whitespace-pre-wrap text-[13px] text-zinc-300">{result.input}</p>
              </div>
            )}
            <VerdictReport c={result} onAsk={onAsk} />
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <div className={`rounded-2xl border bg-white/[0.02] transition ${busy ? 'border-teal-300/25' : 'border-white/[0.08] focus-within:border-white/[0.18]'}`}>
              <textarea
                ref={taRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX))}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
                disabled={busy}
                rows={6}
                placeholder={vi ? 'Ví dụ: "$ABC sắp list Binance, x20 trong tuần, vào nhanh kẻo lỡ…" hoặc dán địa chỉ hợp đồng 0x…' : 'e.g. "$ABC listing on Binance soon, 20x this week…" or paste a 0x… contract'}
                className="block w-full resize-none bg-transparent px-4 pt-4 text-[15px] leading-relaxed text-white outline-none placeholder:text-zinc-600 disabled:opacity-60"
              />
              <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-2">
                <button onClick={paste} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50">
                  <ClipboardPaste className="h-3.5 w-3.5" />{vi ? 'Dán' : 'Paste'}
                </button>
                <span className="text-[11px] tabular-nums text-zinc-600">{text.length}/{MAX}</span>
                <button
                  onClick={run}
                  disabled={busy || text.trim().length < 2}
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_0_28px_rgba(94,234,212,.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
                  title={vi ? 'Chỉ trừ credit khi kiểm tra thành công · Ctrl+Enter' : 'Only charged on success · Ctrl+Enter'}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {busy ? (vi ? 'Đang kiểm…' : 'Checking…') : `${vi ? 'Kiểm tra' : 'Check'} · ${creditsText(COST, lang)}`}
                </button>
              </div>
            </div>

            {!busy && !text && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">{vi ? 'Thử nhanh:' : 'Try:'}</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex.vi} onClick={() => setText(ex.text)} className="min-h-9 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition md:min-h-0 md:py-1 hover:border-white/[0.16] hover:text-white">
                    {vi ? ex.vi : ex.en}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence>
              {busy && (
                <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3" aria-live="polite">
                  {STEPS.map((s, i) => {
                    const state = i < step ? 'done' : i === step ? 'active' : 'todo'
                    return (
                      <li key={s.key} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${state === 'done' ? 'bg-emerald-400/15 text-emerald-300' : state === 'active' ? 'bg-teal-300/10 text-teal-200' : 'bg-white/[0.04] text-zinc-600'}`}>
                          {state === 'done' ? <CheckIcon className="h-3.5 w-3.5" /> : state === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[11px]">{i + 1}</span>}
                        </span>
                        <span className={state === 'todo' ? 'text-zinc-600' : state === 'active' ? 'text-white' : 'text-zinc-400'}>{vi ? s.vi : s.en}</span>
                        {state === 'active' && <span className="ml-auto text-[11px] tabular-nums text-zinc-500">{elapsed}s</span>}
                      </li>
                    )
                  })}
                  <li className="px-2 pt-1 text-[11px] text-zinc-600">{vi ? 'Chỉ trừ credit khi có kết quả. Bạn có thể chuyển trang, kết quả vẫn được lưu ở mục Lịch sử bên dưới.' : 'You are only charged when the result is ready. You can leave this page; the result will still be saved in History below.'}</li>
                </motion.ol>
              )}
            </AnimatePresence>

            {!busy && (
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  { t: vi ? 'Kiểm từng nhận định' : 'Every claim checked', d: vi ? '"Sắp list sàn", "cá voi gom", "x10"… đúng, sai hay gây hiểu lầm.' : '"Listing soon", "whales buying", "10x"… true or not.' },
                  { t: vi ? 'Soi bẫy trong hợp đồng' : 'Contract trap scan', d: vi ? 'Mua được mà không bán được? Thuế ẩn? Chủ in thêm token? Kèm ví cá voi, lịch mở khóa.' : 'Honeypot, hidden tax, mint powers, whales, unlocks.' },
                  { t: vi ? 'Nhận diện chiêu lừa' : 'Spots scam tactics', d: vi ? 'Hối thúc, hứa lãi cố định, đòi chuyển tiền — cảnh báo ngay.' : 'FOMO, guaranteed returns, send-money asks.' },
                ].map((f) => (
                  <div key={f.t} className="rounded-2xl border border-white/[0.05] p-3.5">
                    <div className="text-sm font-medium text-zinc-100">{f.t}</div>
                    <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{f.d}</div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <div className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-300"><History className="h-4 w-4 text-zinc-500" />{vi ? 'Lịch sử xác minh' : 'Verification history'}</h2>
        {histLoading ? (
          <div className="space-y-1.5">{[0, 1, 2].map((i) => <div key={i} className="mk-skel h-[58px] rounded-2xl" />)}</div>
        ) : histError && !hist ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] px-4 py-4 text-sm text-zinc-400">
            {vi ? 'Không tải được lịch sử xác minh.' : 'Couldn’t load verification history.'}
            <button onClick={() => refetchHist()} className="min-h-8 shrink-0 rounded-full border border-white/10 px-3 text-xs text-zinc-200 hover:bg-white/5">{vi ? 'Thử lại' : 'Try again'}</button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.08] px-4 py-5 text-sm text-zinc-500">
            <Sparkles className="h-4 w-4 text-zinc-600" />{vi ? 'Chưa có lần xác minh nào.' : 'No verifications yet.'}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it) => (
              <li key={it.id} className="group flex items-center gap-2">
                <button onClick={() => open(it.id)} disabled={opening === it.id} className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${result?.id === it.id ? 'border-white/[0.16] bg-white/[0.04]' : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]'}`}>
                  <span className="w-9 shrink-0 text-center text-lg font-semibold tabular-nums text-zinc-100">{it.verdict === 'unknown' ? '?' : it.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-200">{it.headline || it.input}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                      {it.symbol && <span className="font-medium text-zinc-400">${it.symbol}</span>}
                      <span>{timeAgo(it.created_at, vi ? 'vi' : 'en')}</span>
                    </span>
                  </span>
                  {opening === it.id ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : <VerdictBadge verdict={it.verdict} small />}
                </button>
                <button onClick={() => remove(it.id)} className="rounded-full p-2 text-zinc-600 opacity-0 transition hover:bg-white/[0.05] hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" title={vi ? 'Xóa' : 'Delete'} aria-label={vi ? 'Xóa' : 'Delete'}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    </div>
  )
}
