import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Logo, LangToggle, ThemeToggle } from '../Brand'
import { ConnectCta, EASE } from './shared'

export const SECTIONS = ['verify', 'features', 'pricing', 'faq'] as const
type SectionId = (typeof SECTIONS)[number]

function useActiveSection() {
  const [active, setActive] = useState<SectionId | null>(null)
  useEffect(() => {
    const visible = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)
        setActive(SECTIONS.find((id) => visible.has(id)) ?? null)
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return active
}

export function Nav() {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 32, restDelta: 0.001 })
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24))
  const active = useActiveSection()
  const [menu, setMenu] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const links: { id: SectionId; label: string }[] = [
    { id: 'verify', label: vi ? 'Xác minh' : 'Verify' },
    { id: 'features', label: vi ? 'Tính năng' : 'Features' },
    { id: 'pricing', label: vi ? 'Bảng giá' : 'Pricing' },
    { id: 'faq', label: vi ? 'Hỏi đáp' : 'FAQ' },
  ]

  // Mobile menu: closes on Esc, outside tap, or when the screen grows to desktop.
  useEffect(() => {
    if (!menu) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); menuBtn.current?.focus() } }
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !menuBtn.current?.contains(t)) setMenu(false) }
    const mq = window.matchMedia('(min-width: 1024px)')
    const wide = () => mq.matches && setMenu(false)
    window.addEventListener('keydown', key)
    window.addEventListener('pointerdown', down)
    mq.addEventListener('change', wide)
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true }))
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', down); mq.removeEventListener('change', wide) }
  }, [menu])

  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-full bg-white px-4 py-2 text-sm font-medium text-black focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {vi ? 'Bỏ qua, tới nội dung chính' : 'Skip to content'}
      </a>
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-[#2DD4BF] via-[#3B82F6] to-[#7C3AED]"
      />
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-center px-2 pt-3 sm:px-3 md:pt-4">
        <nav
          aria-label={vi ? 'Điều hướng chính' : 'Main'}
          className={`pointer-events-auto flex w-full items-center justify-between gap-2 rounded-full border backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
            scrolled || menu
              ? 'h-12 max-w-4xl border-white/[0.1] bg-[#05060B]/80 pl-4 pr-1.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,.6)]'
              : 'h-14 max-w-5xl border-white/[0.07] bg-[#05060B]/40 pl-4 pr-2 sm:pl-5'
          }`}
        >
          <a href="#top" aria-label={vi ? 'Makoto, về đầu trang' : 'Makoto, back to top'} className="shrink-0 rounded-full" onClick={() => setMenu(false)}>
            <Logo size={scrolled ? 24 : 26} />
          </a>
          <ul className="hidden items-center gap-0.5 whitespace-nowrap text-sm lg:flex">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  aria-current={active === l.id ? 'true' : undefined}
                  className={`relative block rounded-full px-3.5 py-1.5 transition-colors ${active === l.id ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  {active === l.id && (
                    <motion.span
                      layoutId="mk-nav-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full border border-white/[0.08] bg-white/[0.07]"
                    />
                  )}
                  <span className="relative">{l.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <ThemeToggle />
              <LangToggle />
            </div>
            <ConnectCta label={vi ? 'Đăng nhập' : 'Sign in'} />
            <button
              ref={menuBtn}
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-expanded={menu}
              aria-controls="mk-mobile-menu"
              aria-label={menu ? (vi ? 'Đóng menu' : 'Close menu') : (vi ? 'Mở menu' : 'Open menu')}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white lg:hidden"
            >
              {menu ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {menu && (
            <motion.div
              ref={panel}
              id="mk-mobile-menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="pointer-events-auto mt-2 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/[0.1] bg-[#05060B]/90 p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,.7)] backdrop-blur-xl lg:hidden"
            >
              <ul>
                {links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={`#${l.id}`}
                      onClick={() => setMenu(false)}
                      aria-current={active === l.id ? 'true' : undefined}
                      className={`flex min-h-12 items-center rounded-2xl px-4 text-[15px] font-medium transition ${active === l.id ? 'bg-white/[0.07] text-white' : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/[0.07] px-3 pb-1 pt-3 sm:hidden">
                <span className="text-xs text-zinc-500">{vi ? 'Giao diện & ngôn ngữ' : 'Theme & language'}</span>
                <div className="flex items-center gap-2"><ThemeToggle /><LangToggle /></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
