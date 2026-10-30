import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Pencil, Trash2, Zap, History, Settings, LogOut, Check, X, Droplets, PanelLeftClose, Pin, PinOff, ChevronsUpDown, Keyboard, Copy, Wallet, ShieldCheck, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { shortAddr, ARC } from '@/lib/wallet'
import { Logo, AnimatedNumber } from './Brand'
import { MOD } from './CommandPalette'
import { openConnections } from './Connections'

type Conv = { id: number; title: string; pinned?: boolean; updated_at: string }
export type View = 'chat' | 'credits' | 'history' | 'settings' | 'wallet' | 'verify' | 'projects'

/** Deterministic gradient avatar from a wallet address. */
export function AddressAvatar({ address, size = 28 }: { address?: string; size?: number }) {
  const a = (address || '0x0').toLowerCase()
  const h1 = parseInt(a.slice(2, 6) || '0', 16) % 360
  const h2 = (h1 + 60 + (parseInt(a.slice(6, 9) || '0', 16) % 120)) % 360
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full ring-1 ring-white/15"
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, hsl(${h1} 85% 70%), transparent 60%), linear-gradient(135deg, hsl(${h1} 70% 50%), hsl(${h2} 70% 45%))` }}
    />
  )
}

/** Google profile photo, or a coloured initial when there is none / it fails to load. */
export function UserAvatar({ user, size = 28 }: { user?: { avatar?: string | null; name?: string | null; email?: string | null; address?: string; wallet?: string | null }; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (user?.avatar && !broken) return <img src={user.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} width={size} height={size} className="shrink-0 rounded-full object-cover ring-1 ring-white/15" style={{ width: size, height: size }} />
  const label = (user?.name || user?.email || '').trim()
  if (!label) return <AddressAvatar address={user?.wallet || user?.address} size={size} />
  let h = 0
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/15" style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, hsl(${h} 65% 48%), hsl(${(h + 70) % 360} 65% 42%))` }}>
      {label[0].toUpperCase()}
    </span>
  )
}

function UserMenu({ onView, onShortcuts }: { onView: (v: View) => void; onShortcuts: () => void }) {
  const { me, logout, linkWallet } = useSession()
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const u = me?.user
  const addr = u?.wallet || undefined
  const display = u?.name || u?.email || (addr ? shortAddr(addr) : u?.address?.startsWith('0x') ? shortAddr(u.address) : lang === 'vi' ? 'Tài khoản' : 'Account')
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white'
  const pick = (fn: () => void) => () => { setOpen(false); fn() }
  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            role="menu"
            className="absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border border-white/[0.09] bg-[#10111a]/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="px-2.5 pb-2 pt-1.5">
              {u?.email && <div className="truncate text-xs text-zinc-300" title={u.email}>{u.email}</div>}
              {addr ? (
                <button onClick={() => { navigator.clipboard.writeText(addr); toast.success(t('copied')) }} className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 hover:text-white">
                  <Wallet className="h-3 w-3" />{shortAddr(addr)}<Copy className="h-3 w-3" />
                </button>
              ) : (
                <button onClick={pick(openConnections)} className="mt-0.5 flex min-h-8 items-center gap-1.5 text-[11px] text-teal-300/90 hover:text-teal-200 md:min-h-0">
                  <Wallet className="h-3 w-3" />{lang === 'vi' ? 'Chưa kết nối ví · Kết nối' : 'No wallet · Connect'}
                </button>
              )}
            </div>
            <div className="my-1 h-px bg-white/[0.06]" />
            {addr ? (
              <button role="menuitem" onClick={pick(openConnections)} className={item}>
                <Wallet className="h-4 w-4 text-zinc-500" />{lang === 'vi' ? 'Ví đã kết nối' : 'Connected wallet'}
                <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{shortAddr(addr)}</span>
              </button>
            ) : (
              <button role="menuitem" onClick={pick(() => { void linkWallet() })} className={`${item} !text-teal-200 hover:!text-teal-100`}>
                <Wallet className="h-4 w-4 text-teal-300" />{lang === 'vi' ? 'Kết nối ví' : 'Connect wallet'}
                <span className="ml-auto rounded-md bg-teal-400/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-300">{lang === 'vi' ? 'Để nạp credit' : 'To top up'}</span>
              </button>
            )}
            <button role="menuitem" onClick={pick(() => onView('history'))} className={item}><History className="h-4 w-4 text-zinc-500" />{t('history')}</button>
            <button role="menuitem" onClick={pick(() => onView('settings'))} className={item}><Settings className="h-4 w-4 text-zinc-500" />{t('settings')}</button>
            <a role="menuitem" href={ARC.faucet} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={item}><Droplets className="h-4 w-4 text-zinc-500" />{t('getTestUsdc')}</a>
            <button role="menuitem" onClick={pick(onShortcuts)} className={`${item} max-md:hidden`}><Keyboard className="h-4 w-4 text-zinc-500" />{lang === 'vi' ? 'Phím tắt' : 'Shortcuts'}<span className="mk-kbd ml-auto">?</span></button>
            <div className="flex gap-1 px-1 py-0.5 text-[11.5px] text-zinc-500">
              <a href="#terms" onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center px-1.5 hover:text-white md:min-h-7">{lang === 'vi' ? 'Điều khoản' : 'Terms'}</a>
              <a href="#privacy" onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center px-1.5 hover:text-white md:min-h-7">{lang === 'vi' ? 'Quyền riêng tư' : 'Privacy'}</a>
            </div>
            <div className="my-1 h-px bg-white/[0.06]" />
            <button role="menuitem" onClick={pick(logout)} className={`${item} hover:!text-rose-200`}><LogOut className="h-4 w-4 text-zinc-500" />{t('logout')}</button>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05]">
        <UserAvatar user={u} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-zinc-200">{display}</span>
          <span className="flex items-center gap-1.5 truncate text-[11px] text-zinc-500">
            {addr
              ? <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" /><span className="truncate font-mono">{shortAddr(addr)}</span></>
              : <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />{lang === 'vi' ? 'Chưa kết nối ví' : 'No wallet connected'}</>}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-zinc-500" />
      </button>
    </div>
  )
}

