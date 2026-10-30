import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  ArrowLeft, Star, Loader2, Globe, Landmark, Coins, Copy, Users, MessageCircle, Sparkles, Clock, History, FileCode2, Info, Megaphone,
  Github, Send, BookOpen, PenLine, Youtube, Linkedin, Instagram, Music2, BadgeCheck, TrendingUp, TrendingDown, Layers, Network, CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { fmtUsd, fmtPct } from '@/lib/format'
import { type Project, type ProjectRef, type TokenInfo, type Related, TGE, Logo, TgeBadge, fmtDate, daysAgo, fmtCount, roundName } from './shared'

type Detail = { project: Project; token: TokenInfo | null; related: Related[] }

const card = 'rounded-2xl border border-white/[0.07] bg-[#0b0b13]/80 p-4 sm:p-5'
const h2 = 'mb-3 flex items-center gap-2 text-[15px] font-semibold text-white'
const fmtSupply = (n: number | null | undefined) => (n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString('en-US', { maximumFractionDigits: 0 }))
const host = (u: string | null | undefined) => { try { return u ? new URL(u).hostname.replace(/^www\./, '') : '' } catch { return '' } }
const short = (s: string) => (s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s)
const title = (x: string) => x.charAt(0) + x.slice(1).toLowerCase()

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] py-2 text-[13px] last:border-0">
      <dt className="shrink-0 text-zinc-500" title={hint}>{k}</dt>
      <dd className="min-w-0 text-right font-medium text-zinc-100">{v}</dd>
    </div>
  )
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#0b0b13]/80 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 truncate text-[15px] font-semibold text-white">{value}</div>
      {sub && <div className="truncate text-[11px] text-zinc-500">{sub}</div>}
    </div>
  )
}

const LINK_META: Record<string, { icon: typeof Globe; label: string; vi?: string }> = {
  x: { icon: Megaphone, label: 'X' },
  telegram: { icon: Send, label: 'Telegram' },
  discord: { icon: MessageCircle, label: 'Discord' },
  github: { icon: Github, label: 'GitHub' },
  blog: { icon: PenLine, label: 'Blog' },
  docs: { icon: BookOpen, label: 'Docs', vi: 'Tài liệu' },
  youtube: { icon: Youtube, label: 'YouTube' },
  linkedin: { icon: Linkedin, label: 'LinkedIn' },
  reddit: { icon: MessageCircle, label: 'Reddit' },
  farcaster: { icon: Megaphone, label: 'Farcaster' },
  instagram: { icon: Instagram, label: 'Instagram' },
  tiktok: { icon: Music2, label: 'TikTok' },
}

function LinkChip({ href, icon: Icon, children, title: t }: { href: string; icon: typeof Globe; children: React.ReactNode; title?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" title={t} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12.5px] text-zinc-300 transition hover:border-teal-300/30 hover:text-white">
      <Icon className="h-3.5 w-3.5" />{children}
    </a>
  )
}

