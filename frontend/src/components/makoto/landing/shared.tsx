import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { GoogleG } from '../LoginModal'
import { useSession } from '@/lib/session'

export const EASE = [0.16, 1, 0.3, 1] as const

export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: EASE },
}

/** fadeUp with a stagger delay. */
export const fadeUpDelay = (delay: number) => ({ ...fadeUp, transition: { ...fadeUp.transition, delay } })

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function useVi() {
  return useI18n().lang === 'vi'
}

/* ---------- Live data ---------- */

export type ArcStatus = {
  latest_block?: number | string | null
  total_transactions?: number | string | null
  transactions_today?: number | string | null
  gas_price_gwei?: number | string | null
}

export const toNum = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Live Arc Testnet stats. Shared react-query key so every consumer reuses one poll. */
export function useArcStatus() {
  return useQuery<ArcStatus>({
    queryKey: ['arc-status'],
    queryFn: () => fetch(api('arc')).then((r) => r.json()),
    refetchInterval: 10_000,
  })
}

export type Pkg = { id: string; usdc: string; credits: number; bonus: number }

/** Display names by size, so the "pro" package isn't confused with the Makoto Pro model. */
const PKG_NAMES: Record<string, { vi: string; en: string }> = {
  starter: { vi: 'Gói nhỏ', en: 'Small pack' },
  plus: { vi: 'Gói vừa', en: 'Medium pack' },
  pro: { vi: 'Gói lớn', en: 'Large pack' },
  max: { vi: 'Gói rất lớn', en: 'XL pack' },
}
export const pkgName = (id: string, lang: 'vi' | 'en') => PKG_NAMES[id]?.[lang] ?? id

export function usePackages() {
  return useQuery<{ packages: Pkg[] }>({
    queryKey: ['packages'],
    queryFn: () => fetch(api('payments/packages')).then((r) => r.json()),
  })
}

/* ---------- Typography ---------- */

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-teal-300 ${className}`}>
      <span className="h-px w-5 bg-gradient-to-r from-transparent to-teal-300/80" aria-hidden />
      {children}
    </div>
  )
}

export function SectionHeader({ eyebrow, title, sub, center = false }: { eyebrow: ReactNode; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <motion.div {...fadeUp} className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-white md:text-[44px]">{title}</h2>
      {sub && <p className={`mt-4 text-pretty text-base leading-relaxed text-zinc-400 md:text-lg ${center ? 'mx-auto max-w-xl' : 'max-w-xl'}`}>{sub}</p>}
    </motion.div>
  )
}

/** Small corner tag marking a visual as illustrative / demo. */
export function DemoTag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{children}</span>
}

export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-1.5 w-1.5 ${className}`} aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" style={{ animation: 'mk-pulse-ring 1.6s ease-out infinite' }} />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  )
}

/* ---------- CTA ---------- */

export function ConnectCta({ big = false, label, className = '' }: { big?: boolean; label?: string; className?: string }) {
  const { login, loggingIn } = useSession()
  const { t } = useI18n()
  const busy = loggingIn !== 'idle'
  const text = loggingIn === 'connecting' ? t('connecting') : loggingIn === 'signing' ? t('signing') : label || t('signIn')

  const button = (
    <button
      type="button"
      onClick={() => login()}
      disabled={busy}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white font-medium text-black transition-[box-shadow,transform] duration-300 hover:shadow-[0_0_40px_rgba(94,234,212,.4)] active:scale-[0.98] disabled:opacity-80 ${
        big ? 'h-12 px-6 text-[15px]' : 'h-9 px-4 text-sm'
      } ${big ? '' : className}`}
    >
      {/* periodic + hover shine */}
      <span aria-hidden className="mk-l-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-teal-200/70 to-transparent" />
      {busy ? <Loader2 className="relative h-4 w-4 animate-spin" /> : <GoogleG className="relative h-4 w-4" />}
      <span className="relative whitespace-nowrap">{text}</span>
      {big && !busy && <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
    </button>
  )
  if (!big) return button
  return (
    <Magnetic className={`mk-border-spin relative inline-flex rounded-full ${className}`}>
      <span aria-hidden className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-gradient-to-r from-teal-300/25 via-blue-500/20 to-violet-500/25 blur-xl" />
      {button}
    </Magnetic>
  )
}

/** Gently pulls toward the cursor (Stripe / Apple style magnetic button). Mouse only. */
export function Magnetic({ children, className = '', strength = 0.22, max = 8 }: { children: ReactNode; className?: string; strength?: number; max?: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 220, damping: 16, mass: 0.4 })
  const y = useSpring(my, { stiffness: 220, damping: 16, mass: 0.4 })
  const clamp = (v: number) => Math.max(-max, Math.min(max, v))
  const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set(clamp((e.clientX - (r.left + r.width / 2)) * strength))
    my.set(clamp((e.clientY - (r.top + r.height / 2)) * strength))
  }
  const reset = () => { mx.set(0); my.set(0) }
  return (
    <motion.span ref={ref} onPointerMove={onMove} onPointerLeave={reset} style={{ x, y }} className={className}>
      {children}
    </motion.span>
  )
}

/** Landing-only CSS (keyframes not in the global sheet). Reduced motion is handled globally. */
export const LANDING_CSS = `
html { scroll-behavior: smooth; }
@keyframes mk-l-shine-kf { 0%, 62% { transform: translateX(0) } 100% { transform: translateX(400%) } }
.mk-l-shine { animation: mk-l-shine-kf 4.5s cubic-bezier(.4,0,.2,1) infinite; animation-delay: 1.6s; }
@keyframes mk-l-sweep { from { transform: translateX(-100%) } to { transform: translateX(100%) } }
`
