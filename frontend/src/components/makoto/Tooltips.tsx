import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/**
 * Global tooltip layer: replaces the browser's slow, unstyled native `title`
 * tooltips with fast, animated ones (Linear / Vercel style). Any element with
 * `title` or `data-tip` gets one automatically — no per-component wiring.
 */
type Tip = { text: string; x: number; y: number; below: boolean; key: number }

const SELECTOR = '[title]:not(iframe):not(html), [data-tip]'

function adopt(el: HTMLElement): string {
  const t = el.getAttribute('title')
  if (t) {
    el.setAttribute('data-tip', t)
    el.removeAttribute('title')
    if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', t)
  }
  return el.getAttribute('data-tip') || ''
}

export function Tooltips() {
  const [tip, setTip] = useState<Tip | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<HTMLElement | null>(null)
  const lastHide = useRef(0)
  const seq = useRef(0)

  useEffect(() => {
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

    const hide = () => {
      window.clearTimeout(timer.current)
      if (current.current) lastHide.current = Date.now()
      current.current = null
      setTip(null)
    }

    const show = (el: HTMLElement, instant: boolean) => {
      const text = adopt(el)
      if (!text) return
      window.clearTimeout(timer.current)
      current.current = el
      const open = () => {
        if (current.current !== el || !el.isConnected) return
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        const below = r.top < 44
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below, key: ++seq.current })
      }
      const warm = Date.now() - lastHide.current < 500
      if (instant || warm) open()
      else timer.current = window.setTimeout(open, 380)
    }

    const target = (e: Event) => (e.target instanceof Element ? (e.target.closest(SELECTOR) as HTMLElement | null) : null)

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = target(e)
      if (!el) return
      if (el === current.current) return
      show(el, false)
    }
    const onOut = (e: PointerEvent) => {
      const el = current.current
      if (!el) return
      const to = e.relatedTarget as Node | null
      if (to && el.contains(to)) return
      hide()
    }
    const onFocus = (e: FocusEvent) => {
      const el = target(e)
      if (!el || !(e.target as Element).matches?.(':focus-visible')) return
      show(el, true)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') hide() }

    // Even on touch devices, strip native titles on interaction so the OS
    // doesn't show its own long-press bubble; only show ours with a mouse.
    const onDown = (e: PointerEvent) => { const el = target(e); if (el) adopt(el); hide() }

    if (finePointer) {
      document.addEventListener('pointerover', onOver, true)
      document.addEventListener('pointerout', onOut, true)
    }
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('focusout', hide, true)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      window.clearTimeout(timer.current)
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('pointerout', onOut, true)
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('focusout', hide, true)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Keep the bubble inside the viewport horizontally.
  const bubble = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  useEffect(() => {
    if (!tip || !bubble.current) { setShift(0); return }
    const w = bubble.current.offsetWidth
    const left = tip.x - w / 2
    const right = tip.x + w / 2
    const vw = window.innerWidth
    setShift(left < 8 ? 8 - left : right > vw - 8 ? vw - 8 - right : 0)
  }, [tip])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      <AnimatePresence>
        {tip && (
          <motion.div
            key={tip.key}
            ref={bubble}
            initial={{ opacity: 0, scale: 0.94, y: tip.below ? -3 : 3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              left: tip.x + shift,
              top: tip.y,
              translateX: '-50%',
              translateY: tip.below ? '0%' : '-100%',
              transformOrigin: tip.below ? 'top center' : 'bottom center',
              background: '#16171F',
              color: '#F4F4F5',
              border: '1px solid rgba(255,255,255,.08)',
              boxShadow: '0 8px 24px -6px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.2)',
            }}
            className="max-w-[260px] whitespace-pre-line rounded-lg px-2.5 py-1.5 text-center text-[12px] font-medium leading-snug"
          >
            {tip.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