export function ProjectDetail({ p: ref, vi, saved, onBack, onSave, onAsk, onOpen }: {
  p: ProjectRef; vi: boolean; saved: boolean; onBack: () => void; onSave: () => void; onAsk?: (text: string) => void; onOpen: (x: ProjectRef) => void
}) {
  const { data, isLoading, isError, refetch } = useQuery<Detail>({
    queryKey: ['project', ref.id],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const r = await fetch(api(`projects/item/${encodeURIComponent(ref.id)}?name=${encodeURIComponent(ref.name || '')}`))
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    },
  })
  const [fullDesc, setFullDesc] = useState(false)
  useEffect(() => setFullDesc(false), [ref.id])

  const p = data?.project || null
  const tk = data?.token || null
  const name = p?.name || ref.name
  const symbol = p?.symbol || ref.symbol || null
  const funds = (p?.investors || []).filter((x) => !x.person)
  const leads = funds.filter((x) => x.lead)
  const raise = p?.total_raise || null
  const latest = p?.rounds?.[0] || null
  const site = p?.website || null
  const links = useMemo(() => {
    if (p?.links?.length) return p.links
    const so = p?.socials
    return so ? (['telegram', 'discord', 'github'] as const).filter((k) => so[k]?.url).map((k) => ({ kind: k as string, url: so[k]!.url })) : []
  }, [p])
  const siteHost = host(site)

  // One neutral paragraph with the headline facts.
  const summary = useMemo(() => {
    if (!p) return ''
    const out: string[] = []
    if (p.tags.length) out.push(vi ? `${p.name} hoạt động trong lĩnh vực ${p.tags.slice(0, 3).join(', ')}${p.chains.length ? `, trên ${p.chains.slice(0, 3).join(', ')}` : ''}.` : `${p.name} operates in ${p.tags.slice(0, 3).join(', ')}${p.chains.length ? ` on ${p.chains.slice(0, 3).join(', ')}` : ''}.`)
    if (raise) out.push(vi ? `Tổng vốn đã gọi ${fmtUsd(raise, { compact: true })}${p.rounds.length ? ` qua ${p.rounds.length} vòng` : ''}${leads.length ? `, dẫn đầu bởi ${leads.slice(0, 3).map((x) => x.name).join(', ')}` : funds.length ? ` từ ${funds.length} quỹ` : ''}.` : `Raised ${fmtUsd(raise, { compact: true })} in total${p.rounds.length ? ` across ${p.rounds.length} round${p.rounds.length > 1 ? 's' : ''}` : ''}${leads.length ? `, led by ${leads.slice(0, 3).map((x) => x.name).join(', ')}` : funds.length ? ` from ${funds.length} funds` : ''}.`)
    else if (p.rounds.length || funds.length) out.push(vi ? `Có ${funds.length} quỹ tham gia đầu tư, số vốn không công bố.` : `Backed by ${funds.length} funds; amount undisclosed.`)
    out.push(symbol && (tk || p.tge_status === 'post') ? (vi ? `Token $${symbol} đã được phát hành${p.exchanges.length ? ` và niêm yết trên ${p.exchanges.length} sàn` : ''}.` : `Token $${symbol} is live${p.exchanges.length ? ` and listed on ${p.exchanges.length} exchanges` : ''}.`)
      : p.tge_status === 'upcoming' ? (vi ? 'Token dự kiến sắp được phát hành.' : 'A token launch is expected soon.')
        : (vi ? 'Dự án chưa phát hành token.' : 'No token has been launched yet.'))
    if (p.team.length) out.push(vi ? `Đội ngũ có ${p.team.length} thành viên công khai.` : `${p.team.length} team members are public.`)
    return out.join(' ')
  }, [p, vi, raise, leads, funds, symbol, tk])

  // Funding rounds and token launch, oldest → newest.
  const timeline = useMemo(() => {
    const ev: { t: number; label: string; kind: 'fund' | 'tge' }[] = []
    for (const r of p?.rounds || []) if (r.date) ev.push({ t: r.date, kind: 'fund', label: `${vi ? 'Gọi vốn' : 'Raised'}${r.name && r.name !== 'Undisclosed' ? ` ${roundName(r.name, vi)}` : ''}${r.amount ? ` · ${fmtUsd(r.amount, { compact: true })}` : ''}${r.investors?.length ? ` · ${r.investors.slice(0, 2).map((x) => x.name).join(', ')}${r.investors.length > 2 ? '…' : ''}` : ''}` })
    if (p?.tge_time && (p.tge_status === 'post' || p.tge_time * 1000 > Date.now())) ev.push({ t: p.tge_time, kind: 'tge', label: p.tge_time * 1000 > Date.now() ? (vi ? 'Dự kiến phát hành token' : 'Expected token launch') : (vi ? 'Phát hành token' : 'Token launch') })
    return ev.sort((x, y) => x.t - y.t).slice(-14)
  }, [p, vi])

  const copy = (s: string) => {
    navigator.clipboard?.writeText(s).then(() => toast.success(vi ? 'Đã sao chép địa chỉ' : 'Address copied'), () => toast.error(vi ? 'Không sao chép được' : "Couldn't copy"))
  }
  const ask = onAsk ? () => onAsk(vi ? `Phân tích dự án ${name}: sản phẩm, đội ngũ, gọi vốn, token và các rủi ro cần lưu ý.` : `Analyse the ${name} project: product, team, funding, token and key risks.`) : undefined

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="sticky top-0 z-20 -mx-4 mb-5 flex items-center gap-2 border-b border-white/[0.05] bg-[#05060B]/90 px-4 py-2.5 backdrop-blur sm:-mx-5 sm:px-5">
        <button onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.05] hover:text-white">
          <ArrowLeft className="h-4 w-4" />{vi ? 'Tất cả dự án' : 'All projects'}
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold text-zinc-400 sm:text-left">{name}</div>
        {ask && <button onClick={ask} className="hidden min-h-9 items-center gap-1.5 rounded-full border border-white/[0.1] px-3 text-xs font-medium text-zinc-300 transition hover:border-teal-300/30 hover:text-white sm:inline-flex"><Sparkles className="h-3.5 w-3.5 text-teal-300" />{vi ? 'Hỏi Makoto' : 'Ask Makoto'}</button>}
        <button onClick={onSave} aria-pressed={saved} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${saved ? 'border-amber-300/30 bg-amber-300/10 text-amber-100' : 'border-white/[0.1] text-zinc-300 hover:border-white/[0.2]'}`}>
          <Star className={`h-3.5 w-3.5 ${saved ? 'fill-amber-300 text-amber-300' : ''}`} />{saved ? (vi ? 'Đã lưu' : 'Saved') : (vi ? 'Lưu' : 'Save')}
        </button>
      </div>

      {/* Hero */}
      <section className={`${card} mb-4`}>
        <div className="flex items-start gap-4">
          <Logo src={p?.logo || ref.logo} name={name} size={60} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-tight text-white">{name}{symbol && <span className="font-mono text-sm text-zinc-500">${symbol}</span>}</h1>
            {p && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <TgeBadge s={tk ? 'post' : p.tge_status} vi={vi} />
                {p.tags.slice(0, 4).map((t) => <span key={t} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-zinc-400">{t}</span>)}
              </div>
            )}
          </div>
        </div>
        {p && (site || p.x_handle || links.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {site && <LinkChip href={site} icon={Globe} title={vi ? 'Trang chính thức' : 'Official site'}>{siteHost}</LinkChip>}
            {p.x_handle && <LinkChip href={`https://x.com/${p.x_handle}`} icon={Megaphone}>𝕏 @{p.x_handle}{p.x_followers ? <span className="text-zinc-500">· {fmtCount(p.x_followers)}</span> : null}</LinkChip>}
            {links.map((l) => {
              const m = LINK_META[l.kind]
              return m ? <LinkChip key={l.kind} href={l.url} icon={m.icon}>{vi && m.vi ? m.vi : m.label}</LinkChip> : null
            })}
          </div>
        )}
        {summary && (
          <p className="mt-4 rounded-xl bg-white/[0.03] p-3.5 text-[13.5px] leading-relaxed text-zinc-300">
            <span className="mr-1.5 font-semibold text-white">{vi ? 'Tổng quan:' : 'Overview:'}</span>{summary}
          </p>
        )}
        {ask && <button onClick={ask} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-white/[0.1] text-[13px] font-medium text-zinc-200 sm:hidden"><Sparkles className="h-4 w-4 text-teal-300" />{vi ? 'Hỏi Makoto về dự án này' : 'Ask Makoto about this project'}</button>}
      </section>

      {isLoading && <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="mk-skel h-[74px] rounded-2xl" />)}</div>}
      {isError && !data && (
        <div className={`${card} mb-4 text-sm text-zinc-400`}>
          {vi ? 'Chưa tải được hồ sơ dự án này.' : "Couldn't load this project's profile."}
          <button onClick={() => refetch()} className="ml-2 font-medium text-teal-300 hover:underline">{vi ? 'Thử lại' : 'Retry'}</button>
        </div>
      )}

      {p && (
        <>
          {/* Key numbers */}
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Tile icon={Landmark} label={vi ? 'Tổng gọi vốn' : 'Total raised'} value={raise ? fmtUsd(raise, { compact: true }) : (vi ? 'Không công bố' : 'Undisclosed')} sub={p.rounds.length ? (vi ? `${p.rounds.length} vòng` : `${p.rounds.length} rounds`) : undefined} />
            <Tile icon={CalendarClock} label={vi ? 'Vòng gần nhất' : 'Latest round'} value={latest ? (latest.amount ? fmtUsd(latest.amount, { compact: true }) : roundName(latest.name, vi)) : '—'} sub={latest?.date ? daysAgo(latest.date, vi) : undefined} />
            <Tile icon={Users} label={vi ? 'Quỹ đầu tư' : 'Investors'} value={funds.length ? String(funds.length) : '—'} sub={leads.length ? (vi ? `${leads.length} dẫn đầu` : `${leads.length} lead`) : undefined} />
            <Tile icon={Coins} label="Token" value={symbol && (tk || p.tge_status === 'post') ? `$${symbol}` : p.tge_status === 'upcoming' ? (vi ? 'Sắp ra mắt' : 'Soon') : (vi ? 'Chưa có' : 'Not yet')} sub={tk ? fmtUsd(tk.price) : undefined} />
            <Tile icon={Network} label={vi ? 'Mạng' : 'Chains'} value={p.chains.length ? String(p.chains.length) : '—'} sub={p.chains.slice(0, 2).join(', ') || undefined} />
            <Tile icon={Megaphone} label={vi ? 'Người theo dõi X' : 'X followers'} value={fmtCount(p.x_followers)} sub={p.x_handle ? `@${p.x_handle}` : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 space-y-4 lg:col-span-2">
              {/* About */}
              <section className={card}>
                <h2 className={h2}><Info className="h-4 w-4 text-teal-300" />{vi ? 'Giới thiệu' : 'About'}</h2>
                {p.description ? (
                  <>
                    <p className={`text-[13.5px] leading-relaxed text-zinc-300 ${fullDesc ? '' : 'line-clamp-5'}`}>{p.description}</p>
                    {p.description.length > 340 && <button onClick={() => setFullDesc((f) => !f)} className="mt-1 min-h-8 text-[12.5px] font-medium text-teal-300 hover:underline">{fullDesc ? (vi ? 'Thu gọn' : 'Show less') : (vi ? 'Đọc thêm' : 'Read more')}</button>}
                  </>
                ) : <p className="text-[13px] text-zinc-500">{vi ? 'Chưa có mô tả.' : 'No description yet.'}</p>}
                <dl className="mt-3">
                  {p.tags.length > 0 && <Row k={vi ? 'Lĩnh vực' : 'Sector'} v={p.tags.join(', ')} />}
                  {p.chains.length > 0 && <Row k={vi ? 'Mạng' : 'Chains'} v={p.chains.join(', ')} />}
                  {p.exchanges.length > 0 && <Row k={vi ? 'Niêm yết trên' : 'Listed on'} v={p.exchanges.map(title).join(', ')} />}
                  {site && <Row k={vi ? 'Website' : 'Website'} v={<a href={site} target="_blank" rel="noopener noreferrer nofollow" className="text-teal-200 hover:underline">{siteHost}</a>} />}
                </dl>
              </section>

              {/* Team */}
              <section className={card}>
                <h2 className={h2}><Users className="h-4 w-4 text-teal-300" />{vi ? 'Đội ngũ' : 'Team'}</h2>
                {p.team.length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {p.team.map((m) => (
                      <li key={m.name} className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-2.5">
                        <Logo src={m.image} name={m.name} size={34} />
                        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium text-zinc-100">{m.name}</div><div className="truncate text-[11.5px] text-zinc-500">{m.role || '—'}</div></div>
                        {m.x && (
                          <a href={m.x} target="_blank" rel="noopener noreferrer nofollow" title={m.x_status === 'verified' ? (vi ? 'Tiểu sử X của người này có nhắc đến dự án' : 'Their X bio mentions this project') : (vi ? 'Tên trên X khớp với thành viên này' : 'X display name matches this member')} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11.5px] text-zinc-400 hover:bg-white/[0.06] hover:text-white" aria-label={`${m.name} X`}>
                            𝕏{m.x_status === 'verified' && <BadgeCheck className="h-3.5 w-3.5 text-teal-300" />}
                            {m.x_followers ? <span className="hidden text-zinc-500 sm:inline">{fmtCount(m.x_followers)}</span> : null}
                          </a>
                        )}
                        {m.linkedin && <a href={m.linkedin} target="_blank" rel="noopener noreferrer nofollow" className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-zinc-500 hover:bg-white/[0.06] hover:text-white" aria-label={`${m.name} LinkedIn`}>in</a>}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[13px] text-zinc-500">{vi ? 'Chưa có thông tin công khai về đội ngũ.' : 'No public team information.'}</p>}
                {p.team.some((m) => m.x) && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-500">
                    <BadgeCheck className="mt-px h-3.5 w-3.5 shrink-0 text-teal-300" />
                    {vi ? 'Tài khoản X được đối chiếu với hồ sơ X thực tế. Dấu tích nghĩa là tiểu sử của họ có nhắc đến dự án; tài khoản không khớp hoặc đã ngừng hoạt động sẽ được ẩn.' : 'X accounts are checked against the live X profile. A tick means their bio mentions the project; accounts that do not match or no longer exist are hidden.'}
                  </p>
                )}
              </section>

              {/* Timeline */}
              {timeline.length > 0 && (
                <section className={card}>
                  <h2 className={h2}><History className="h-4 w-4 text-teal-300" />{vi ? 'Mốc thời gian' : 'Timeline'}</h2>
                  <ol className="relative ml-1.5 border-l border-white/[0.08]">
                    {timeline.map((e, i) => {
                      const future = e.t * 1000 > Date.now()
                      return (
                        <li key={i} className="relative pb-3 pl-4 last:pb-0">
                          <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[#0b0b13] ${e.kind === 'tge' ? 'bg-violet-400' : 'bg-sky-400'}`} />
                          <div className="text-[11px] text-zinc-500">{fmtDate(e.t, vi)}{future && <span className="ml-1.5 rounded bg-sky-300/10 px-1 text-sky-200">{vi ? 'sắp tới' : 'upcoming'}</span>}</div>
                          <div className="text-[13px] text-zinc-200">{e.label}</div>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              {/* Token */}
              <section className={card}>
                <h2 className={h2}><Coins className="h-4 w-4 text-teal-300" />Token{tk?.symbol ? ` $${tk.symbol}` : ''}</h2>
                {tk ? (
                  <>
                    <div className="flex items-end justify-between">
                      <div className="font-mono text-2xl font-semibold text-white">{fmtUsd(tk.price)}</div>
                      {tk.change_24h != null && <div className={`flex items-center gap-1 text-[13px] font-semibold ${tk.change_24h >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{tk.change_24h >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{fmtPct(tk.change_24h)}<span className="font-normal text-zinc-500">24h</span></div>}
                    </div>
                    <dl className="mt-2">
                      <Row k={vi ? '7 / 30 ngày' : '7 / 30 days'} v={<span><span className={(tk.change_7d || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtPct(tk.change_7d)}</span> / <span className={(tk.change_30d || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtPct(tk.change_30d)}</span></span>} />
                      <Row k={vi ? 'Vốn hóa' : 'Market cap'} v={fmtUsd(tk.market_cap, { compact: true })} />
                      <Row k="FDV" v={fmtUsd(tk.fdv, { compact: true })} hint={vi ? 'Định giá khi toàn bộ token được lưu hành' : 'Fully diluted valuation'} />
                      <Row k={vi ? 'Khối lượng 24h' : '24h volume'} v={fmtUsd(tk.volume_24h, { compact: true })} />
                      <Row k={vi ? 'Đang lưu hành' : 'Circulating'} v={`${fmtSupply(tk.circulating)}${tk.circulating && tk.total_supply ? ` (${Math.round((tk.circulating / tk.total_supply) * 100)}%)` : ''}`} />
                      <Row k={vi ? 'Cao nhất mọi thời đại' : 'All-time high'} v={tk.ath ? <span>{fmtUsd(tk.ath)} <span className="text-zinc-500">· {fmtDate(tk.ath_date, vi)}</span></span> : '—'} />
                      <Row k={vi ? 'Thấp nhất mọi thời đại' : 'All-time low'} v={tk.atl ? <span>{fmtUsd(tk.atl)} <span className="text-zinc-500">· {fmtDate(tk.atl_date, vi)}</span></span> : '—'} />
                    </dl>
                    <p className="mt-2 text-[11px] text-zinc-600">{vi ? 'Giá tham khảo, cập nhật mỗi 10 phút.' : 'Reference price, refreshed every 10 minutes.'}</p>
                  </>
                ) : (
                  <dl>
                    <Row k={vi ? 'Trạng thái' : 'Status'} v={p.tge_status && TGE[p.tge_status] ? (vi ? TGE[p.tge_status].vi : TGE[p.tge_status].en) : (vi ? 'Chưa rõ' : 'Unknown')} />
                    {symbol && <Row k={vi ? 'Mã token' : 'Ticker'} v={`$${symbol}`} />}
                    {p.tge_time ? <Row k={vi ? 'Mốc phát hành' : 'Launch date'} v={fmtDate(p.tge_time, vi)} /> : null}
                  </dl>
                )}
              </section>

              {/* Funding */}
              <section className={card}>
                <h2 className={h2}><Landmark className="h-4 w-4 text-teal-300" />{vi ? 'Gọi vốn & quỹ đầu tư' : 'Funding & investors'}</h2>
                <div className="mb-2 font-mono text-xl font-semibold text-white">{raise ? fmtUsd(raise, { compact: true }) : (vi ? 'Không công bố' : 'Undisclosed')}</div>
                {p.rounds.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {p.rounds.map((r, i) => (
                      <li key={i} className="rounded-xl bg-white/[0.02] p-2.5 text-[12.5px]">
                        <div className="flex justify-between gap-2"><span className="font-medium text-zinc-200">{roundName(r.name, vi)}<span className="font-normal text-zinc-500"> · {fmtDate(r.date, vi)}</span></span><span className="font-mono text-zinc-100">{r.amount ? fmtUsd(r.amount, { compact: true }) : '—'}</span></div>
                        {r.valuation ? <div className="text-[11px] text-zinc-500">{vi ? 'Định giá' : 'Valuation'} {fmtUsd(r.valuation, { compact: true })}</div> : null}
                        {!!r.investors?.length && <div className="mt-0.5 truncate text-[11px] text-zinc-500">{r.investors.map((x) => x.name + (x.lead ? (vi ? ' (dẫn đầu)' : ' (lead)') : '')).join(', ')}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {p.investors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.investors.map((x) => (
                      <span key={x.name} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11.5px] ${x.lead ? 'border-teal-300/25 text-teal-100' : 'border-white/[0.07] text-zinc-300'}`}>
                        {x.logo && <img src={x.logo} alt="" className="h-4 w-4 rounded-full" loading="lazy" />}{x.name}
                        {x.lead && <span className="text-[10px] text-teal-300/80">{vi ? 'dẫn đầu' : 'lead'}</span>}
                        {x.person && <span className="text-[10px] text-zinc-500">{vi ? 'cá nhân' : 'angel'}</span>}
                      </span>
                    ))}
                  </div>
                )}
                {!p.investors.length && !p.rounds.length && <p className="text-[13px] text-zinc-500">{vi ? 'Không có thông tin gọi vốn công khai.' : 'No public funding information.'}</p>}
              </section>

              {/* Contracts */}
              {p.contracts.length > 0 && (
                <section className={card}>
                  <h2 className={h2}><FileCode2 className="h-4 w-4 text-teal-300" />{vi ? 'Hợp đồng chính thức' : 'Official contracts'}</h2>
                  <ul className="space-y-1.5">
                    {p.contracts.map((c) => (
                      <li key={c.chain + c.address} className="flex items-center gap-2 rounded-xl bg-white/[0.02] px-2.5 py-1.5 text-[12px]">
                        <span className="w-20 shrink-0 truncate capitalize text-zinc-500">{c.chain}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-zinc-200" title={c.address}>{c.label ? <span className="mr-1 text-zinc-500">{c.label}</span> : null}{short(c.address)}</span>
                        <button onClick={() => copy(c.address)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-white/[0.06] hover:text-white" aria-label={vi ? 'Sao chép địa chỉ' : 'Copy address'}><Copy className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{vi ? 'Token cùng tên nhưng khác địa chỉ hợp đồng không phải token chính thức.' : 'Same-name tokens at other addresses are not official.'}</p>
                </section>
              )}
            </div>
          </div>
        </>
      )}

      {/* Same backers */}
      {!!data?.related?.length && (
        <section className="mt-6">
          <h2 className={h2}><Layers className="h-4 w-4 text-teal-300" />{vi ? 'Dự án khác cùng quỹ đầu tư' : 'Other projects with the same investors'}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.related.map((r) => (
              <button key={r.id} onClick={() => onOpen(r)} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#0b0b13]/80 p-3 text-left transition hover:border-teal-300/25">
                <Logo src={r.logo} name={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-white">{r.name}</div>
                  <div className="truncate text-[11.5px] text-zinc-500">{vi ? 'Cùng quỹ' : 'Shared'}: {r.shared.join(', ')}</div>
                </div>
                <div className="shrink-0 text-right font-mono text-[13px] font-semibold text-zinc-100">{r.last_raise ? fmtUsd(r.last_raise, { compact: true }) : '—'}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-500">
        {isLoading ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        {vi ? 'Dữ liệu tổng hợp từ các nguồn công khai, có thể chậm hơn thông báo chính thức của dự án. Chỉ mang tính tham khảo, không phải lời khuyên đầu tư.' : 'Aggregated from public sources and may lag official announcements. For reference only, not financial advice.'}
      </p>
    </motion.div>
  )
}
