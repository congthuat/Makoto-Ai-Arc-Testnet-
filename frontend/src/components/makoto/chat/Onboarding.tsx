import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, ShieldCheck, Wallet, MessageSquare, X, ArrowRight } from 'lucide-react'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'

const KEY = 'mk_onboard_hidden'

export function Onboarding({ onAsk }: { onAsk: () => void }) {
  const { me, linkWallet } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const [hidden, setHidden] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1')
  if (!me || hidden) return null
  const steps: { icon: typeof Check; done: boolean; title: string; body: string; onClick: () => void }[] = [
    { icon: ShieldCheck, done: (me.stats?.checks ?? 0) > 0, title: vi ? 'Xác minh một tín hiệu' : 'Verify a signal', body: vi ? 'Nhận điểm tin cậy cho tín hiệu hoặc tin đồn' : 'Get a credibility score for a signal or rumor', onClick: () => window.dispatchEvent(new CustomEvent('mk:view', { detail: 'verify' })) },
    { icon: MessageSquare, done: (me.stats?.messages ?? 0) > 0, title: vi ? 'Hỏi Makoto' : 'Ask Makoto', body: vi ? 'Giá, tin tức, xu hướng thị trường' : 'Prices, news, market trends', onClick: onAsk },
    { icon: Wallet, done: Boolean(me.user.wallet), title: vi ? 'Kết nối ví' : 'Connect a wallet', body: vi ? 'Để nạp credit bằng USDC khi cần' : 'To top up with USDC when needed', onClick: linkWallet },
  ]
  const n = steps.filter((s) => s.done).length
  if (n === steps.length) return null
  const hide = () => { localStorage.setItem(KEY, '1'); setHidden(true) }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0b12]/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">{vi ? 'Làm quen với Makoto' : 'Get to know Makoto'}</div>
          <div className="text-xs text-zinc-500">{vi ? `Đã xong ${n}/3` : `${n} of 3 done`}</div>
        </div>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div initial={{ width: 0 }} animate={{ width: `${(n / 3) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-gradient-to-r from-teal-300 via-blue-500 to-violet-500" />
        </div>
        <button onClick={hide} aria-label={vi ? 'Ẩn hướng dẫn' : 'Hide guide'} className="-mr-1 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-px p-2 sm:grid-cols-3">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${s.done ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-zinc-300'}`}>
                {s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${s.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'}`}>{i + 1}. {s.title}</span>
                <span className="block truncate text-xs text-zinc-500">{s.body}</span>
              </span>
              {!s.done && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />}
            </>
          )
          const cls = 'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.04]'
          return <button key={s.title} onClick={s.onClick} className={cls}>{inner}</button>
        })}
      </div>
    </motion.div>
  )
}
