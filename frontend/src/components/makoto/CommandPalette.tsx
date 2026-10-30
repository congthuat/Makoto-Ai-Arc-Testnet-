import { useEffect } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Zap, History, Settings, Languages, Sparkles, Droplets, Keyboard, LogOut, MessageSquare, PanelLeft, Search, Pin, CornerDownLeft, Wallet, Sun, Moon, ShieldCheck, Brain, Building2 } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { ARC } from '@/lib/wallet'
import { openMemory } from './Memory'
import type { View } from './Sidebar'

export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

type Conv = { id: number; title: string; pinned?: boolean; updated_at: string }

export function Overlay({ open, onClose, children, className = '', layer = 'z-[60]' }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string; layer?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className={`fixed inset-0 ${layer} flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} className={`w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c0d15]/95 shadow-[0_30px_120px_-20px_rgba(0,0,0,.9)] backdrop-blur-2xl ${className}`}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CommandPalette({ open, onClose, onNew, onSelect, onView, onToggleSidebar, onShortcuts }: {
  open: boolean
  onClose: () => void
  onNew: () => void
  onSelect: (id: number) => void
  onView: (v: View) => void
  onToggleSidebar: () => void
  onShortcuts: () => void
}) {
  const { theme, setMode } = useTheme()
  const { authFetch, token, me, logout, refreshMe } = useSession()
  const { lang, setLang, t } = useI18n()
  const vi = lang === 'vi'
  const { data } = useQuery<{ conversations: Conv[] }>({
    queryKey: ['conversations', token],
    enabled: Boolean(token),
    queryFn: () => authFetch('conversations').then((r) => r.json()),
  })
  const run = (fn: () => void) => () => { onClose(); fn() }
  const setModel = (m: 'fast' | 'pro') => authFetch('me', { method: 'PATCH', body: JSON.stringify({ model: m }) }).then(() => refreshMe())
  const model = me?.user.model || 'fast'

  const item = 'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 data-[selected=true]:bg-white/[0.07] data-[selected=true]:text-white'
  const group = 'px-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500'
  const icon = 'h-4 w-4 shrink-0 text-zinc-500'
  const kbd = (s: string) => <span className="ml-auto flex gap-1">{s.split(' ').map((k) => <span key={k} className="mk-kbd">{k}</span>)}</span>

  return (
    <Overlay open={open} onClose={onClose} className="max-w-xl">
      <Command loop label={vi ? 'Bảng lệnh' : 'Command menu'}>
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="h-4 w-4 text-zinc-500" />
          <Command.Input autoFocus placeholder={vi ? 'Tìm cuộc trò chuyện hoặc gõ lệnh…' : 'Search chats or type a command…'} className="h-14 flex-1 bg-transparent text-[15px] text-white placeholder:text-zinc-500 focus:outline-none" />
          <span className="mk-kbd">Esc</span>
        </div>
        <Command.List className="mk-scroll max-h-[min(60vh,440px)] overflow-y-auto pb-2">
          <Command.Empty className="py-10 text-center text-sm text-zinc-500">{vi ? 'Không tìm thấy kết quả' : 'No results'}</Command.Empty>
          <Command.Group heading={vi ? 'Hành động' : 'Actions'} className={group}>
            <Command.Item value="new chat cuoc tro chuyen moi" onSelect={run(onNew)} className={item}><Plus className={icon} />{t('newChat')}{kbd(`${MOD} ⇧ O`)}</Command.Item>
            <Command.Item value="top up nap credit buy" onSelect={run(() => onView('credits'))} className={item}><Zap className={icon} />{t('topUp')}</Command.Item>
            <Command.Item value="xac minh kiem keo check call scam verify lua dao" onSelect={run(() => onView('verify'))} className={item}><ShieldCheck className={icon} />{lang === 'vi' ? 'Xác minh' : 'Verify'}</Command.Item>
            <Command.Item value="du an projects ho so project profile quy dau tu funding" onSelect={run(() => onView('projects'))} className={item}><Building2 className={icon} />{lang === 'vi' ? 'Dự án' : 'Projects'}</Command.Item>
            <Command.Item value="arc wallet vi explorer" onSelect={run(() => onView('wallet'))} className={item}><Wallet className={icon} />{lang === 'vi' ? 'Ví trên Arc' : 'Arc wallets'}</Command.Item>
            <Command.Item value="memory tri nho makoto nho gi ve toi" onSelect={run(openMemory)} className={item}><Brain className={icon} />{vi ? 'Trí nhớ của Makoto' : "Makoto's memory"}</Command.Item>
            <Command.Item value="history lich su" onSelect={run(() => onView('history'))} className={item}><History className={icon} />{t('history')}</Command.Item>
            <Command.Item value="settings cai dat" onSelect={run(() => onView('settings'))} className={item}><Settings className={icon} />{t('settings')}</Command.Item>
            <Command.Item value="toggle sidebar an hien thanh ben" onSelect={run(onToggleSidebar)} className={`${item} max-md:hidden`}><PanelLeft className={icon} />{vi ? 'Ẩn/hiện thanh bên' : 'Toggle sidebar'}{kbd(`${MOD} B`)}</Command.Item>
          </Command.Group>
          <Command.Group heading={vi ? 'Tùy chọn' : 'Preferences'} className={group}>
            <Command.Item value="language ngon ngu english tieng viet" onSelect={run(() => setLang(vi ? 'en' : 'vi'))} className={item}><Languages className={icon} />{vi ? 'Chuyển sang English' : 'Chuyển sang Tiếng Việt'}</Command.Item>
            <Command.Item value="theme giao dien sang toi dark light day night ngay dem" onSelect={run(() => setMode(theme === 'light' ? 'dark' : 'light', { x: window.innerWidth / 2, y: window.innerHeight / 3 }))} className={item}>{theme === 'light' ? <Moon className={icon} /> : <Sun className={icon} />}{theme === 'light' ? (vi ? 'Chuyển sang giao diện tối' : 'Switch to dark mode') : (vi ? 'Chuyển sang giao diện sáng' : 'Switch to light mode')}</Command.Item>
            <Command.Item value="model fast nhanh" onSelect={run(() => setModel('fast'))} className={item}><Zap className={icon} />Makoto Fast<span className="text-zinc-500">· 1 {t('credits')}</span>{model === 'fast' && <span className="ml-auto text-xs text-teal-300">{vi ? 'Đang dùng' : 'Active'}</span>}</Command.Item>
            <Command.Item value="model pro" onSelect={run(() => setModel('pro'))} className={item}><Sparkles className={icon} />Makoto Pro<span className="text-zinc-500">· 5 {t('credits')}</span>{model === 'pro' && <span className="ml-auto text-xs text-teal-300">{vi ? 'Đang dùng' : 'Active'}</span>}</Command.Item>
            <Command.Item value="faucet usdc testnet" onSelect={run(() => window.open(ARC.faucet, '_blank', 'noopener'))} className={item}><Droplets className={icon} />{t('getTestUsdc')}</Command.Item>
            <Command.Item value="keyboard shortcuts phim tat" onSelect={run(onShortcuts)} className={item}><Keyboard className={icon} />{vi ? 'Phím tắt' : 'Keyboard shortcuts'}{kbd('?')}</Command.Item>
            <Command.Item value="logout dang xuat" onSelect={run(logout)} className={item}><LogOut className={icon} />{t('logout')}</Command.Item>
          </Command.Group>
          {(data?.conversations?.length ?? 0) > 0 && (
            <Command.Group heading={vi ? 'Cuộc trò chuyện' : 'Conversations'} className={group}>
              {data!.conversations.slice(0, 60).map((c) => (
                <Command.Item key={c.id} value={`chat-${c.id} ${c.title}`} onSelect={run(() => onSelect(c.id))} className={item}>
                  {c.pinned ? <Pin className={icon} /> : <MessageSquare className={icon} />}
                  <span className="truncate">{c.title}</span>
                  <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 [[data-selected=true]_&]:opacity-100" />
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Overlay>
  )
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const rows: [string, string][] = [
    [`${MOD} K`, vi ? 'Mở bảng lệnh / tìm kiếm' : 'Open command menu / search'],
    [`${MOD} ⇧ O`, vi ? 'Cuộc trò chuyện mới' : 'New chat'],
    [`${MOD} B`, vi ? 'Ẩn/hiện thanh bên' : 'Toggle sidebar'],
    ['/', vi ? 'Lệnh nhanh trong ô chat' : 'Quick commands in the composer'],
    ['↵', vi ? 'Gửi tin nhắn' : 'Send message'],
    ['⇧ ↵', vi ? 'Xuống dòng' : 'New line'],
    ['Esc', vi ? 'Dừng trả lời / đóng' : 'Stop answer / close'],
    ['?', vi ? 'Xem phím tắt' : 'Show shortcuts'],
  ]
  return (
    <Overlay open={open} onClose={onClose} className="max-w-md">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-4">
        <Keyboard className="h-4 w-4 text-teal-300" />
        <h2 className="text-sm font-semibold text-white">{vi ? 'Phím tắt' : 'Keyboard shortcuts'}</h2>
      </div>
      <div className="divide-y divide-white/[0.05] px-5 py-2">
        {rows.map(([k, d]) => (
          <div key={k} className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-zinc-300">{d}</span>
            <span className="flex gap-1">{k.split(' ').map((x) => <span key={x} className="mk-kbd">{x}</span>)}</span>
          </div>
        ))}
      </div>
    </Overlay>
  )
}
