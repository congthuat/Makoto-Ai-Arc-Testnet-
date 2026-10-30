import { useEffect, useId, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { useI18n } from '@/lib/i18n'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/lib/theme'

/** Geometry of the Makoto mark (64×64): an "M" drawn as twin peaks + a four-point AI spark. */
export const MK_PEAKS = 'M15 45 L24.5 22 L32 36 L39.5 22 L49 45'
export const MK_SPARK = 'M49 9.5C49.7 14 51 15.3 55.5 16C51 16.7 49.7 18 49 22.5C48.3 18 47 16.7 42.5 16C47 15.3 48.3 14 49 9.5Z'

/** Static SVG string (favicon / share images). */
export function logoSvg(size = 64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="b" x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse"><stop stop-color="#2DD4BF"/><stop offset=".52" stop-color="#3B82F6"/><stop offset="1" stop-color="#7C3AED"/></linearGradient><linearGradient id="h" x1="32" y1="0" x2="32" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#b)"/><rect width="64" height="64" rx="18" fill="url(#h)"/><g transform="translate(.5 2)"><path d="${MK_PEAKS}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="${MK_SPARK}" fill="#fff"/></g></svg>`
}

/**
 * Makoto app mark.
 * - variant "tile": gradient squircle with white glyph (default, app-icon style)
 * - variant "glyph": gradient glyph only, for dark surfaces where a tile is too heavy
 * - animated: the spark twinkles (empty states, loaders)
 */
export function LogoMark({ size = 28, variant = 'tile', animated = false }: { size?: number; variant?: 'tile' | 'glyph'; animated?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const bg = `mkb${uid}`, hl = `mkh${uid}`, gl = `mkg${uid}`
  const sparkStyle = animated ? { transformOrigin: '49px 16px', transformBox: 'view-box' as const, animation: 'mk-twinkle 2.6s ease-in-out infinite' } : undefined
  if (variant === 'glyph') {
    return (
      <svg width={size} height={size} viewBox="8 6 50 46" fill="none" aria-hidden>
        <defs>
          <linearGradient id={gl} x1="12" y1="8" x2="54" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5EEAD4" /><stop offset=".55" stopColor="#60A5FA" /><stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <path d={MK_PEAKS} stroke={`url(#${gl})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={MK_SPARK} fill={`url(#${gl})`} style={sparkStyle} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={bg} x1="6" y1="2" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" /><stop offset=".52" stopColor="#3B82F6" /><stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id={hl} x1="32" y1="0" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="18" fill={`url(#${hl})`} />
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="17.25" stroke="#fff" strokeOpacity=".16" strokeWidth="1.5" />
      <g transform="translate(.5 2)">
        <path d={MK_PEAKS} stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={MK_SPARK} fill="#fff" style={sparkStyle} />
      </g>
    </svg>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-semibold tracking-[-0.035em] text-white" style={{ fontSize: Math.round(size * 0.68) + 2 }}>makoto</span>
    </div>
  )
}

export function LangToggle() {
  const { lang, setLang } = useI18n()
  return (
    <div role="group" aria-label={lang === 'vi' ? 'Ngôn ngữ' : 'Language'} className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs font-semibold">
      {(['vi', 'en'] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} title={l === 'vi' ? 'Tiếng Việt' : 'English'} lang={l} onClick={() => setLang(l)} className={`min-h-8 min-w-9 rounded-full px-2.5 py-1 font-medium transition ${lang === l ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** Quick day/night switch (icon button). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setMode } = useTheme()
  const { lang } = useI18n()
  const light = theme === 'light'
  const label = light ? (lang === 'vi' ? 'Chuyển sang chế độ tối' : 'Switch to dark mode') : (lang === 'vi' ? 'Chuyển sang chế độ sáng' : 'Switch to light mode')
  return (
    <button
      onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setMode(light ? 'dark' : 'light', { x: b.left + b.width / 2, y: b.top + b.height / 2 }) }}
      aria-label={label}
      title={label}
      className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white ${className}`}
    >
      <Sun className={`absolute h-4 w-4 transition-all duration-300 ${light ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-300 ${light ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
    </button>
  )
}

/** Full Light / Dark / System picker (Settings). */
export function ThemePicker() {
  const { mode, setMode } = useTheme()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const opts: [ThemeMode, string, typeof Sun][] = [['light', vi ? 'Sáng' : 'Light', Sun], ['dark', vi ? 'Tối' : 'Dark', Moon], ['system', vi ? 'Theo máy' : 'System', Monitor]]
  return (
    <div role="radiogroup" aria-label={vi ? 'Giao diện' : 'Appearance'} className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm font-semibold">
      {opts.map(([k, l, Icon]) => (
        <button key={k} role="radio" aria-checked={mode === k} onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setMode(k, { x: b.left + b.width / 2, y: b.top + b.height / 2 }) }} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${mode === k ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
          <Icon className="h-3.5 w-3.5" />{l}
        </button>
      ))}
    </div>
  )
}

/** Number that animates when it changes. */
export function AnimatedNumber({ value, decimals = 0, className = '' }: { value: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ctrl = animate(prev.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) },
    })
    prev.current = value
    return () => ctrl.stop()
  }, [value, decimals])
  return <span ref={ref} className={className}>{value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
}

/** Card with a mouse-following spotlight border/glow. */
export function SpotlightCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: -999, y: -999 })
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onPointerLeave={() => setPos({ x: -999, y: -999 })}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(380px circle at ${pos.x}px ${pos.y}px, rgba(94,234,212,.10), transparent 45%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export const GLOBAL_CSS = `
:root { --font-sans: 'Geist Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; --font-mono: 'Geist Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace; --mk-teal: #2DD4BF; --mk-blue: #3B82F6; --mk-violet: #7C3AED; --mk-bg: #05060B; --mk-grad: linear-gradient(90deg, #5EEAD4 0%, #60A5FA 50%, #A78BFA 100%); }
html body { font-family: var(--font-sans); letter-spacing: -0.006em; text-rendering: optimizeLegibility; font-feature-settings: 'liga' 1, 'calt' 1; }
::selection { background: rgba(45,212,191,.28); color: #fff; }
:where(button, a, [role="button"], [tabindex], input[type="checkbox"]):focus-visible { outline: 2px solid #5EEAD4; outline-offset: 2px; border-radius: 10px; }
:where(input, textarea):focus-visible { outline: none; }
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
::view-transition-new(root) { z-index: 2; }
html.mk-vt, html.mk-vt * { transition: none !important; }
@layer base {
  :where(button, [role="button"], summary):not(:disabled):not([aria-disabled="true"]):not(.mk-no-press) { transition: scale .14s cubic-bezier(.2,.8,.2,1); }
  :where(button, [role="button"], summary):not(:disabled):not([aria-disabled="true"]):not(.mk-no-press):active { scale: .97; }
}
@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; } }
@keyframes mk-fade-in { from { opacity: 0; transform: translateY(4px); filter: blur(2px) } to { opacity: 1; transform: none; filter: none } }
.mk-stream > * { animation: mk-fade-in .45s cubic-bezier(.16,1,.3,1) both; }
@keyframes mk-skel { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
.mk-skel { background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.09) 37%, rgba(255,255,255,.04) 63%); background-size: 400% 100%; animation: mk-skel 1.6s ease infinite; border-radius: 8px; }
.mk-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 6px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); font-family: var(--font-mono); font-size: 11px; color: #a1a1aa; }
.mk-noise { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"); opacity: .035; mix-blend-mode: overlay; }
@keyframes mk-shimmer { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
@keyframes mk-blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
@keyframes mk-spin { to { transform: rotate(360deg) } }
@keyframes mk-twinkle { 0%,100% { transform: scale(1) rotate(0deg); opacity: 1 } 50% { transform: scale(.72) rotate(45deg); opacity: .75 } }
@keyframes mk-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes mk-pulse-ring { 0% { transform: scale(.8); opacity: .7 } 100% { transform: scale(2.2); opacity: 0 } }
@keyframes mk-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.mk-text-gradient { background: linear-gradient(90deg, #fff 0%, #9ED8FF 25%, #5EEAD4 45%, #A794FF 65%, #fff 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mk-shimmer 6s linear infinite; }
.mk-thinking { background: linear-gradient(90deg, #6b7280 0%, #e5e7eb 50%, #6b7280 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: mk-shimmer 2s linear infinite; }
.mk-cursor::after { content: ''; display: inline-block; width: 7px; height: 1.05em; margin-left: 2px; vertical-align: -0.15em; border-radius: 2px; background: #5EEAD4; animation: mk-blink 1s step-end infinite; }
.mk-cursor-last > :last-child:not(ul):not(ol):not(table):not(pre)::after, .mk-cursor-last > :is(ul,ol):last-child > li:last-child::after { content: ''; display: inline-block; width: 7px; height: 1.05em; margin-left: 3px; vertical-align: -0.15em; border-radius: 2px; background: #5EEAD4; animation: mk-blink 1s step-end infinite; }
.mk-border-spin { position: relative; isolation: isolate; }
.mk-border-spin::before { content: ''; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; background: conic-gradient(from var(--a, 0deg), transparent 0 70%, #5EEAD4 80%, #3B82F6 90%, transparent 100%); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: mk-rot 4s linear infinite; z-index: -1; }
@property --a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes mk-rot { to { --a: 360deg } }
.mk-scroll::-webkit-scrollbar { width: 6px; height: 6px } .mk-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 9px } .mk-scroll::-webkit-scrollbar-track { background: transparent }
.mk-md { font-size: 15px; line-height: 1.72; color: #d4d4d8; }
.mk-md > * + * { margin-top: .75em }
.mk-md h1, .mk-md h2, .mk-md h3 { color: #fff; font-weight: 600; letter-spacing: -0.02em; line-height: 1.3; margin-top: 1.2em }
.mk-md h1 { font-size: 1.35em } .mk-md h2 { font-size: 1.2em } .mk-md h3 { font-size: 1.05em }
.mk-md ul { list-style: disc; padding-left: 1.3em } .mk-md ol { list-style: decimal; padding-left: 1.4em }
.mk-md li + li { margin-top: .3em } .mk-md li::marker { color: #5EEAD4 }
.mk-md strong { color: #fff; font-weight: 600 }
.mk-md a { color: #7DD3FC; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(125,211,252,.35) }
.mk-md code { font-family: var(--font-mono); font-size: .86em; background: rgba(255,255,255,.07); padding: .15em .4em; border-radius: 6px }
.mk-md pre { margin: 0; background: transparent; padding: 14px 16px; overflow-x: auto; font-size: 13px; line-height: 1.65 }
.mk-md pre code { background: none; padding: 0; font-size: inherit }
.mk-code { border: 1px solid rgba(255,255,255,.07); border-radius: 14px; background: #08090f; overflow: hidden }
.hljs-comment, .hljs-quote { color: #6b7280; font-style: italic }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-doctag { color: #C4B5FD }
.hljs-string, .hljs-attr-value, .hljs-regexp, .hljs-addition { color: #5EEAD4 }
.hljs-number, .hljs-literal, .hljs-symbol, .hljs-bullet { color: #FDBA74 }
.hljs-title, .hljs-title.function_, .hljs-section { color: #93C5FD }
.hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-property { color: #7DD3FC }
.hljs-type, .hljs-class .hljs-title, .hljs-title.class_ { color: #F9A8D4 }
.hljs-meta, .hljs-deletion { color: #FDA4AF }
.hljs-punctuation, .hljs-operator { color: #a1a1aa }
.mk-md blockquote { border-left: 2px solid #5EEAD4; padding-left: 12px; color: #a1a1aa }
.mk-md table { width: 100%; border-collapse: collapse; font-size: 13.5px }
.mk-md thead { background: rgba(255,255,255,.025) }
.mk-md th { text-align: left; color: #a1a1aa; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.1); padding: 8px 12px }
.mk-md td { border-bottom: 1px solid rgba(255,255,255,.05); padding: 7px 12px }
.mk-md tr:last-child td { border-bottom: 0 }
.mk-md hr { border-color: rgba(255,255,255,.08) }
`
