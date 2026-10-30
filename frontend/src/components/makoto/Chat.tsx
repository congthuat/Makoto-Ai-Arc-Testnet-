import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, TrendingUp, Newspaper, Blocks, Wallet, Gauge, Search, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { LogoMark } from './Brand'
import { Aurora, ChatBackdrop } from './Aurora'
import { AssistantMessage, UserMessage, MessageSkeleton, type Msg } from './chat/Message'
import { Composer, type ComposerHandle } from './chat/Composer'
import { Onboarding } from './chat/Onboarding'
import { Watchlist, BriefingCard } from './chat/Home'
import { friendlyError } from '@/lib/errors'

export type { Msg }

const uid = () => Math.random().toString(36).slice(2)

const SUGGESTIONS = {
  vi: [
    { icon: TrendingUp, text: 'Giá BTC và ETH 30 ngày qua, xu hướng thế nào?' },
    { icon: ShieldCheck, text: 'Xác minh: "$PEPE sắp niêm yết trên Binance, tăng x10 trong tuần này."' },
    { icon: Newspaper, text: 'Tóm tắt tin crypto nổi bật nhất hôm nay' },
    { icon: Wallet, text: 'Kiểm tra ví của tôi trên Arc' },
    { icon: Blocks, text: 'Mạng Arc Testnet đang hoạt động ra sao?' },
    { icon: Gauge, text: 'Tâm lý thị trường đang sợ hãi hay tham lam?' },
    { icon: Search, text: 'Arc của Circle là gì và khác gì Ethereum?' },
  ],
  en: [
    { icon: TrendingUp, text: 'How did BTC and ETH trend over 30 days?' },
    { icon: ShieldCheck, text: 'Check this call: "$PEPE listing on Binance soon, 10x this week, get in now!"' },
    { icon: Newspaper, text: "Summarize today's biggest crypto news" },
    { icon: Wallet, text: 'Check my wallet on Arc' },
    { icon: Blocks, text: 'How is the Arc Testnet network doing?' },
    { icon: Gauge, text: 'Is the market in fear or greed right now?' },
    { icon: Search, text: "What is Circle's Arc and how is it different from Ethereum?" },
  ],
}

