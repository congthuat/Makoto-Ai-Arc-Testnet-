import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Menu, Zap, Wallet, PanelLeftOpen, SquarePen } from 'lucide-react'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { fmtNum } from '@/lib/format'
import { Sidebar, type View } from './Sidebar'
import { ChatView } from './Chat'
import { CreditsView } from './Credits'
import { HistoryView, SettingsView } from './Account'
import { AnimatedNumber, LangToggle, ThemeToggle } from './Brand'
import { CommandPalette, ShortcutsDialog, MOD } from './CommandPalette'
import { WalletView } from './WalletView'
import { VerifyView } from './verify/VerifyView'
import { ProjectsView } from './project/ProjectsView'
import { ChatBackdrop } from './Aurora'

const isTyping = (el: EventTarget | null) => {
  const n = el as HTMLElement | null
  return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable)
}

export function AppShell() {
  const { me } = useSession()
  const { t, lang } = useI18n()
  const [view, setView] = useState<View>('chat')
  const [convId, setConvId] = useState<number | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem('mk_sidebar_collapsed') === '1')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia('(max-width: 767px)').matches) { setMobileOpen((o) => !o); return }
    setCollapsed((c) => { localStorage.setItem('mk_sidebar_collapsed', c ? '0' : '1'); return !c })
  }, [])

  const go = (v: View) => { setView(v); setMobileOpen(false) }
  const select = (id: number) => { setConvId(id); setView('chat'); setMobileOpen(false) }
  const newChat = useCallback(() => { setConvId(null); setView('chat'); setMobileOpen(false) }, [])

  const ask = useCallback((text: string) => { setConvId(null); setView('chat'); setMobileOpen(false); setPendingPrompt(text) }, [])

  // "Remembered…" notes in chat open Settings → memory panel.
  useEffect(() => {
    const open = (e: Event) => {
      const section = (e as CustomEvent<string>).detail || 'memory'
      setView('settings')
      setMobileOpen(false)
      const t0 = Date.now()
      const tick = () => {
        const el = document.getElementById(section)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else if (Date.now() - t0 < 1500) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    const goView = (e: Event) => { const v = (e as CustomEvent<View>).detail; if (v) { setView(v); setMobileOpen(false) } }
    window.addEventListener('mk:open-memory', open)
    window.addEventListener('mk:open-settings', open)
    window.addEventListener('mk:view', goView)
    return () => { window.removeEventListener('mk:open-memory', open); window.removeEventListener('mk:open-settings', open); window.removeEventListener('mk:view', goView) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); return }
      if (mod && e.shiftKey && k === 'o') { e.preventDefault(); newChat(); return }
      if (mod && !e.shiftKey && k === 'b') { e.preventDefault(); toggleSidebar(); return }
      if (e.key === '?' && !mod && !isTyping(e.target)) { e.preventDefault(); setShortcutsOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newChat, toggleSidebar])

  const sidebarProps = {
    activeId: convId, view, onSelect: select, onNew: newChat, onView: go,
    onSearch: () => { setMobileOpen(false); setPaletteOpen(true) },
    onShortcuts: () => setShortcutsOpen(true),
  }
  const titles: Record<View, string> = { chat: '', credits: t('topUp'), history: t('history'), settings: t('settings'), wallet: lang === 'vi' ? 'Ví trên Arc' : 'Arc wallets', verify: lang === 'vi' ? 'Xác minh' : 'Verify', projects: lang === 'vi' ? 'Dự án' : 'Projects' }
  const iconBtn = 'rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white'

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#05060B] text-zinc-100">
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 0 : 272 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="hidden shrink-0 overflow-hidden md:block"
        aria-hidden={collapsed}
      >
        <Sidebar {...sidebarProps} onCollapse={toggleSidebar} />
      </motion.div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />
            <motion.div initial={{ x: -290 }} animate={{ x: 0 }} exit={{ x: -290 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="fixed inset-y-0 left-0 z-50 pb-[env(safe-area-inset-bottom)] md:hidden">
              <Sidebar {...sidebarProps} onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/[0.05] px-3 pt-[env(safe-area-inset-top)] sm:px-4">
          <div className="flex min-w-0 items-center gap-1">
            <button onClick={() => setMobileOpen(true)} className={`${iconBtn} md:hidden`} aria-label={lang === 'vi' ? 'Mở menu' : 'Open menu'}><Menu className="h-5 w-5" /></button>
            {collapsed && (
              <div className="hidden items-center gap-1 md:flex">
                <button onClick={toggleSidebar} className={iconBtn} aria-label={lang === 'vi' ? 'Mở thanh bên' : 'Open sidebar'} title={`${MOD} B`}><PanelLeftOpen className="h-[18px] w-[18px]" /></button>
                <button onClick={newChat} className={iconBtn} aria-label={t('newChat')} title={`${t('newChat')} (${MOD} ⇧ O)`}><SquarePen className="h-[18px] w-[18px]" /></button>
              </div>
            )}
            <button onClick={newChat} className={`${iconBtn} md:hidden`} aria-label={t('newChat')}><SquarePen className="h-[18px] w-[18px]" /></button>
            {titles[view] && <span className="ml-1 truncate text-sm font-medium text-zinc-300">{titles[view]}</span>}
          </div>
          <div className="flex items-center gap-2">
            {me?.arcBalance != null && (
              <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-300 sm:flex" title={lang === 'vi' ? 'Số dư USDC trên ví (Arc Testnet)' : 'Wallet USDC balance (Arc Testnet)'}>
                <Wallet className="h-3.5 w-3.5 text-zinc-500" />{fmtNum(me.arcBalance, 2)} USDC
              </div>
            )}
            <button onClick={() => go('credits')} aria-label={`${me?.user.credits ?? 0} ${t('credits')} — ${t('topUp')}`} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${(me?.user.credits ?? 0) < 10 ? 'border-amber-300/30 bg-amber-300/[0.08] text-amber-100 hover:bg-amber-300/[0.14]' : 'border-teal-300/20 bg-teal-300/[0.06] text-teal-100 hover:bg-teal-300/[0.12]'}`}>
              <Zap className="h-3.5 w-3.5" /><AnimatedNumber value={me?.user.credits ?? 0} /> <span className="max-sm:hidden">{t('credits')}</span>
            </button>
            <ThemeToggle />
            <LangToggle />
          </div>
        </header>
        <div className="relative min-h-0 flex-1">
          {view !== 'chat' && <ChatBackdrop />}
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="relative h-full">
              {view === 'chat' && <ChatView conversationId={convId} onConversation={setConvId} onNeedCredits={() => go('credits')} pendingPrompt={pendingPrompt} onPromptConsumed={() => setPendingPrompt(null)} />}
              {view === 'credits' && <CreditsView />}
              {view === 'history' && <HistoryView />}
              {view === 'settings' && <SettingsView onCleared={() => setConvId(null)} />}
              {view === 'wallet' && <WalletView onAsk={ask} />}
              {view === 'verify' && <VerifyView onAsk={ask} onNeedCredits={() => go('credits')} />}
              {view === 'projects' && <ProjectsView onAsk={ask} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNew={newChat}
        onSelect={select}
        onView={go}
        onToggleSidebar={toggleSidebar}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