export function Sidebar({ activeId, view, onSelect, onNew, onView, onClose, onCollapse, onShortcuts }: {
  activeId: number | null
  view: View
  onSelect: (id: number) => void
  onNew: () => void
  onView: (v: View) => void
  onClose?: () => void
  onCollapse?: () => void
  onSearch?: () => void
  onShortcuts: () => void
}) {
  const { authFetch, token, me } = useSession()
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  const { data, isLoading } = useQuery<{ conversations: Conv[] }>({
    queryKey: ['conversations', token],
    enabled: Boolean(token),
    queryFn: () => authFetch('conversations').then((r) => r.json()),
  })

  const groups = useMemo(() => {
    const list = data?.conversations || []
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0)
    const startYest = new Date(startToday.getTime() - 86400000)
    const startWeek = new Date(startToday.getTime() - 7 * 86400000)
    const g: { label: string; items: Conv[] }[] = [
      { label: lang === 'vi' ? 'Đã ghim' : 'Pinned', items: [] },
      { label: t('today'), items: [] },
      { label: t('yesterday'), items: [] },
      { label: lang === 'vi' ? '7 ngày qua' : 'Previous 7 days', items: [] },
      { label: t('earlier'), items: [] },
    ]
    for (const c of list) {
      const d = new Date(c.updated_at)
      ;(c.pinned ? g[0] : d >= startToday ? g[1] : d >= startYest ? g[2] : d >= startWeek ? g[3] : g[4]).items.push(c)
    }
    return g.filter((x) => x.items.length)
  }, [data, t, lang])

  const rename = async (id: number) => {
    if (draft.trim()) await authFetch(`conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title: draft }) })
    setEditing(null)
    qc.invalidateQueries({ queryKey: ['conversations'] })
  }
  const togglePin = async (c: Conv) => {
    qc.setQueryData<{ conversations: Conv[] }>(['conversations', token], (old) => old && { conversations: old.conversations.map((x) => (x.id === c.id ? { ...x, pinned: !c.pinned } : x)) })
    await authFetch(`conversations/${c.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !c.pinned }) })
    qc.invalidateQueries({ queryKey: ['conversations'] })
  }
  const remove = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return
    await authFetch(`conversations/${id}`, { method: 'DELETE' })
    if (activeId === id) onNew()
    qc.invalidateQueries({ queryKey: ['conversations'] })
    toast.success(lang === 'vi' ? 'Đã xóa cuộc trò chuyện' : 'Conversation deleted')
  }

  const credits = me?.user.credits ?? 0
  const iconBtn = 'rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-white'

  return (
    <aside className="flex h-full w-[272px] flex-col border-r border-white/[0.06] bg-[#07080e]">
      <div className="flex h-14 shrink-0 items-center justify-between pl-4 pr-2.5">
        <Logo size={24} />
        {onClose && <button onClick={onClose} className={iconBtn} aria-label={lang === 'vi' ? 'Đóng' : 'Close'}><X className="h-4 w-4" /></button>}
        {onCollapse && <button onClick={onCollapse} className={iconBtn} aria-label={lang === 'vi' ? 'Thu gọn thanh bên' : 'Collapse sidebar'} title={`${lang === 'vi' ? 'Thu gọn' : 'Collapse'} (${MOD} B)`}><PanelLeftClose className="h-4 w-4" /></button>}
      </div>
      <div className="space-y-1 px-2.5">
        <button onClick={onNew} className="group flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-sm font-medium text-white transition hover:border-teal-300/30 hover:bg-white/[0.06]">
          <Plus className="h-4 w-4 transition group-hover:rotate-90" />{t('newChat')}
          <span className="ml-auto hidden gap-0.5 opacity-0 transition group-hover:opacity-100 md:flex"><span className="mk-kbd">{MOD}</span><span className="mk-kbd">⇧</span><span className="mk-kbd">O</span></span>
        </button>
        <button onClick={() => onView('verify')} aria-current={view === 'verify' ? 'page' : undefined} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${view === 'verify' ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}>
          <ShieldCheck className="h-4 w-4" />{lang === 'vi' ? 'Xác minh' : 'Verify'}
        </button>
        <button onClick={() => onView('projects')} aria-current={view === 'projects' ? 'page' : undefined} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${view === 'projects' ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}>
          <Building2 className="h-4 w-4" />{lang === 'vi' ? 'Dự án' : 'Projects'}
        </button>
        <button onClick={() => onView('wallet')} aria-current={view === 'wallet' ? 'page' : undefined} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${view === 'wallet' ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}>
          <Wallet className="h-4 w-4" />{lang === 'vi' ? 'Ví trên Arc' : 'Arc wallets'}
        </button>
      </div>

      <nav className="mk-scroll mt-3 min-h-0 flex-1 overflow-y-auto px-2.5" aria-label={lang === 'vi' ? 'Cuộc trò chuyện' : 'Conversations'}>
        {isLoading && (
          <div className="space-y-2 px-3 pt-2">{[70, 55, 80, 60, 45].map((w, i) => <div key={i} className="mk-skel h-4" style={{ width: `${w}%` }} />)}</div>
        )}
        {!isLoading && groups.length === 0 && <div className="px-3 py-6 text-center text-xs text-zinc-600">{t('noChats')}</div>}
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <div className="px-3 pb-1 text-[11px] font-medium text-zinc-600">{g.label}</div>
            <AnimatePresence initial={false}>
              {g.items.map((c) => {
                const active = activeId === c.id && view === 'chat'
                return (
                  <motion.div key={c.id} layout="position" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="group relative">
                    {editing === c.id ? (
                      <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] px-2 py-1.5">
                        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') rename(c.id); if (e.key === 'Escape') setEditing(null) }} className="min-w-0 flex-1 bg-transparent text-sm text-white focus:outline-none" aria-label={t('rename')} />
                        <button onClick={() => rename(c.id)} className="p-1 text-emerald-400" aria-label={t('rename')}><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setEditing(null)} className="p-1 text-zinc-400" aria-label={lang === 'vi' ? 'Hủy' : 'Cancel'}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => onSelect(c.id)} aria-current={active ? 'page' : undefined} className={`relative flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'}`}>
                        {active && <motion.span layoutId="mk-active-chat" className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-teal-300 to-blue-500" />}
                        <span className="truncate pr-14 [@media(hover:none)]:pr-[6.5rem] group-hover:[mask-image:linear-gradient(90deg,#000_70%,transparent)]">{c.title}</span>
                      </button>
                    )}
                    {editing !== c.id && (
                      <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex group-focus-within:flex [@media(hover:none)]:flex">
                        <button onClick={() => togglePin(c)} className="rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-white [@media(hover:none)]:flex [@media(hover:none)]:h-8 [@media(hover:none)]:w-8 [@media(hover:none)]:items-center [@media(hover:none)]:justify-center" title={c.pinned ? (lang === 'vi' ? 'Bỏ ghim' : 'Unpin') : lang === 'vi' ? 'Ghim' : 'Pin'} aria-label={c.pinned ? (lang === 'vi' ? 'Bỏ ghim' : 'Unpin') : lang === 'vi' ? 'Ghim' : 'Pin'}>{c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}</button>
                        <button onClick={() => { setEditing(c.id); setDraft(c.title) }} className="rounded-md p-1 text-zinc-500 hover:bg-white/10 hover:text-white [@media(hover:none)]:flex [@media(hover:none)]:h-8 [@media(hover:none)]:w-8 [@media(hover:none)]:items-center [@media(hover:none)]:justify-center" title={t('rename')} aria-label={t('rename')}><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => remove(c.id)} className="rounded-md p-1 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-300 [@media(hover:none)]:flex [@media(hover:none)]:h-8 [@media(hover:none)]:w-8 [@media(hover:none)]:items-center [@media(hover:none)]:justify-center" title={t('delete')} aria-label={t('delete')}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-1.5 border-t border-white/[0.06] p-2.5">
        <button onClick={() => onView('credits')} className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left transition ${view === 'credits' ? 'border-teal-300/35' : 'border-teal-300/15 hover:border-teal-300/30'} bg-gradient-to-br from-teal-300/[0.08] via-blue-500/[0.05] to-violet-500/[0.06]`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">{t('balance')}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-black">{t('topUp')}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <Zap className={`h-4 w-4 self-center ${credits < 10 ? 'text-amber-300' : 'text-teal-300'}`} />
            <AnimatedNumber value={credits} className="text-xl font-semibold tracking-tight text-white" />
            <span className="text-xs text-zinc-400">{t('credits')}</span>
          </div>
        </button>
        <UserMenu onView={onView} onShortcuts={onShortcuts} />
      </div>
    </aside>
  )
}
