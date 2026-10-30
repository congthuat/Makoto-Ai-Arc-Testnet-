import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { Search, Star, X, Loader2, RefreshCw, Landmark, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { fmtUsd, timeAgo } from '@/lib/format'
import { type ProjectCard, type ProjectRef, type Saved, Logo, TgeBadge, daysAgo } from './shared'
import { ProjectDetail } from './ProjectDetail'

const compact = (s: string | null | undefined) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')

function useSaved() {
  const { token, authFetch } = useSession()
  const qc = useQueryClient()
  const q = useQuery<{ items: Saved[] }>({
    queryKey: ['projects-saved', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const r = await authFetch('projects/saved')
      if (!r.ok) throw new Error('load')
      return r.json()
    },
  })
  const set = (fn: (items: Saved[]) => Saved[]) => qc.setQueryData<{ items: Saved[] }>(['projects-saved', token], (d) => ({ items: fn(d?.items || []) }))
  const refresh = () => qc.invalidateQueries({ queryKey: ['projects-saved', token] })
  return { saved: q.data?.items || [], set, refresh, authFetch, token }
}

type Sort = 'recent' | 'raise'

export function ProjectsView({ onAsk }: { onAsk?: (text: string) => void }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [sector, setSector] = useState<string | null>(null)
  const [shown, setShown] = useState(24)
  const [open, setOpen] = useState<ProjectRef | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const listTop = useRef(0)
  const seen = useRef(new Map<string, ProjectRef>())

  // Opening a project replaces the list with a full page; browser Back returns to the list.
  const openItem = useCallback((x: ProjectRef) => {
    if (!x?.id) return
    seen.current.set(x.id, x)
    setOpen((cur) => {
      if (!cur) listTop.current = scrollRef.current?.scrollTop || 0
      return x
    })
    try { history.pushState({ ...(history.state || {}), mkProject: x.id }, '') } catch { /* ignore */ }
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }))
  }, [])
  const back = useCallback(() => {
    if (history.state?.mkProject) history.back()
    else setOpen(null)
  }, [])
  useEffect(() => {
    const pop = (e: PopStateEvent) => {
      const k = e.state?.mkProject as string | undefined
      setOpen(k ? seen.current.get(k) || null : null)
      if (k) requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }))
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const wasOpen = useRef(false)
  useLayoutEffect(() => {
    if (!open && wasOpen.current && scrollRef.current) {
      const el = scrollRef.current, top = listTop.current
      el.scrollTop = top
      requestAnimationFrame(() => { if (Math.abs(el.scrollTop - top) > 4) el.scrollTop = top })
    }
    wasOpen.current = Boolean(open)
  }, [open])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key !== 'Escape' || el?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return
      back()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, back])
  // A project clicked in a chat answer opens straight into its profile.
  useEffect(() => {
    const take = () => {
      try {
        const raw = sessionStorage.getItem('mk:project-open')
        if (!raw) return
        sessionStorage.removeItem('mk:project-open')
        const x = JSON.parse(raw) as ProjectRef
        if (x?.id && x?.name) openItem(x)
      } catch { /* ignore */ }
    }
    take()
    window.addEventListener('mk:project', take)
    return () => window.removeEventListener('mk:project', take)
  }, [openItem])

  const { saved, set, refresh, authFetch, token } = useSaved()
  const savedSet = useMemo(() => new Set(saved.map((t) => t.key)), [saved])

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ items: ProjectCard[]; updated_at: number; stale?: boolean }>({
    queryKey: ['projects'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await fetch(api('projects'))
      if (!r.ok) throw new Error('load')
      return r.json()
    },
  })
  const all = useMemo(() => data?.items || [], [data])

  // Typing a name searches every project Makoto knows, not only the recently funded list.
  const [dq, setDq] = useState('')
  useEffect(() => { const t = setTimeout(() => setDq(query.trim()), 350); return () => clearTimeout(t) }, [query])
  const remote = useQuery<{ items: ProjectCard[] }>({
    queryKey: ['project-search', dq],
    enabled: compact(dq).length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await fetch(api(`projects/search?q=${encodeURIComponent(dq)}`))
      if (!r.ok) throw new Error('search')
      return r.json()
    },
  })
  const q = compact(query)
  const searching = q.length >= 2 && (dq !== query.trim() || remote.isFetching)

  useEffect(() => setShown(24), [query, sort, sector])

  const sectors = useMemo(() => {
    const n = new Map<string, number>()
    for (const a of all) for (const t of a.tags) n.set(t, (n.get(t) || 0) + 1)
    return [...n.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)
  }, [all])

  const list = useMemo(() => {
    if (q.length >= 1) {
      let rows = all.filter((a) => compact(a.name).includes(q) || compact(a.symbol) === q)
      if (q.length >= 2 && dq === query.trim() && remote.data?.items) {
        const have = new Set(rows.map((a) => a.id))
        rows = rows.concat(remote.data.items.filter((a) => !have.has(a.id)))
      }
      return rows
    }
    const rows = sector ? all.filter((a) => a.tags.includes(sector)) : all
    return sort === 'raise' ? [...rows].sort((a, b) => (b.last_raise || 0) - (a.last_raise || 0)) : rows
  }, [all, q, query, dq, remote.data, sort, sector])

  const toggleSave = async (a: ProjectRef) => {
    if (!token) return toast(vi ? 'Đăng nhập để lưu dự án' : 'Sign in to save projects')
    const has = savedSet.has(a.id)
    set((items) => (has ? items.filter((t) => t.key !== a.id) : [{ key: a.id, name: a.name, logo: a.logo || null, created_at: new Date().toISOString() }, ...items]))
    const r = await authFetch(has ? `projects/saved/${encodeURIComponent(a.id)}` : 'projects/saved', has ? { method: 'DELETE' } : { method: 'POST', body: JSON.stringify({ key: a.id, name: a.name }) }).catch(() => null)
    if (!r?.ok) {
      const d = await r?.json().catch(() => ({}))
      toast.error(d?.code === 'LIMIT' ? (vi ? 'Bạn đã lưu tối đa 60 dự án' : 'You can save up to 60 projects') : (vi ? 'Chưa lưu được, vui lòng thử lại' : "Couldn't save, try again"))
      refresh()
      return
    }
    toast.success(has ? (vi ? `Đã bỏ lưu ${a.name}` : `Removed ${a.name}`) : (vi ? `Đã lưu ${a.name}` : `Saved ${a.name}`))
  }

  const chip = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[12.5px] font-medium transition md:min-h-0 md:py-1.5 ${on ? 'border-teal-300/40 bg-teal-300/[0.12] text-teal-100' : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200'}`

  if (open) {
    return (
      <div ref={scrollRef} data-mk="projects" className="mk-scroll h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-5">
          <ProjectDetail key={open.id} p={open} vi={vi} saved={savedSet.has(open.id)} onBack={back} onSave={() => toggleSave(open)} onAsk={onAsk} onOpen={openItem} />
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} data-mk="projects" className="mk-scroll h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-5 sm:py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white">{vi ? 'Dự án' : 'Projects'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {vi
              ? 'Hồ sơ dự án crypto: giới thiệu, đội ngũ, lịch sử gọi vốn, quỹ đầu tư, token và hợp đồng chính thức. Danh sách gồm các dự án vừa được các quỹ hàng đầu rót vốn; tìm theo tên để tra cứu bất kỳ dự án nào.'
              : 'Crypto project profiles: overview, team, funding history, investors, token and official contracts. The list shows projects recently funded by top-tier funds; search by name to look up any project.'}
          </p>
        </div>

        {saved.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white"><Star className="h-4 w-4 fill-amber-300 text-amber-300" />{vi ? 'Dự án đã lưu' : 'Saved projects'}<span className="text-zinc-500">· {saved.length}</span></h2>
            <div className="mk-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              {saved.map((t) => (
                <button key={t.key} onClick={() => openItem({ id: t.key, name: t.name, logo: t.logo })} className="flex shrink-0 items-center gap-2 rounded-full border border-white/[0.07] bg-[#0b0b13]/80 py-1.5 pl-1.5 pr-3.5 text-left transition hover:border-teal-300/30">
                  <Logo src={t.logo} name={t.name} size={26} />
                  <span className="max-w-[160px] truncate text-[13px] font-medium text-zinc-100">{t.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="sticky top-0 z-10 -mx-4 mb-4 space-y-2.5 border-b border-white/[0.05] bg-[#05060B]/80 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={vi ? 'Tìm dự án theo tên, mã token hoặc website…' : 'Search by name, ticker or website…'} aria-label={vi ? 'Tìm dự án' : 'Search projects'} className="h-11 w-full rounded-full border border-white/[0.08] bg-white/[0.03] pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 focus:border-teal-300/40 focus:outline-none" />
            {query && <button onClick={() => setQuery('')} aria-label={vi ? 'Xóa tìm kiếm' : 'Clear search'} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"><X className="h-4 w-4" /></button>}
          </label>
          {!q && (
            <div className="mk-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1">
              <button onClick={() => setSort('recent')} className={chip(sort === 'recent')}>{vi ? 'Mới gọi vốn' : 'Recently funded'}</button>
              <button onClick={() => setSort('raise')} className={chip(sort === 'raise')}>{vi ? 'Vòng gọi vốn lớn nhất' : 'Largest rounds'}</button>
              {sectors.length > 0 && <span className="mx-1 my-auto h-4 w-px shrink-0 bg-white/[0.08]" />}
              {sectors.map((t) => <button key={t} onClick={() => setSector((s) => (s === t ? null : t))} className={chip(sector === t)}>{t}</button>)}
            </div>
          )}
        </div>

        {data && (
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
            <span>{searching && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}{vi ? `${list.length} dự án` : `${list.length} projects`}{data.updated_at && !q ? ` · ${vi ? 'cập nhật' : 'updated'} ${timeAgo(data.updated_at, lang)}` : ''}</span>
            <button onClick={() => refetch()} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 hover:text-zinc-300 md:min-h-0" aria-label={vi ? 'Làm mới' : 'Refresh'}><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /></button>
          </div>
        )}

        {isLoading && <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="mk-skel h-[150px] rounded-2xl" />)}</div>}
        {isError && !data && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
            {vi ? 'Chưa tải được dữ liệu dự án.' : "Couldn't load projects."}
            <button onClick={() => refetch()} className="ml-2 font-medium text-teal-300 hover:underline">{vi ? 'Thử lại' : 'Retry'}</button>
          </div>
        )}
        {data && list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center text-sm text-zinc-500">
            {searching ? (vi ? 'Đang tìm kiếm…' : 'Searching…')
              : q ? (vi ? `Không tìm thấy dự án “${query.trim()}”.` : `No project found for “${query.trim()}”.`)
                : (vi ? 'Chưa có dự án nào.' : 'No projects yet.')}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {list.slice(0, shown).map((a, i) => (
            <Card key={a.id} a={a} vi={vi} index={i} saved={savedSet.has(a.id)} onOpen={() => openItem(a)} onSave={() => toggleSave(a)} />
          ))}
        </div>
        {list.length > shown && (
          <div className="mt-5 text-center">
            <button onClick={() => setShown((s) => s + 24)} className="min-h-10 rounded-full border border-white/[0.1] bg-white/[0.03] px-5 text-sm font-medium text-zinc-200 transition hover:border-teal-300/30">
              {vi ? `Xem thêm (${list.length - shown})` : `Show more (${list.length - shown})`}
            </button>
          </div>
        )}

        <p className="mt-8 text-[11.5px] leading-relaxed text-zinc-500">
          {vi ? 'Dữ liệu tổng hợp từ các nguồn công khai, chỉ mang tính tham khảo và không phải lời khuyên đầu tư.' : 'Aggregated from public sources for reference only. Not financial advice.'}
        </p>
      </div>
    </div>
  )
}

function Card({ a, vi, index, saved, onOpen, onSave }: { a: ProjectCard; vi: boolean; index: number; saved: boolean; onOpen: () => void; onSave: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.025 }} className="group relative flex flex-col rounded-2xl border border-white/[0.07] bg-[#0b0b13]/80 p-4 backdrop-blur transition hover:border-teal-300/25">
      <button onClick={onOpen} className="absolute inset-0 rounded-2xl" aria-label={vi ? `Xem hồ sơ ${a.name}` : `Open ${a.name}`} />
      <div className="pointer-events-none relative flex items-start gap-3 pr-8">
        <Logo src={a.logo} name={a.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-white">{a.name}</span>
            {a.symbol && <span className="shrink-0 font-mono text-[11px] text-zinc-500">${a.symbol}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TgeBadge s={a.tge_status} vi={vi} />
            {a.tags.slice(0, 2).map((t) => <span key={t} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] text-zinc-400">{t}</span>)}
          </div>
        </div>
      </div>
      {a.summary && <p className="pointer-events-none relative mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-400">{a.summary}</p>}
      <div className="pointer-events-none relative mt-auto pt-3">
        {(a.raised_at || a.total_raise) ? (
          <div className="flex items-center gap-1.5 text-[12px]">
            <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            {a.raised_at ? (
              <>
                <span className="text-zinc-500">{vi ? 'Vòng gần nhất:' : 'Latest round:'}</span>
                <span className="font-medium text-zinc-200">{a.last_raise ? fmtUsd(a.last_raise, { compact: true }) : (vi ? 'Không công bố' : 'Undisclosed')}</span>
                <span className="text-zinc-500">· {daysAgo(a.raised_at, vi)}</span>
              </>
            ) : (
              <>
                <span className="text-zinc-500">{vi ? 'Tổng gọi vốn:' : 'Total raised:'}</span>
                <span className="font-medium text-zinc-200">{fmtUsd(a.total_raise, { compact: true })}</span>
              </>
            )}
          </div>
        ) : null}
        {a.backers.length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-[12px]">
            <Landmark className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="shrink-0 text-zinc-500">{vi ? 'Quỹ:' : 'Backers:'}</span>
            <span className="truncate text-zinc-300">{a.backers.join(', ')}</span>
          </div>
        )}
      </div>
      <button onClick={onSave} aria-pressed={saved} aria-label={saved ? (vi ? 'Bỏ lưu' : 'Unsave') : (vi ? 'Lưu dự án' : 'Save project')} className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-white/[0.06] hover:text-amber-200">
        <Star className={`h-[18px] w-[18px] ${saved ? 'fill-amber-300 text-amber-300' : ''}`} />
      </button>
    </motion.div>
  )
}
