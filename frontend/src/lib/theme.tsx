import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemeMode = 'dark' | 'light' | 'system'
export type Theme = 'dark' | 'light'

const KEY = 'mk_theme'

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch { /* storage unavailable */ }
  return 'dark'
}

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

const resolve = (m: ThemeMode): Theme => (m === 'system' ? systemTheme() : m)

function apply(theme: Theme) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.classList.toggle('mk-light', theme === 'light')
  el.classList.toggle('dark', theme === 'dark')
  el.style.colorScheme = theme
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta) }
  meta.content = theme === 'light' ? '#F6F7FB' : '#05060B'
}

// Apply as early as possible (module load) to avoid a flash of the wrong theme.
if (typeof window !== 'undefined') apply(resolve(readMode()))

export type Origin = { x: number; y: number }
type Ctx = { mode: ThemeMode; theme: Theme; setMode: (m: ThemeMode, origin?: Origin) => void }
const ThemeCtx = createContext<Ctx>({ mode: 'dark', theme: 'dark', setMode: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark')
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const m = readMode()
    setModeState(m)
    setTheme(resolve(m))
  }, [])

  useEffect(() => {
    apply(theme)
  }, [theme])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const on = () => setTheme(mq.matches ? 'light' : 'dark')
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [mode])

  const setMode = useCallback((m: ThemeMode, origin?: Origin) => {
    try { localStorage.setItem(KEY, m) } catch { /* ignore */ }
    const next = resolve(m)
    const commit = () => { setModeState(m); setTheme(next); apply(next) }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const changes = document.documentElement.classList.contains('mk-light') !== (next === 'light')
    if (!doc.startViewTransition || reduce || !changes) { commit(); return }
    // Circular "ink" reveal from the click point (Apple / Vercel / Linear style).
    const x = origin?.x ?? window.innerWidth - 40
    const y = origin?.y ?? 32
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    const root = document.documentElement
    root.classList.add('mk-vt')
    const vt = doc.startViewTransition(() => { flushSync(commit) })
    vt.finished.finally(() => root.classList.remove('mk-vt'))
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' } as KeyframeAnimationOptions,
      )
    }).catch(() => { /* transition skipped */ })
  }, [])

  return <ThemeCtx.Provider value={{ mode, theme, setMode }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

/** Chart colors for the active theme (ECharts can't read CSS variables). */
export function chartPalette(theme: Theme) {
  return theme === 'light'
    ? { tipBg: 'rgba(255,255,255,.98)', tipBorder: 'rgba(0,0,0,.1)', text: '#27272a', muted: '#6b6b75', strong: '#0b0c12', axis: '#6b6b75', axisLine: 'rgba(0,0,0,.12)', grid: 'rgba(0,0,0,.06)', pointer: 'rgba(0,0,0,.04)', crosshair: 'rgba(0,0,0,.3)', track: 'rgba(0,0,0,.07)', bar: '#14B8A6', barHover: '#0D9488', up: '#059669', down: '#E11D48', upFill: 'rgba(5,150,105,.16)', downFill: 'rgba(225,29,72,.14)', line: '#2563EB', fg: ['#E11D48', '#EA580C', '#71717A', '#16A34A', '#059669'] }
    : { tipBg: 'rgba(16,16,24,.96)', tipBorder: 'rgba(255,255,255,.08)', text: '#e4e4e7', muted: '#a1a1aa', strong: '#fff', axis: '#71717a', axisLine: 'rgba(255,255,255,.12)', grid: 'rgba(255,255,255,.05)', pointer: 'rgba(255,255,255,.04)', crosshair: 'rgba(255,255,255,.25)', track: 'rgba(255,255,255,.07)', bar: '#5EEAD4', barHover: '#99F6E4', up: '#34D399', down: '#FB7185', upFill: 'rgba(52,211,153,.22)', downFill: 'rgba(251,113,133,.22)', line: '#93C5FD', fg: ['#FB7185', '#FDBA74', '#E4E4E7', '#86EFAC', '#34D399'] }
}

const PALETTES = { dark: chartPalette('dark'), light: chartPalette('light') }
export const usePalette = () => PALETTES[useTheme().theme]
