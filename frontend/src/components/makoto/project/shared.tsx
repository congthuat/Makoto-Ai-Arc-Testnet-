import { useState } from 'react'

export type ProjectCard = {
  id: string; name: string; logo: string | null; symbol: string | null; tags: string[]; chains: string[]; summary: string | null
  total_raise: number | null; last_raise: number | null; raised_at: number | null; backers: string[]; tge_status: string | null
}
export type Social = { url: string; handle: string | null; followers: number | null } | null
export type Project = {
  id: string; name: string; logo: string | null; symbol: string | null
  description: string | null; website: string | null; x_handle: string | null; x_followers: number | null
  socials: { discord: Social; telegram: Social; github: Social }
  links?: { kind: string; url: string }[]
  tags: string[]; chains: string[]; exchanges: string[]; tge_status: string | null; tge_time: number | null; total_raise: number | null
  rounds: { name: string | null; amount: number | null; date: number | null; valuation?: number | null; investors?: { name: string; lead: boolean }[] }[]
  investors: { name: string; logo: string | null; lead: boolean; person?: boolean }[]
  team: { name: string; role: string | null; image: string | null; x: string | null; linkedin: string | null; x_handle?: string; x_followers?: number | null; x_status?: 'verified' | 'matched' | null }[]
  contracts: { chain: string; address: string; label: string | null }[]
}
export type TokenInfo = {
  symbol: string | null; name: string | null; price: number; change_24h: number | null; change_7d: number | null; change_30d: number | null
  market_cap: number | null; fdv: number | null; volume_24h: number | null; circulating: number | null; total_supply: number | null
  ath: number | null; ath_date: number | null; atl: number | null; atl_date: number | null; at: number
}
export type Related = ProjectCard & { shared: string[] }
export type Saved = { key: string; name: string; logo: string | null; created_at: string }
/** Minimal info needed to open a profile (from a list card, a saved row or a chat card). */
export type ProjectRef = { id: string; name: string; logo?: string | null; symbol?: string | null }

export const TGE: Record<string, { vi: string; en: string }> = {
  pre: { vi: 'Chưa phát hành token', en: 'No token yet' },
  upcoming: { vi: 'Sắp phát hành token', en: 'Token launching soon' },
  post: { vi: 'Đã phát hành token', en: 'Token launched' },
}
export const ROUND_VI: Record<string, string> = { Undisclosed: 'Không công bố', 'Pre-Seed': 'Tiền hạt giống', Seed: 'Hạt giống', Strategic: 'Chiến lược', Private: 'Riêng tư', Public: 'Công khai', Ido: 'IDO', Presale: 'Mở bán sớm' }
export const roundName = (n: string | null, vi: boolean) => (n ? (vi ? ROUND_VI[n] || n : n) : '—')

export const daysAgo = (s: number | null | undefined, vi: boolean) => {
  if (!s) return '—'
  const d = Math.max(0, Math.floor((Date.now() - s * 1000) / 86_400_000))
  return d === 0 ? (vi ? 'hôm nay' : 'today') : d < 60 ? (vi ? `${d} ngày trước` : `${d}d ago`) : d < 730 ? (vi ? `${Math.round(d / 30)} tháng trước` : `${Math.round(d / 30)}mo ago`) : (vi ? `${Math.round(d / 365)} năm trước` : `${Math.round(d / 365)}y ago`)
}
export const fmtDate = (s: number | null | undefined, vi: boolean) => (s ? new Date(s * 1000).toLocaleDateString(vi ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'short', year: new Date(s * 1000).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : '—')
export const fmtCount = (n: number | null | undefined) => (n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n))

/** Opens the Projects page on a given profile (used by chat cards). */
export function openProject(p: ProjectRef) {
  try { sessionStorage.setItem('mk:project-open', JSON.stringify(p)) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('mk:view', { detail: 'projects' }))
  setTimeout(() => window.dispatchEvent(new Event('mk:project')), 50)
}

export function Logo({ src, name, size = 40 }: { src: string | null | undefined; name: string; size?: number }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) {
    const h = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 360
    return <span aria-hidden className="grid shrink-0 place-items-center rounded-xl font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(135deg, hsl(${h} 65% 45%), hsl(${(h + 50) % 360} 65% 35%))` }}>{name.charAt(0).toUpperCase()}</span>
  }
  return <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="shrink-0 rounded-xl bg-white/[0.04] object-cover ring-1 ring-white/10" style={{ width: size, height: size }} />
}

export function TgeBadge({ s, vi }: { s: string | null | undefined; vi: boolean }) {
  const m = s ? TGE[s] : null
  if (!m) return null
  const cls = s === 'post' ? 'bg-teal-300/10 text-teal-200' : s === 'upcoming' ? 'bg-sky-300/10 text-sky-200' : 'bg-zinc-400/10 text-zinc-300'
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}>{vi ? m.vi : m.en}</span>
}
