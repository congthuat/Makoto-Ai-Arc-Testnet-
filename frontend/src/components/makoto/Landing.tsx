import { useEffect } from 'react'
import { LangToggle } from './Brand'
import { LANDING_CSS } from './landing/shared'
import { Nav } from './landing/Nav'
import { Hero } from './landing/Hero'
import { BuiltWith } from './landing/BuiltWith'
import { Bento } from './landing/Bento'
import { VerifyShowcase } from './landing/VerifyShowcase'
import { Daily } from './landing/Daily'
import { Showcase } from './landing/Showcase'
import { Pricing } from './landing/Pricing'
import { Faq } from './landing/Faq'
import { FinalCta } from './landing/FinalCta'
import { Footer } from './landing/Footer'
export { LangToggle }

const ANCHORS = new Set(['top', 'verify', 'features', 'daily', 'demo', 'how', 'pricing', 'faq'])

/** Opening makotoai.xyz/#how (a shared link) lands on that section once the page has rendered. */
function useHashLanding() {
  useEffect(() => {
    const raw = decodeURIComponent(location.hash.slice(1))
    // Old shared links to the removed "How it works" section land on Features.
    const id = raw === 'how' ? 'features' : raw
    if (!ANCHORS.has(id) || id === 'top') return
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' })
    const timers = [60, 450, 1200].map((ms) => setTimeout(go, ms))
    // Stop re-aligning as soon as the visitor scrolls on their own.
    const stop = () => timers.forEach(clearTimeout)
    window.addEventListener('wheel', stop, { once: true, passive: true })
    window.addEventListener('touchstart', stop, { once: true, passive: true })
    window.addEventListener('keydown', stop, { once: true })
    return () => { stop(); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop) }
  }, [])
}

export function Landing() {
  useHashLanding()
  return (
    <div className="min-h-screen overflow-x-clip bg-[#030308] text-white antialiased">
      <style>{LANDING_CSS}</style>
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <BuiltWith />
        <VerifyShowcase />
        <Bento />
        <Daily />
        <Showcase />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