export function ChatView({ conversationId, onConversation, onNeedCredits, pendingPrompt, onPromptConsumed }: { conversationId: number | null; onConversation: (id: number | null) => void; onNeedCredits: () => void; pendingPrompt?: string | null; onPromptConsumed?: () => void }) {
  const { authFetch, token, me, setCredits, refreshMe } = useSession()
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const [messages, setMessages] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [model, setModelState] = useState<'fast' | 'pro'>('fast')
  const abortRef = useRef<AbortController | null>(null)
  const ownIdRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<ComposerHandle>(null)
  const stick = useRef(true)
  const credits = me?.user.credits ?? 0

  useEffect(() => { if (me?.user.model) setModelState(me.user.model) }, [me?.user.model])
  const setModel = (m: 'fast' | 'pro') => {
    setModelState(m)
    authFetch('me', { method: 'PATCH', body: JSON.stringify({ model: m }) }).then(() => refreshMe()).catch(() => {})
  }

  // Load conversation when switching
  useEffect(() => {
    if (conversationId == null) {
      ownIdRef.current = null
      abortRef.current?.abort()
      setMessages([])
      return
    }
    if (ownIdRef.current === conversationId) return
    ownIdRef.current = null
    abortRef.current?.abort()
    let cancelled = false
    setLoading(true)
    setMessages([])
    authFetch(`conversations/${conversationId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (cancelled) return
        setMessages((d.messages || []).map((m: Msg & { id: number }) => ({ ...m, key: String(m.id), steps: m.steps || [], widgets: m.widgets || [] })))
        stick.current = true
      })
      .catch(() => {
        if (cancelled) return
        toast.error(lang === 'vi' ? 'Không tải được cuộc trò chuyện. Đã mở cuộc trò chuyện mới.' : 'Couldn’t load the conversation. Started a new chat instead.')
        onConversation(null)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  // Autoscroll while sticking to the bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Esc stops generation
  useEffect(() => {
    if (!busy) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') abortRef.current?.abort() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy])

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    stick.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  const run = useCallback(async (text: string, opts?: { truncateFrom?: number; keepUntil?: number }) => {
    if (busy || !token) return
    if (credits < (model === 'pro' ? 5 : 1)) {
      toast.error(t('noCredits'))
      onNeedCredits()
      return
    }
    const ukey = uid()
    const akey = uid()
    const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.key === akey ? fn(m) : m)))
    stick.current = true
    setMessages((ms) => [
      ...(opts?.keepUntil != null ? ms.slice(0, opts.keepUntil) : ms),
      { key: ukey, role: 'user', content: text },
      { key: akey, role: 'assistant', content: '', steps: [], widgets: [], streaming: true },
    ])
    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const firstMessage = (me?.stats?.messages ?? 0) === 0
    try {
      const res = await fetch(api('chat'), {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, conversationId, model, lang, truncateFrom: opts?.truncateFrom }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        if (err.code === 'NO_CREDITS') onNeedCredits()
        throw new Error(friendlyError(err.message || err.error || (res.status === 429 ? 'rate_limited' : ''), lang))
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
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
          let data
          try { data = JSON.parse(raw) } catch { continue } // skip a malformed frame, keep the answer going
          if (ev === 'meta') {
            setMessages((ms) => ms.map((m) => (m.key === ukey ? { ...m, id: data.userMessageId } : m)))
            if (data.conversationId !== conversationId) {
              ownIdRef.current = data.conversationId
              onConversation(data.conversationId)
              qc.invalidateQueries({ queryKey: ['conversations'] })
            }
          } else if (ev === 'delta') {
            patch((m) => ({ ...m, content: m.content + data.text }))
          } else if (ev === 'step') {
            patch((m) => {
              const steps = (m.steps || []).slice()
              const i = steps.findIndex((s) => s.id === data.id)
              if (i >= 0) steps[i] = data
              else steps.push(data)
              return { ...m, steps }
            })
          } else if (ev === 'widget') {
            patch((m) => ({ ...m, widgets: [...(m.widgets || []), data] }))
          } else if (ev === 'title') {
            qc.invalidateQueries({ queryKey: ['conversations'] })
          } else if (ev === 'done') {
            patch((m) => ({ ...m, id: data.messageId, credits: data.credits, streaming: false }))
            setCredits(data.balance)
            if (abortRef.current === ctrl) setBusy(false)
            if (firstMessage) refreshMe()
          } else if (ev === 'memory') {
            patch((m) => ({ ...m, memory: { added: data.added, updated: data.updated, removed: data.removed } }))
            qc.invalidateQueries({ queryKey: ['memory'] })
          } else if (ev === 'suggestions') {
            patch((m) => ({ ...m, suggestions: data.items }))
          } else if (ev === 'error') {
            patch((m) => ({ ...m, streaming: false, error: friendlyError(data.message, lang) }))
          }
        }
      }
    } catch (e) {
      const aborted = (e as Error)?.name === 'AbortError'
      patch((m) => ({ ...m, streaming: false, error: aborted ? m.error : friendlyError(e, lang) }))
    } finally {
      patch((m) => (m.streaming ? { ...m, streaming: false } : m))
      if (abortRef.current === ctrl) {
        setBusy(false)
        abortRef.current = null
      }
      qc.invalidateQueries({ queryKey: ['conversations'] })
    }
  }, [busy, token, credits, model, conversationId, lang, me?.stats?.messages, onConversation, onNeedCredits, qc, setCredits, refreshMe, t])

  const send = useCallback((text: string) => run(text), [run])

  // A prompt handed over from another screen (e.g. "analyze this wallet").
  useEffect(() => {
    if (!pendingPrompt || conversationId != null || busy) return
    onPromptConsumed?.()
    send(pendingPrompt)
  }, [pendingPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  const regenerate = (i: number) => {
    const u = messages[i - 1]
    if (!u || u.role !== 'user' || u.id == null) return
    run(u.content, { truncateFrom: u.id, keepUntil: i - 1 })
  }
  const edit = (i: number, text: string) => {
    const u = messages[i]
    if (u?.id == null) return
    run(text, { truncateFrom: u.id, keepUntil: i })
  }
  const feedback = (m: Msg, v: number) => {
    if (m.id == null || conversationId == null) return
    setMessages((ms) => ms.map((x) => (x.key === m.key ? { ...x, feedback: v || null } : x)))
    authFetch(`conversations/${conversationId}/messages/${m.id}`, { method: 'PATCH', body: JSON.stringify({ feedback: v }) }).catch(() => {})
    if (v) toast.success(lang === 'vi' ? 'Cảm ơn góp ý của bạn!' : 'Thanks for the feedback!')
  }

  const empty = messages.length === 0 && !loading
  const h = new Date().getHours()
  const greet = lang === 'vi' ? (h < 12 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối') : (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
  const lastIdx = messages.length - 1

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {empty ? <Aurora intensity={0.45} className="opacity-70" /> : <ChatBackdrop />}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          stick.current = near
          if (near !== atBottom) setAtBottom(near)
        }}
        className="mk-scroll relative min-h-0 flex-1 overflow-y-auto"
      >
        {loading && <MessageSkeleton />}
        {empty ? (
          <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center px-5 pb-10 pt-[6vh]">
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }} style={{ animation: 'mk-float 6s ease-in-out infinite' }}>
              <div className="relative">
                <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-teal-300/40 via-blue-500/40 to-violet-600/40 blur-2xl" />
                <div className="relative"><LogoMark size={48} animated /></div>
              </div>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 text-center text-[26px] font-semibold leading-tight tracking-[-0.035em] text-white md:text-[32px]">
              <span className="text-zinc-500">{greet}. </span><span className="mk-text-gradient">{t('hello')}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-2 text-center text-[15px] text-zinc-400">{t('helloSub')}</motion.p>
            <Onboarding onAsk={() => composerRef.current?.focus()} />
            <div className="mt-8 w-full space-y-7">
              <Watchlist onAsk={send} />
              <BriefingCard onAsk={send} />
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS[lang].filter((_, i) => [0, 1, 3, 6].includes(i)).map((s) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    className="group flex items-center gap-2 rounded-full border border-white/[0.07] bg-[#0b0b13]/70 px-3.5 py-2 text-[13px] text-zinc-400 backdrop-blur transition hover:border-teal-300/25 hover:text-white"
                  >
                    <s.icon className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-teal-300" />
                    {s.text}
                  </button>
                ))}
              </motion.div>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="mx-auto max-w-3xl space-y-8 px-5 pb-10 pt-8">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <UserMessage key={m.key} m={m} canEdit={!busy && m.id != null} onEdit={(s) => edit(i, s)} />
                ) : (
                  <AssistantMessage
                    key={m.key}
                    m={m}
                    isLast={i === lastIdx}
                    busy={busy}
                    onRegenerate={i === lastIdx && messages[i - 1]?.id != null ? () => regenerate(i) : undefined}
                    onFeedback={(v) => feedback(m, v)}
                    onSuggest={send}
                  />
                )
              )}
            </div>
          )
        )}
      </div>
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-b from-transparent to-[#05060B]" />
        <AnimatePresence>
          {!atBottom && !empty && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              onClick={scrollToBottom}
              aria-label={lang === 'vi' ? 'Cuộn xuống cuối' : 'Scroll to bottom'}
              className="absolute -top-12 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-[#11121b]/90 text-zinc-300 shadow-xl backdrop-blur transition hover:text-white"
            >
              <ArrowDown className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
        <Composer ref={composerRef} onSend={send} onStop={() => abortRef.current?.abort()} busy={busy} model={model} setModel={setModel} credits={credits} onTopUp={onNeedCredits} autoFocus={empty} />
      </div>
    </div>
  )
}
