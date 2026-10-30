import { useState } from 'react'
import { motion } from 'motion/react'
import { Scale, ScanSearch, TrendingUp, TrendingDown, AlertOctagon, Check, X, AlertTriangle, HelpCircle, ShieldCheck, ShieldAlert, ShieldX, Shield, Copy, MessageSquareText, ChevronDown, ExternalLink, Flag, ThumbsUp, Lightbulb, Siren, Radar } from 'lucide-react'
import { toast } from 'sonner'
import { fmtNum, fmtUsd, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { shortAddr } from '@/lib/wallet'
import { DeepChecks, type KolInfo, type KolCrowd, type ListingInfo, type UnlockInfo } from './DeepChecks'

export type Verdict = 'trusted' | 'caution' | 'risky' | 'danger' | 'unknown'
export type ClaimStatus = 'true' | 'false' | 'misleading' | 'unverifiable'

export type Evidence = {
  project?: { name?: string; symbol?: string | null; logo?: string | null; description?: string; tags?: string[]; website?: string | null; x_handle?: string | null; x_followers?: number | null; exchanges?: string[]; tge_status?: string | null; chains?: string[] } | null
  market?: { price?: number | null; market_cap?: number | null; fdv?: number | null; volume_24h?: number | null; change_24h?: number | null; change_7d?: number | null; change_30d?: number | null; ath?: number | null; from_ath_pct?: number | null; circ_ratio_pct?: number | null } | null
  funding?: { rounds?: number; total_usd?: number | null; investors?: string[]; all_investors?: string[] } | null
  team?: { name: string; role?: string | null }[]
  contract?: { address: string; chain?: string | null } | null
  dex?: { chain?: string; price?: number | null; age_days?: number | null; from_peak_pct?: number | null; change_7d_pct?: number | null; avg_volume_7d?: number | null; spark?: [number, number | null][] } | null
  holders?: { top10_pct?: number | null; top10_private_pct?: number | null; labels_available?: boolean; largest_private_pct?: number | null; top?: { address: string; pct: number | null; label?: string | null; type?: string | null }[] } | null
  transfers?: { transfers_7d?: number | null; unique_senders_7d?: number | null; unique_receivers_7d?: number | null; volume_usd_7d?: number | null } | null
  unlocks?: UnlockInfo | null
  kol?: KolInfo | null
  kol_crowd?: KolCrowd | null
  listing?: ListingInfo | null
  security?: { chain?: string; source?: string; honeypot?: boolean | null; buy_tax_pct?: number | null; sell_tax_pct?: number | null; ownerless?: boolean; holder_count?: number | null; checks?: { key: string; ok: boolean; severity: 'none' | 'low' | 'medium' | 'high'; vi: string; en: string }[] } | null
  news?: { title?: string; source?: string | null; url?: string | null; published_at?: number | string | null }[]
  page?: { url: string; title?: string | null } | null
}

type Side = { points: { point: string; evidence?: string }[]; score: number }

export type Check = {
  id?: number
  input?: string
  score: number
  verdict: Verdict
  headline?: string
  summary?: string
  claims?: { claim: string; status: ClaimStatus; evidence?: string }[]
  red_flags?: { title: string; detail?: string; severity?: 'high' | 'medium' | 'low' }[]
  green_flags?: { title: string; detail?: string }[]
  advice?: string[]
  ask?: string[]
  tactics?: string[]
  debate?: { bull?: Side | null; bear?: Side | null } | null
  asks_money?: boolean
  token?: { name?: string | null; symbol?: string | null; logo?: string | null; address?: string } | null
  evidence?: Evidence
  checked_at?: string
  created_at?: string
}

/* ---------- Verdict meta ---------- */

export const VERDICT: Record<Verdict, { vi: string; en: string; text: string; bg: string; ring: string; stroke: string; Icon: typeof Shield }> = {
  trusted: { vi: 'Đáng tin', en: 'Trustworthy', text: 'text-emerald-300', bg: 'bg-emerald-400/10', ring: 'border-emerald-300/25', stroke: 'var(--color-emerald-400)', Icon: ShieldCheck },
  caution: { vi: 'Cần thận trọng', en: 'Be careful', text: 'text-amber-300', bg: 'bg-amber-400/10', ring: 'border-amber-300/25', stroke: 'var(--color-amber-400)', Icon: Shield },
  risky: { vi: 'Rủi ro cao', en: 'High risk', text: 'text-rose-300', bg: 'bg-rose-400/10', ring: 'border-rose-300/25', stroke: 'var(--color-rose-400)', Icon: ShieldAlert },
  danger: { vi: 'Nguy hiểm', en: 'Dangerous', text: 'text-rose-300', bg: 'bg-rose-500/15', ring: 'border-rose-400/40', stroke: 'var(--color-rose-500)', Icon: ShieldX },
  unknown: { vi: 'Chưa đủ dữ liệu', en: 'Not enough data', text: 'text-zinc-300', bg: 'bg-white/[0.05]', ring: 'border-white/10', stroke: 'var(--color-zinc-500)', Icon: HelpCircle },
}

const CLAIM: Record<ClaimStatus, { vi: string; en: string; cls: string; Icon: typeof Check }> = {
  true: { vi: 'Đúng', en: 'True', cls: 'text-emerald-300 bg-emerald-400/10', Icon: Check },
  false: { vi: 'Sai', en: 'False', cls: 'text-rose-300 bg-rose-400/10', Icon: X },
  misleading: { vi: 'Gây hiểu lầm', en: 'Misleading', cls: 'text-amber-300 bg-amber-400/10', Icon: AlertTriangle },
  unverifiable: { vi: 'Chưa kiểm chứng được', en: 'Unverifiable', cls: 'text-zinc-300 bg-white/[0.06]', Icon: HelpCircle },
}

/* ---------- Pieces ---------- */

export function ScoreGauge({ score, verdict, size = 148 }: { score: number; verdict: Verdict; size?: number }) {
  const v = VERDICT[verdict] || VERDICT.unknown
  const r = 52
  const len = Math.PI * r
  const pct = verdict === 'unknown' ? 0 : Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="relative" style={{ width: size, height: size * 0.62 }}>
      <svg viewBox="0 0 128 76" className="h-full w-full overflow-visible" aria-hidden>
        <path d="M 12 68 A 52 52 0 0 1 116 68" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: 'var(--color-white)', strokeOpacity: 0.08 }} />
        <motion.path
          d="M 12 68 A 52 52 0 0 1 116 68"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          style={{ stroke: v.stroke }}
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center leading-none">
        <span className={`text-[34px] font-semibold tabular-nums tracking-tight ${v.text}`}>{verdict === 'unknown' ? '?' : score}</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">/ 100</span>
      </div>
    </div>
  )
}

