import { useRef, useState } from 'react'
import { openConnections } from './Connections'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Droplets, ExternalLink, Loader2, Wallet, Zap, CircleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { ARC, sendUsdc, shortAddr } from '@/lib/wallet'
import { fmtNum } from '@/lib/format'
import { AnimatedNumber, SpotlightCard } from './Brand'
import { friendlyError } from '@/lib/errors'
import { pkgName } from './landing/shared'

type Pkg = { id: string; usdc: string; credits: number; bonus: number }
type Flow = { pkg: Pkg; stage: 'wallet' | 'verifying' | 'done' | 'error'; hash?: string; error?: string } | null

async function celebrate() {
  const confetti = (await import('canvas-confetti')).default
  const colors = ['#5EEAD4', '#3B82F6', '#A78BFA', '#ffffff']
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors })
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 }, colors }), 200)
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 }, colors }), 350)
}

export function CreditsView() {
  const { me, authFetch, refreshMe, setCredits, linkWallet } = useSession()
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const vi = lang === 'vi'
  const [flow, setFlow] = useState<Flow>(null)
  // Bumped when a new payment check starts so an older one stops polling.
  const run = useRef(0)
  // Closing the modal mid-check keeps checking in the background (the payment is only credited through this check).
  const hidden = useRef(false)
  const { data, isLoading, isError, refetch } = useQuery<{ packages: Pkg[]; treasury: string }>({
    queryKey: ['packages'],
    queryFn: async () => {
      const r = await fetch(api('payments/packages'))
      if (!r.ok) throw new Error('Failed to load packages')
      return r.json()
    },
  })
  const verifyFailed = vi ? 'Chưa kiểm tra được giao dịch. Hãy thử lại sau ít phút.' : 'Couldn’t check the transaction. Please try again in a moment.'
  const closeFlow = () => {
    if (flow?.stage === 'verifying') {
      hidden.current = true
      toast.message(vi ? 'Makoto vẫn tiếp tục kiểm tra giao dịch và sẽ báo khi credit được cộng.' : 'Makoto keeps checking the payment and will let you know when credits are added.')
    } else run.current++
    setFlow(null)
  }
  const confirmed = (pkg: Pkg, hash: string, credits: number) => {
    setCredits(credits)
    refreshMe()
    qc.invalidateQueries({ queryKey: ['history'] })
    if (hidden.current) { toast.success(t('paid')); return }
    setFlow({ pkg, stage: 'done', hash })
    celebrate()
  }
  // Errors always (re)open the modal: its "Try again" button is the only way to re-check this payment.
  const failed = (pkg: Pkg, hash: string, error: string) => {
    hidden.current = false
    setFlow({ pkg, stage: 'error', hash, error })
  }

  const buy = async (pkg: Pkg) => {
    if (!me || !data) return
    if (!me.user.wallet) {
      toast.message(vi ? 'Kết nối ví trước để nạp credit bằng USDC.' : 'Connect a wallet first to top up with USDC.')
      linkWallet()
      return
    }
    const bal = Number(me.arcBalance ?? 0)
    if (me.arcBalance != null && bal < Number(pkg.usdc) + 0.05) {
      toast.error(vi ? `Ví chỉ có ${fmtNum(bal, 2)} USDC trên Arc. Hãy nhận thêm từ faucet.` : `Your wallet has only ${fmtNum(bal, 2)} USDC on Arc. Get more from the faucet.`)
      return
    }
    setFlow({ pkg, stage: 'wallet' })
    let hash: string
    try {
      hash = await sendUsdc(me.user.wallet, data.treasury, pkg.usdc)
    } catch (e) {
      const err = e as { code?: number; message?: string }
      if (err.code === 4001) { setFlow(null); return }
      if (err.message === 'NO_WALLET') { setFlow(null); toast.message(t('reconnect')); linkWallet(); return }
      setFlow({ pkg, stage: 'error', error: err.message || (vi ? 'Giao dịch không thành công.' : 'Transaction failed.') })
      return
    }
    const id = ++run.current
    hidden.current = false
    setFlow({ pkg, stage: 'verifying', hash })
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 1200 : 2500))
      if (run.current !== id) return
      try {
        const r = await authFetch('payments/verify', { method: 'POST', body: JSON.stringify({ txHash: hash, packageId: pkg.id }) })
        const d = await r.json()
        if (run.current !== id) return
        if (!r.ok) { failed(pkg, hash, friendlyError(d.error || d.code, lang)); return }
        if (d.status === 'confirmed') { confirmed(pkg, hash, d.credits); return }
      } catch { /* keep polling */ }
    }
    if (run.current !== id) return
    failed(pkg, hash, vi ? 'Chưa xác minh được giao dịch. Hãy thử lại sau ít phút; credit sẽ được cộng khi giao dịch được xác nhận.' : 'Could not verify yet. Try again in a moment.')
  }

  const retryVerify = async () => {
    if (!flow?.hash) return
    const { pkg, hash } = flow
    const id = ++run.current
    hidden.current = false
    setFlow({ pkg, stage: 'verifying', hash })
    try {
      const r = await authFetch('payments/verify', { method: 'POST', body: JSON.stringify({ txHash: hash, packageId: pkg.id }) })
      const d = await r.json()
      if (run.current !== id) return
      if (d.status === 'confirmed') confirmed(pkg, hash, d.credits)
      else failed(pkg, hash, d.error || d.code ? friendlyError(d.error || d.code, lang) : (vi ? 'Giao dịch vẫn đang chờ xác nhận.' : 'Still pending.'))
    } catch {
      if (run.current === id) failed(pkg, hash, verifyFailed)
    }
  }

  return (
    <div className="mk-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">{t('topUp')}</h1>
        <p className="mt-1 text-zinc-400">{t('payWith')}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0f1a2e] via-[#0b0b16] to-[#160f2a] p-6">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" />
            <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t('balance')}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <AnimatedNumber value={me?.user.credits ?? 0} className="text-5xl font-semibold text-white" />
                <span className="text-zinc-400">{t('credits')}</span>
              </div>
              <div className="mt-1 text-sm text-zinc-400">≈ {fmtNum(Math.floor((me?.user.credits ?? 0) / 3), 0)} {vi ? 'câu hỏi còn lại (trung bình ~3 credit/câu)' : 'questions left (avg ~3 credits each)'}</div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-zinc-500">{t('deposited')}</div><div className="font-mono text-white">{fmtNum(me?.user.total_deposited_credits ?? 0, 0)}</div></div>
                <div><div className="text-zinc-500">{t('spent')}</div><div className="font-mono text-white">{fmtNum(me?.user.total_spent_credits ?? 0, 0)}</div></div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Wallet className="h-3.5 w-3.5" />{t('arcBalance')}</div>
            <div className="mt-2 text-3xl font-semibold text-white">{me?.arcBalance != null ? fmtNum(me.arcBalance, 2) : '—'} <span className="text-base text-zinc-400">USDC</span></div>
            {me?.user.wallet ? (
              <div className="mt-1 font-mono text-xs text-zinc-500">{shortAddr(me.user.wallet)} · {ARC.name}</div>
            ) : (
              <button onClick={openConnections} className="-mx-1 mt-0.5 inline-flex min-h-9 items-center px-1 text-xs text-teal-300 hover:underline md:min-h-0">{vi ? 'Chưa kết nối ví · Kết nối ngay →' : 'No wallet connected · Connect →'}</button>
            )}
            <a href={ARC.faucet} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-300/[0.06] px-4 py-2 text-sm font-semibold text-teal-100 transition hover:bg-teal-300/[0.12]">
              <Droplets className="h-4 w-4" />{t('getTestUsdc')}<ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {isError && !data ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
            <CircleAlert className="h-6 w-6 text-rose-300" />
            <p className="text-sm text-zinc-400">{vi ? 'Không tải được các gói credit.' : 'Couldn’t load credit packages.'}</p>
            <button onClick={() => refetch()} className="min-h-9 rounded-full bg-white/[0.07] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.12]">{t('retry')}</button>
          </div>
        ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[214px] rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="mk-skel h-3 w-16" /><div className="mk-skel mt-4 h-8 w-24" /><div className="mk-skel mt-2 h-4 w-32" /><div className="mk-skel mt-8 h-10 w-full" />
            </div>
          ))}
          {(data?.packages || []).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <SpotlightCard className={`h-full p-5 ${p.id === 'pro' ? 'border-teal-300/30' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{pkgName(p.id, lang)}</span>
                  {p.id === 'pro' && <span className="rounded-full bg-teal-300 px-2 py-0.5 text-[10px] font-semibold text-black">{t('bestValue')}</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-1"><span className="text-3xl font-semibold text-white">{fmtNum(p.credits, 0)}</span><span className="text-sm text-zinc-400">{t('credits')}</span></div>
                <div className="mt-0.5 text-sm text-zinc-400">{p.usdc} USDC{p.bonus > 0 && <span className="ml-2 font-semibold text-emerald-400">+{p.bonus}% {vi ? 'thưởng' : 'bonus'}</span>}</div>
                <div className="mt-1 text-xs text-zinc-500">≈ {fmtNum(Math.floor(p.credits / 3), 0)} {vi ? 'câu hỏi' : 'questions'}</div>
                <button onClick={() => buy(p)} disabled={Boolean(flow && flow.stage !== 'done' && flow.stage !== 'error')} className={`mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-50 ${p.id === 'pro' ? 'bg-white text-black hover:shadow-[0_0_30px_rgba(94,234,212,.4)]' : 'bg-white/[0.07] text-white hover:bg-white/[0.12]'}`}>
                  {t('buy')} · {p.usdc} USDC
                </button>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
        )}
        <p className="mt-6 text-sm text-zinc-500">
          {vi ? 'USDC được chuyển thẳng tới ví kho bạc Makoto ' : 'USDC goes directly to the Makoto treasury wallet '}
          {data?.treasury
            ? <a href={`${ARC.explorer}/address/${data.treasury}`} target="_blank" rel="noreferrer" className="-my-2 inline-block py-2 font-mono text-zinc-300 underline decoration-white/20 underline-offset-2">{shortAddr(data.treasury)}</a>
            : <span className="font-mono text-zinc-500">—</span>}
          {vi ? '. Credit được cộng ngay khi giao dịch được xác nhận trên Arc.' : '. Credits are added as soon as Arc confirms the transaction.'}
        </p>
      </div>

      <AnimatePresence>
        {flow && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0c0c15] p-7 text-center">
              <button onClick={closeFlow} aria-label={vi ? 'Đóng' : 'Close'} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                {flow.stage === 'done' ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15"><Check className="h-8 w-8 text-emerald-300" /></motion.div>
                ) : flow.stage === 'error' ? (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-400/15"><CircleAlert className="h-8 w-8 text-rose-300" /></div>
                ) : (
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-teal-300" style={{ animation: 'mk-spin 1s linear infinite' }} />
                    <div className="absolute inset-0 flex items-center justify-center">{flow.stage === 'wallet' ? <Wallet className="h-6 w-6 text-white" /> : <Loader2 className="h-6 w-6 animate-spin text-teal-200" />}</div>
                  </div>
                )}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                {flow.stage === 'wallet' ? t('confirmWallet') : flow.stage === 'verifying' ? t('verifying') : flow.stage === 'done' ? t('paid') : vi ? 'Có lỗi xảy ra' : 'Something went wrong'}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                {flow.stage === 'done' ? <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-teal-300" />+{fmtNum(flow.pkg.credits, 0)} {t('credits')}</span> : flow.stage === 'error' ? flow.error : `${flow.pkg.usdc} USDC → ${fmtNum(flow.pkg.credits, 0)} ${t('credits')}`}
              </p>
              {flow.hash && (
                <a href={`${ARC.explorer}/tx/${flow.hash}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-sky-300 hover:underline">{shortAddr(flow.hash)}<ExternalLink className="h-3 w-3" /></a>
              )}
              {flow.stage === 'error' && flow.hash && <button onClick={retryVerify} className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black">{t('retry')}</button>}
              {flow.stage === 'done' && <button onClick={closeFlow} className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black">OK</button>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