export function VerdictBadge({ verdict, small = false }: { verdict: Verdict; small?: boolean }) {
  const { lang } = useI18n()
  const v = VERDICT[verdict] || VERDICT.unknown
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${v.ring} ${v.bg} ${v.text} font-semibold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}>
      <v.Icon className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />{lang === 'vi' ? v.vi : v.en}
    </span>
  )
}

function Spark({ pts }: { pts: [number, number | null][] }) {
  const vals = pts.map((p) => p[1]).filter((x): x is number => typeof x === 'number')
  if (vals.length < 3) return null
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const w = 120
  const h = 32
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * h).toFixed(1)}`).join(' ')
  const up = vals[vals.length - 1] >= vals[0]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-28" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" strokeWidth="1.6" strokeLinejoin="round" style={{ stroke: up ? 'var(--color-emerald-400)' : 'var(--color-rose-400)' }} />
    </svg>
  )
}

const sevRank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 }

type Tone = 'good' | 'warn' | 'bad' | 'neutral'
const toneCls: Record<Tone, string> = { good: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-rose-300', neutral: 'text-zinc-100' }

function facts(ev: Evidence, vi: boolean) {
  const out: { k: string; v: string; sub?: string; tone: Tone; tip?: string }[] = []
  const m = ev.market
  const d = ev.dex
  const price = m?.price ?? d?.price
  if (price != null) out.push({ k: vi ? 'Giá' : 'Price', v: fmtUsd(price), sub: m?.change_7d != null ? `${m.change_7d >= 0 ? '+' : ''}${m.change_7d.toFixed(1)}% ${vi ? '7 ngày' : '7d'}` : d?.change_7d_pct != null ? `${d.change_7d_pct >= 0 ? '+' : ''}${d.change_7d_pct.toFixed(1)}% ${vi ? '7 ngày' : '7d'}` : undefined, tone: 'neutral' })
  if (m?.market_cap) out.push({ k: vi ? 'Vốn hóa' : 'Market cap', v: fmtUsd(m.market_cap, { compact: true }), tone: m.market_cap < 5e6 ? 'bad' : m.market_cap < 5e7 ? 'warn' : 'neutral', tip: vi ? 'Tổng giá trị token đang lưu hành. Càng nhỏ càng dễ bị làm giá.' : 'Value of circulating tokens. Smaller = easier to manipulate.' })
  const vol = m?.volume_24h ?? (d?.avg_volume_7d ?? null)
  if (vol != null) out.push({ k: m?.volume_24h != null ? (vi ? 'Khối lượng 24h' : '24h volume') : vi ? 'KL trung bình/ngày' : 'Avg daily volume', v: fmtUsd(vol, { compact: true }), tone: vol < 50_000 ? 'bad' : vol < 500_000 ? 'warn' : 'neutral', tip: vi ? 'Khối lượng thấp = khó bán ra khi cần.' : 'Low volume = hard to sell when you need to.' })
  const fromPeak = m?.from_ath_pct ?? d?.from_peak_pct
  if (fromPeak != null) out.push({ k: vi ? 'So với đỉnh' : 'From peak', v: `${fromPeak.toFixed(0)}%`, tone: fromPeak < -85 ? 'bad' : fromPeak < -60 ? 'warn' : 'neutral' })
  if (d?.age_days != null) out.push({ k: vi ? 'Tuổi token' : 'Token age', v: d.age_days >= 365 ? `${(d.age_days / 365).toFixed(1)} ${vi ? 'năm' : 'yrs'}` : `${d.age_days} ${vi ? 'ngày' : 'days'}`, tone: d.age_days < 30 ? 'bad' : d.age_days < 180 ? 'warn' : 'good', tip: vi ? 'Tính từ lần giao dịch đầu tiên trên sàn phi tập trung.' : 'Since the first DEX trade.' })
  const h = ev.holders
  if (h && (h.top10_private_pct ?? h.top10_pct) != null) {
    const p = (h.top10_private_pct ?? h.top10_pct) as number
    out.push({ k: vi ? '10 ví lớn nhất nắm' : 'Top 10 wallets hold', v: `${p.toFixed(1)}%`, sub: h.top10_private_pct != null ? (vi ? 'không tính ví sàn' : 'excl. exchanges') : vi ? 'có thể gồm ví sàn' : 'may include exchanges', tone: p > 40 ? 'bad' : p > 20 ? 'warn' : 'good', tip: vi ? 'Ví lớn nắm càng nhiều, càng dễ xả hàng làm sập giá.' : 'The more big wallets hold, the easier a dump.' })
  }
  const u = ev.unlocks
  if (u?.unlock_next_90d_pct != null) out.push({ k: vi ? 'Mở khóa 90 ngày tới' : 'Unlocks next 90d', v: `${u.unlock_next_90d_pct.toFixed(1)}%`, sub: vi ? 'tổng cung' : 'of supply', tone: u.unlock_next_90d_pct > 5 ? 'bad' : u.unlock_next_90d_pct > 1 ? 'warn' : 'good', tip: vi ? 'Token mới được mở khóa thường bị bán ra, tạo áp lực giảm giá.' : 'Newly unlocked tokens are often sold.' })
  const f = ev.funding
  if (f?.total_usd) out.push({ k: vi ? 'Đã gọi vốn' : 'Raised', v: fmtUsd(f.total_usd, { compact: true }), sub: f.investors?.slice(0, 2).join(', ') || undefined, tone: 'good' })
  const ex = ev.project?.exchanges || []
  if (ev.project) out.push({ k: vi ? 'Sàn niêm yết' : 'Listed on', v: ex.length ? String(ex.length) : '0', sub: ex.slice(0, 3).map((x) => x.charAt(0) + x.slice(1).toLowerCase()).join(', ') || undefined, tone: ex.length >= 3 ? 'good' : ex.length ? 'neutral' : 'warn', tip: ex.length ? ex.join(', ') : undefined })
  if (ev.project?.x_followers) out.push({ k: vi ? 'Người theo dõi X' : 'X followers', v: fmtNum(ev.project.x_followers, 0), tone: 'neutral' })
  if (ev.transfers?.unique_receivers_7d != null) out.push({ k: vi ? 'Ví nhận token (7 ngày)' : 'Receiving wallets (7d)', v: fmtNum(ev.transfers.unique_receivers_7d, 0), tone: ev.transfers.unique_receivers_7d < 50 ? 'warn' : 'neutral' })
  return out
}

function Section({ icon: Icon, title, children, tone = 'text-zinc-400' }: { icon: typeof Flag; title: string; children: React.ReactNode; tone?: string }) {
  return (
    <section>
      <h3 className={`mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone}`}><Icon className="h-3.5 w-3.5" />{title}</h3>
      {children}
    </section>
  )
}

function shareText(c: Check, vi: boolean) {
  const v = VERDICT[c.verdict] || VERDICT.unknown
  const lines = [
    `🛡️ Makoto ${vi ? 'xác minh' : 'verification'}${c.token?.symbol ? ` · $${c.token.symbol}` : ''}`,
    `${vi ? 'Điểm tin cậy' : 'Trust score'}: ${c.verdict === 'unknown' ? '?' : c.score}/100 — ${vi ? v.vi : v.en}`,
    c.headline || '',
    ...(c.red_flags || []).slice(0, 3).map((f) => `⚠️ ${f.title}`),
    ...(c.claims || []).filter((x) => x.status !== 'true').slice(0, 3).map((x) => `❌ "${x.claim}" → ${vi ? (CLAIM[x.status] || CLAIM.unverifiable).vi : (CLAIM[x.status] || CLAIM.unverifiable).en}`),
  ]
  return lines.filter(Boolean).join('\n')
}

/* ---------- Report ---------- */

export function VerdictReport({ c, compact = false, onAsk }: { c: Check; compact?: boolean; onAsk?: (text: string) => void }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const [open, setOpen] = useState(!compact)
  const [holdersOpen, setHoldersOpen] = useState(false)
  const v = VERDICT[c.verdict] || VERDICT.unknown
  const ev = c.evidence || {}
  const fs = facts(ev, vi)
  const tokenName = c.token?.name || c.token?.symbol || (c.token?.address ? shortAddr(c.token.address) : null)
  const holders = (ev.holders?.top || []).filter((h) => h.pct != null)
  const reds = c.red_flags || []
  const greens = c.green_flags || []

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(msg) } catch { toast.error(vi ? 'Không sao chép được' : 'Copy failed') }
  }

  return (
    <div className={`overflow-hidden rounded-3xl border ${v.ring} bg-[#0b0b13]/80`}>
      {/* Hero */}
      <div className="relative px-5 pb-5 pt-5 sm:px-6">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60" style={{ background: `radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, ${v.stroke} 22%, transparent), transparent)` }} />
        <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <ScoreGauge score={c.score} verdict={c.verdict} size={compact ? 128 : 148} />
            <VerdictBadge verdict={c.verdict} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            {tokenName && (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3 text-xs text-zinc-300">
                {c.token?.logo ? <img src={c.token.logo} alt="" className="h-5 w-5 rounded-full" loading="lazy" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold">{(c.token?.symbol || '?').slice(0, 2)}</span>}
                <span className="truncate font-medium">{tokenName}</span>
                {c.token?.symbol && tokenName !== c.token.symbol && <span className="text-zinc-500">${c.token.symbol}</span>}
              </div>
            )}
            <h2 className={`font-semibold tracking-tight text-white ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}>{c.headline || (vi ? 'Kết quả kiểm tra' : 'Check result')}</h2>
            {c.summary && <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.summary}</p>}
          </div>
        </div>

        {c.asks_money && (
          <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-sm text-rose-100">
            <Siren className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <div><b className="text-rose-200">{vi ? 'Tin nhắn này đòi bạn chuyển tiền hoặc thông tin ví.' : 'This message asks you to send money or wallet details.'}</b> {vi ? 'Đây là dấu hiệu lừa đảo phổ biến nhất. Không chuyển tiền, không gửi cụm từ khôi phục (seed phrase) cho bất kỳ ai.' : 'This is the most common scam pattern. Never send funds or your seed phrase to anyone.'}</div>
          </div>
        )}
        {!!c.tactics?.length && (
          <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-zinc-500">{vi ? 'Chiêu thao túng phát hiện:' : 'Pressure tactics:'}</span>
            {c.tactics.map((t, i) => <span key={i} className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2 py-0.5 text-[11.5px] text-amber-200">{t}</span>)}
          </div>
        )}
      </div>

      <div className="space-y-6 border-t border-white/[0.06] px-5 py-5 sm:px-6">
        {/* Contract scan */}
        {!!ev.security?.checks?.length && (
          <Section icon={ScanSearch} title={vi ? 'Soi hợp đồng token' : 'Contract scan'}>
            {ev.security.honeypot && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm font-medium text-rose-100">
                <Siren className="h-4 w-4 shrink-0 text-rose-300" />{vi ? 'BẪY: mua vào sẽ không bán ra được. Tuyệt đối không mua.' : 'TRAP: you will not be able to sell. Do not buy.'}
              </div>
            )}
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {[...ev.security.checks].sort((a, b) => Number(a.ok) - Number(b.ok) || sevRank[b.severity] - sevRank[a.severity]).map((ck) => (
                <li key={ck.key} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] ${ck.ok ? 'border-white/[0.05] bg-white/[0.015] text-zinc-300' : ck.severity === 'high' ? 'border-rose-400/25 bg-rose-400/[0.06] text-rose-100' : ck.severity === 'medium' ? 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100' : 'border-white/[0.06] bg-white/[0.02] text-zinc-300'}`}>
                  {ck.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : ck.severity === 'high' ? <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" /> : <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${ck.severity === 'medium' ? 'text-amber-300' : 'text-zinc-500'}`} />}
                  <span>{vi ? ck.vi : ck.en}</span>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 text-[11px] text-zinc-600">{vi ? 'Nguồn' : 'Source'}: {ev.security.source || 'GoPlus Security'}{ev.security.chain ? ` · ${ev.security.chain}` : ''}{ev.security.holder_count ? ` · ${fmtNum(ev.security.holder_count, 0)} ${vi ? 'ví đang giữ' : 'holders'}` : ''}</div>
          </Section>
        )}

        {/* Debate */}
        {c.debate && (c.debate.bull?.points?.length || c.debate.bear?.points?.length) ? (
          <Section icon={Scale} title={vi ? 'Hai phe tranh luận' : 'Both sides'}>
            <div className="grid gap-2 md:grid-cols-2">
              {([['bull', c.debate.bull], ['bear', c.debate.bear]] as const).map(([k, sd]) => sd?.points?.length ? (
                <div key={k} className={`rounded-2xl border p-3 ${k === 'bull' ? 'border-emerald-300/15 bg-emerald-400/[0.03]' : 'border-rose-300/15 bg-rose-400/[0.03]'}`}>
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                    {k === 'bull' ? <TrendingUp className="h-4 w-4 text-emerald-300" /> : <TrendingDown className="h-4 w-4 text-rose-300" />}
                    <span className={k === 'bull' ? 'text-emerald-200' : 'text-rose-200'}>{k === 'bull' ? (vi ? 'Góc nhìn ủng hộ' : 'The case for') : vi ? 'Góc nhìn phản biện' : 'The case against'}</span>
                    <span className="ml-auto text-[11px] font-normal text-zinc-500" title={vi ? 'Điểm mà phe này tự chấm' : 'Score this side would give'}>{sd.score}/100</span>
                  </div>
                  <ul className="space-y-2">
                    {sd.points.map((pt, i) => (
                      <li key={i} className="text-[13px]">
                        <div className="font-medium text-zinc-100">{pt.point}</div>
                        {pt.evidence && <div className="leading-relaxed text-zinc-500">{pt.evidence}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null)}
            </div>
            <div className="mt-1.5 text-[11px] text-zinc-600">{vi ? 'Makoto đóng vai trọng tài: cân nhắc cả hai phe, bỏ ý không có số liệu, rồi mới chấm điểm.' : 'Makoto acts as referee: weighs both sides, drops unsupported points, then scores.'}</div>
          </Section>
        ) : null}

        {/* Claims */}
        {!!c.claims?.length && (
          <Section icon={MessageSquareText} title={vi ? 'Kiểm chứng từng nhận định' : 'Claim by claim'}>
            <ul className="space-y-2">
              {c.claims.map((cl, i) => {
                const s = CLAIM[cl.status] || CLAIM.unverifiable
                return (
                  <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.35 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}><s.Icon className="h-3 w-3" />{vi ? s.vi : s.en}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100">“{cl.claim}”</div>
                        {cl.evidence && <div className="mt-1 text-[13px] leading-relaxed text-zinc-400">{cl.evidence}</div>}
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </ul>
          </Section>
        )}

        {/* KOL wallets, real listings, unlock schedule */}
        {(ev.kol || ev.kol_crowd || ev.listing || ev.unlocks?.sell_pressure) && (
          <Section icon={Radar} title={vi ? 'Đối chiếu ví KOL, sàn & lịch xả' : 'KOL wallets, listings & unlocks'}>
            <DeepChecks ev={ev} vi={vi} />
          </Section>
        )}

        {/* Flags */}
        {(reds.length > 0 || greens.length > 0) && (
          <div className="grid gap-5 md:grid-cols-2">
            {reds.length > 0 && (
              <Section icon={Flag} title={vi ? 'Dấu hiệu đáng lo' : 'Red flags'} tone="text-rose-300/90">
                <ul className="space-y-2">
                  {reds.map((f, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.severity === 'high' ? 'bg-rose-400' : f.severity === 'low' ? 'bg-zinc-500' : 'bg-amber-400'}`} title={f.severity === 'high' ? (vi ? 'Nghiêm trọng' : 'Severe') : f.severity === 'low' ? (vi ? 'Nhẹ' : 'Minor') : vi ? 'Đáng chú ý' : 'Notable'} />
                      <div><div className="font-medium text-zinc-100">{f.title}</div>{f.detail && <div className="text-[13px] leading-relaxed text-zinc-400">{f.detail}</div>}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {greens.length > 0 && (
              <Section icon={ThumbsUp} title={vi ? 'Điểm cộng' : 'Green flags'} tone="text-emerald-300/90">
                <ul className="space-y-2">
                  {greens.map((f, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <div><div className="font-medium text-zinc-100">{f.title}</div>{f.detail && <div className="text-[13px] leading-relaxed text-zinc-400">{f.detail}</div>}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}

        {compact && !open && (
          <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
            {vi ? 'Xem số liệu & lời khuyên' : 'Show data & advice'}<ChevronDown className="h-4 w-4" />
          </button>
        )}

        {open && (
          <>
            {/* Facts */}
            {fs.length > 0 && (
              <Section icon={ShieldCheck} title={vi ? 'Số liệu thật đã kiểm tra' : 'Verified data'}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {fs.map((f) => (
                    <div key={f.k} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5" title={f.tip}>
                      <div className="text-[11px] text-zinc-500">{f.k}</div>
                      <div className={`mt-0.5 text-base font-semibold tabular-nums ${toneCls[f.tone]}`}>{f.v}</div>
                      {f.sub && <div className="truncate text-[11px] text-zinc-500">{f.sub}</div>}
                    </div>
                  ))}
                </div>
                {ev.dex?.spark && ev.dex.spark.length > 3 && (
                  <div className="mt-2 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="text-[11px] text-zinc-500">{vi ? 'Giá 60 ngày gần nhất' : 'Price, last 60 days'}{ev.dex.chain ? ` · ${ev.dex.chain}` : ''}</span>
                    <Spark pts={ev.dex.spark} />
                  </div>
                )}
                {holders.length > 2 && (
                  <div className="mt-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <button type="button" onClick={() => setHoldersOpen((o) => !o)} aria-expanded={holdersOpen} className="block w-full py-1 text-left">
                      <div className="mb-2 flex items-center gap-1 text-[11px] text-zinc-500">{vi ? 'Các ví nắm nhiều nhất (chạm hoặc rê chuột để xem)' : 'Largest holders (tap or hover for details)'}<ChevronDown className={`h-3 w-3 transition-transform ${holdersOpen ? 'rotate-180' : ''}`} /></div>
                      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/[0.05]">
                        {holders.map((hd, i) => {
                          const infra = /cex|dex|exchange|bridge|contract|protocol|pool|vault|staking/i.test(`${hd.type || ''} ${hd.label || ''}`)
                          return <div key={i} className={`h-full ${infra ? 'bg-sky-400/60' : i === 0 ? 'bg-rose-400' : 'bg-rose-400/60'}`} style={{ width: `${Math.max(hd.pct || 0, 0.6)}%` }} title={`${hd.label || shortAddr(hd.address)} · ${(hd.pct || 0).toFixed(2)}%`} />
                        })}
                      </div>
                    </button>
                    {holdersOpen && (
                      <ul className="mt-2 space-y-1 text-[11px] text-zinc-400">
                        {holders.map((hd, i) => (
                          <li key={i} className="flex justify-between gap-3"><span className="truncate">{hd.label || shortAddr(hd.address)}</span><span className="shrink-0 tabular-nums text-zinc-300">{(hd.pct || 0).toFixed(2)}%</span></li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1.5 flex gap-3 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400/70" />{vi ? 'Ví cá nhân / chưa rõ' : 'Private / unknown'}</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400/60" />{vi ? 'Sàn / hợp đồng' : 'Exchange / contract'}</span>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Advice + questions */}
            {(!!c.advice?.length || !!c.ask?.length) && (
              <div className="grid gap-5 md:grid-cols-2">
                {!!c.advice?.length && (
                  <Section icon={Lightbulb} title={vi ? 'Nên làm gì' : 'What to do'}>
                    <ol className="space-y-1.5 text-sm text-zinc-300">
                      {c.advice.map((a, i) => <li key={i} className="flex gap-2"><span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-zinc-400">{i + 1}</span><span>{a}</span></li>)}
                    </ol>
                  </Section>
                )}
                {!!c.ask?.length && (
                  <Section icon={AlertOctagon} title={vi ? 'Câu hỏi cần làm rõ với nguồn tin' : 'Questions for the source'}>
                    <ul className="space-y-1.5">
                      {c.ask.map((q, i) => (
                        <li key={i}>
                          <button onClick={() => copy(q, vi ? 'Đã sao chép câu hỏi' : 'Question copied')} className="group flex w-full items-start gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-left text-sm text-zinc-200 transition hover:border-white/[0.14] hover:bg-white/[0.03]" title={vi ? 'Bấm để sao chép' : 'Click to copy'}>
                            <span className="flex-1">{q}</span><Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:text-zinc-300" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            )}

            {/* Sources */}
            {(!!ev.news?.length || ev.project?.website || ev.contract) && (
              <Section icon={ExternalLink} title={vi ? 'Nguồn tham khảo' : 'Sources'}>
                <div className="flex flex-wrap gap-1.5">
                  {ev.project?.website && <a href={ev.project.website} target="_blank" rel="noreferrer" className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-zinc-300 transition hover:text-white">{vi ? 'Website dự án' : 'Website'} ↗</a>}
                  {ev.project?.x_handle && <a href={`https://x.com/${ev.project.x_handle}`} target="_blank" rel="noreferrer" className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-zinc-300 transition hover:text-white">X @{ev.project.x_handle} ↗</a>}
                  {ev.contract && <span className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-xs text-zinc-400" title={ev.contract.address}>{ev.contract.chain ? `${ev.contract.chain} · ` : ''}{shortAddr(ev.contract.address)}</span>}
                </div>
                {!!ev.news?.length && (
                  <ul className="mt-2 divide-y divide-white/[0.04] rounded-2xl border border-white/[0.06]">
                    {ev.news.slice(0, 4).map((n, i) => (
                      <li key={i}>
                        <a href={n.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-300 transition hover:bg-white/[0.03] hover:text-white">
                          <span className="min-w-0 flex-1 truncate">{n.title}</span>
                          <span className="shrink-0 text-[11px] text-zinc-600">{n.source}{n.published_at ? ` · ${timeAgo(n.published_at, vi ? 'vi' : 'en')}` : ''}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-4">
          <button onClick={() => copy(shareText(c, vi), vi ? 'Đã sao chép tóm tắt — dán vào nhóm để cảnh báo mọi người' : 'Summary copied')} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition hover:shadow-[0_0_24px_rgba(94,234,212,.35)]">
            <Copy className="h-3.5 w-3.5" />{vi ? 'Sao chép để gửi nhóm' : 'Copy to share'}
          </button>
          {onAsk && (
            <button onClick={() => onAsk(vi ? `Phân tích sâu hơn giúp mình về ${c.token?.symbol ? '$' + c.token.symbol : 'tín hiệu này'}: ${c.headline || ''}` : `Dig deeper into ${c.token?.symbol ? '$' + c.token.symbol : 'this signal'}: ${c.headline || ''}`)} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.05]">
              <MessageSquareText className="h-3.5 w-3.5" />{vi ? 'Hỏi Makoto thêm' : 'Ask Makoto more'}
            </button>
          )}
          <span className="ml-auto text-[11px] text-zinc-600">{vi ? 'Không phải lời khuyên đầu tư' : 'Not financial advice'}{c.checked_at ? ` · ${timeAgo(c.checked_at, vi ? 'vi' : 'en')}` : ''}</span>
        </div>
      </div>
    </div>
  )
}
