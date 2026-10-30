import { useState } from 'react'
import { BadgeCheck, Check, X, Clock, HelpCircle, Users, Building2, LockOpen, UserRound } from 'lucide-react'
import { fmtNum, fmtUsd } from '@/lib/format'

export type KolInfo = {
  handle: string; name?: string | null; avatar?: string | null; verified?: boolean; followers?: number | null; tracked: boolean
  calls_audited?: number | null; consistency_pct?: number | null; n_holding?: number | null; n_bought_after?: number | null; n_no_position?: number | null; n_sold_before?: number | null; n_opposite?: number | null
  pnl_90d_usd?: number | null; win_rate_pct?: number | null; flags?: string[]
  token?: { symbol: string | null; verdict: string | null; direction?: string | null; n_calls?: number | null; last_call?: string | null } | null
}
export type KolCrowd = { symbol: string; total: number; kols: number; counts: Record<string, number>; samples: { handle: string; verdict: string; direction?: string | null; posted_at?: number | null; url?: string | null }[] }
export type ListingInfo = { symbol: string; claimed: { exchange: string; status: 'listed_spot' | 'perp_only' | 'announced' | 'not_listed' | 'unknown'; spot_pairs: string[]; perp_pairs: string[]; last_event?: { exchange: string; product: string; pair: string; date: string | null } | null }[]; recent_events: { exchange: string; product: string; pair: string; date: string | null; upcoming?: boolean }[] }
export type UnlockInfo = {
  unlocked_now_pct?: number | null; unlock_next_30d_pct?: number | null; unlock_next_90d_pct?: number | null; unlock_next_30d_value_usd?: number | null
  next_30d_value_vs_daily_volume?: number | null; next_cliff?: { date: string; pct_of_supply: number; value_usd: number | null } | null
  biggest_cliff_90d?: { date: string; pct_of_supply: number; value_usd: number | null } | null; sell_pressure?: 'high' | 'medium' | 'low'
}

// Verdict colours: status palette (good / warning / critical / neutral), always paired with an icon + label.
const VERDICTS: Record<string, { vi: string; en: string; bar: string; cls: string }> = {
  holding: { vi: 'Đang giữ', en: 'Holding', bar: 'bg-emerald-400', cls: 'bg-emerald-400/10 text-emerald-300' },
  bought_after: { vi: 'Mua sau khi hô', en: 'Bought after', bar: 'bg-teal-300/70', cls: 'bg-teal-300/10 text-teal-200' },
  no_position: { vi: 'Hô nhưng không giữ', en: 'No position', bar: 'bg-zinc-500', cls: 'bg-white/[0.06] text-zinc-300' },
  sold_before: { vi: 'Đã bán trước', en: 'Sold before', bar: 'bg-rose-400', cls: 'bg-rose-400/10 text-rose-300' },
  opposite_position: { vi: 'Đặt cược ngược', en: 'Bet against', bar: 'bg-amber-400', cls: 'bg-amber-400/10 text-amber-300' },
}
const ORDER = ['holding', 'bought_after', 'no_position', 'opposite_position', 'sold_before']

const card = 'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5'
const title = 'mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-zinc-100'

function Avatar({ src, name }: { src?: string | null; name: string }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-zinc-400"><UserRound className="h-4 w-4" /></span>
  return <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10" loading="lazy" />
}

function KolCard({ k, vi }: { k: KolInfo; vi: boolean }) {
  const tv = k.token?.verdict ? VERDICTS[k.token.verdict] : null
  return (
    <div className={card}>
      <div className={title}><UserRound className="h-4 w-4 text-teal-300" />{vi ? 'KOL có giữ token không?' : 'Does the KOL hold it?'}</div>
      <a href={`https://x.com/${k.handle}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2.5">
        <Avatar src={k.avatar} name={k.handle} />
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate text-sm font-semibold text-white">{k.name || k.handle}{k.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}</div>
          <div className="truncate text-[11.5px] text-zinc-500">@{k.handle}{k.followers ? ` · ${fmtNum(k.followers, 0)} ${vi ? 'người theo dõi' : 'followers'}` : ''}</div>
        </div>
      </a>
      {!k.tracked ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-zinc-400"><HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{vi ? 'Tài khoản này chưa nằm trong danh sách KOL được theo dõi ví, nên chưa đối chiếu được họ có giữ token hay không.' : "We don't track this account's wallets yet, so we can't tell if they hold it."}</p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
            <span className="text-[12px] text-zinc-400">{k.token?.symbol ? `${vi ? 'Với' : 'On'} $${k.token.symbol}` : vi ? 'Với token này' : 'On this token'}</span>
            {tv ? <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${tv.cls}`}>{vi ? tv.vi : tv.en}</span> : <span className="text-[11.5px] text-zinc-500">{vi ? 'Chưa thấy họ hô token này' : 'No call on record'}</span>}
          </div>
          {k.consistency_pct != null && (
            <div className="mt-3">
              <div className="flex justify-between text-[11.5px]"><span className="text-zinc-400">{vi ? 'Nắm giữ token đã quảng bá' : 'Holds what they promote'}</span><span className="font-mono font-semibold text-zinc-100">{k.consistency_pct}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${k.consistency_pct >= 60 ? 'bg-emerald-400' : k.consistency_pct >= 30 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${Math.max(3, k.consistency_pct)}%` }} /></div>
              <div className="mt-1.5 text-[11px] text-zinc-500">
                {vi ? `${k.calls_audited ?? 0} token đã hô · ${k.n_holding ?? 0} đang giữ · ${k.n_no_position ?? 0} không giữ · ${k.n_sold_before ?? 0} bán trước` : `${k.calls_audited ?? 0} tokens called · ${k.n_holding ?? 0} held · ${k.n_no_position ?? 0} no position · ${k.n_sold_before ?? 0} sold before`}
              </div>
            </div>
          )}
          {k.pnl_90d_usd != null && <div className="mt-1.5 text-[11px] text-zinc-500">{vi ? 'Lãi/lỗ 90 ngày:' : '90d PnL:'} <span className={k.pnl_90d_usd >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{k.pnl_90d_usd >= 0 ? '+' : '-'}{fmtUsd(Math.abs(k.pnl_90d_usd), { compact: true })}</span>{k.win_rate_pct != null ? ` · ${vi ? 'tỉ lệ thắng' : 'win rate'} ${k.win_rate_pct}%` : ''}</div>}
        </>
      )}
    </div>
  )
}

function CrowdCard({ c, vi }: { c: KolCrowd; vi: boolean }) {
  const total = ORDER.reduce((s, k) => s + (c.counts[k] || 0), 0) || 1
  const parts = ORDER.filter((k) => c.counts[k])
  return (
    <div className={card}>
      <div className={title}><Users className="h-4 w-4 text-teal-300" />{vi ? `KOL nói gì về $${c.symbol}` : `KOLs on $${c.symbol}`}</div>
      <p className="text-[12.5px] text-zinc-400">{vi ? <><b className="text-zinc-100">{c.total}</b> bài hô từ <b className="text-zinc-100">{c.kols}</b> KOL được theo dõi ví. Họ có giữ token khi hô không?</> : <><b className="text-zinc-100">{c.total}</b> posts from <b className="text-zinc-100">{c.kols}</b> wallet-tracked KOLs. Did they hold it?</>}</p>
      <div className="mt-2.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={parts.map((k) => `${vi ? VERDICTS[k].vi : VERDICTS[k].en} ${c.counts[k]}`).join(', ')}>
        {parts.map((k) => <div key={k} className={`${VERDICTS[k].bar} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(c.counts[k] / total) * 100}%` }} title={`${vi ? VERDICTS[k].vi : VERDICTS[k].en}: ${c.counts[k]}`} />)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {parts.map((k) => (
          <div key={k} className="flex items-center gap-1.5 text-[11.5px]"><span className={`h-2 w-2 shrink-0 rounded-full ${VERDICTS[k].bar}`} /><span className="truncate text-zinc-400">{vi ? VERDICTS[k].vi : VERDICTS[k].en}</span><span className="ml-auto font-mono text-zinc-200">{Math.round((c.counts[k] / total) * 100)}%</span></div>
        ))}
      </div>
      {c.samples.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {c.samples.slice(0, 4).map((s) => (
            <a key={s.handle} href={s.url || `https://x.com/${s.handle}`} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200">
              <span className="truncate">@{s.handle}</span><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${VERDICTS[s.verdict]?.bar || 'bg-zinc-500'}`} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

const LIST_STATUS: Record<string, { vi: string; en: string; cls: string; Icon: typeof Check }> = {
  listed_spot: { vi: 'Đã niêm yết', en: 'Already listed', cls: 'text-emerald-300', Icon: Check },
  announced: { vi: 'Có thông báo chính thức', en: 'Officially announced', cls: 'text-emerald-300', Icon: Check },
  perp_only: { vi: 'Chỉ có hợp đồng tương lai', en: 'Futures only', cls: 'text-amber-300', Icon: Clock },
  not_listed: { vi: 'Chưa niêm yết, chưa có thông báo', en: 'Not listed, no announcement', cls: 'text-rose-300', Icon: X },
  unknown: { vi: 'Không kiểm tra được', en: "Couldn't check", cls: 'text-zinc-400', Icon: HelpCircle },
}
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function ListingCard({ l, vi }: { l: ListingInfo; vi: boolean }) {
  return (
    <div className={card}>
      <div className={title}><Building2 className="h-4 w-4 text-teal-300" />{vi ? 'Niêm yết trên sàn' : 'Exchange listings'}</div>
      {l.claimed.length > 0 ? (
        <ul className="space-y-1.5">
          {l.claimed.map((c) => {
            const s = LIST_STATUS[c.status] || LIST_STATUS.unknown
            return (
              <li key={c.exchange} className="rounded-xl bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-zinc-100">{c.exchange}</span>
                  <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${s.cls}`}><s.Icon className="h-3.5 w-3.5" />{vi ? s.vi : s.en}</span>
                </div>
                {(c.spot_pairs.length > 0 || c.last_event?.date) && (
                  <div className="mt-0.5 truncate text-[11px] text-zinc-500">{[c.spot_pairs.slice(0, 3).join(', '), c.last_event?.date ? `${vi ? 'sự kiện' : 'event'} ${c.last_event.date}` : ''].filter(Boolean).join(' · ')}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : <p className="text-[12.5px] text-zinc-400">{vi ? 'Tin nhắn không nhắc tới sàn cụ thể nào.' : 'The message names no exchange.'}</p>}
      {l.recent_events.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[11px] text-zinc-500">{vi ? 'Niêm yết gần đây (thông báo chính thức)' : 'Recent official listings'}</div>
          <div className="flex flex-wrap gap-1">
            {l.recent_events.slice(0, 6).map((e, i) => <span key={i} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-zinc-400">{titleCase(e.exchange)} {e.product === 'PERP' ? 'Perp' : 'Spot'}{e.date ? ` · ${e.date.slice(5).split('-').reverse().join('/')}/${e.date.slice(2, 4)}` : ''}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

const PRESSURE = { high: { vi: 'Áp lực bán cao', en: 'High sell pressure', cls: 'bg-rose-400/10 text-rose-300' }, medium: { vi: 'Áp lực vừa', en: 'Medium pressure', cls: 'bg-amber-400/10 text-amber-300' }, low: { vi: 'Áp lực thấp', en: 'Low pressure', cls: 'bg-emerald-400/10 text-emerald-300' } }

function UnlockCard({ u, vi }: { u: UnlockInfo; vi: boolean }) {
  const p = PRESSURE[u.sell_pressure || 'low']
  const cliff = u.biggest_cliff_90d
  const fmtD = (d: string) => new Date(d).toLocaleDateString(vi ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'short' })
  return (
    <div className={card}>
      <div className={`${title} justify-between`}><span className="flex items-center gap-1.5"><LockOpen className="h-4 w-4 text-teal-300" />{vi ? 'Lịch xả token' : 'Unlock schedule'}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.cls}`}>{vi ? p.vi : p.en}</span></div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-xl bg-white/[0.03] px-3 py-2"><div className="text-[11px] text-zinc-500">{vi ? '30 ngày tới' : 'Next 30 days'}</div><div className="text-sm font-semibold text-zinc-100">{(u.unlock_next_30d_pct ?? 0).toFixed(2)}%<span className="ml-1 text-[11px] font-normal text-zinc-500">{vi ? 'tổng cung' : 'supply'}</span></div>{u.unlock_next_30d_value_usd ? <div className="text-[11px] text-zinc-400">≈ {fmtUsd(u.unlock_next_30d_value_usd, { compact: true })}</div> : null}</div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2"><div className="text-[11px] text-zinc-500">{vi ? 'Đã mở khóa' : 'Unlocked'}</div><div className="text-sm font-semibold text-zinc-100">{(u.unlocked_now_pct ?? 0).toFixed(1)}%</div><div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-teal-300/80" style={{ width: `${Math.min(100, u.unlocked_now_pct ?? 0)}%` }} /></div></div>
      </div>
      {u.next_30d_value_vs_daily_volume != null && u.next_30d_value_vs_daily_volume > 0.05 && (
        <p className="mt-2 text-[11.5px] text-zinc-400">{vi ? `Lượng xả 30 ngày ≈ ${u.next_30d_value_vs_daily_volume < 1 ? `${Math.round(u.next_30d_value_vs_daily_volume * 100)}%` : `${u.next_30d_value_vs_daily_volume.toFixed(1)} lần`} khối lượng giao dịch 1 ngày.` : `30-day unlocks ≈ ${u.next_30d_value_vs_daily_volume < 1 ? `${Math.round(u.next_30d_value_vs_daily_volume * 100)}%` : `${u.next_30d_value_vs_daily_volume.toFixed(1)}×`} of one day's volume.`}</p>
      )}
      {cliff ? (
        <p className="mt-1.5 text-[11.5px] text-zinc-400">{vi ? 'Đợt mở khóa lớn nhất 90 ngày tới:' : 'Biggest unlock in 90 days:'} <b className="text-zinc-200">{fmtD(cliff.date)}</b> · {cliff.pct_of_supply.toFixed(2)}%{cliff.value_usd ? ` (≈ ${fmtUsd(cliff.value_usd, { compact: true })})` : ''}</p>
      ) : <p className="mt-1.5 text-[11.5px] text-zinc-500">{vi ? 'Không có đợt mở khóa lớn trong 90 ngày tới.' : 'No big one-day unlock in the next 90 days.'}</p>}
    </div>
  )
}

export function DeepChecks({ ev, vi }: { ev: { kol?: KolInfo | null; kol_crowd?: KolCrowd | null; listing?: ListingInfo | null; unlocks?: UnlockInfo | null }; vi: boolean }) {
  const u = ev.unlocks && ev.unlocks.sell_pressure ? ev.unlocks : null
  const crowd = ev.kol_crowd && ev.kol_crowd.total >= 3 ? ev.kol_crowd : null
  const listing = ev.listing && (ev.listing.claimed?.length || ev.listing.recent_events?.length) ? ev.listing : null
  if (!ev.kol && !crowd && !listing && !u) return null
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {ev.kol && <KolCard k={ev.kol} vi={vi} />}
      {crowd && <CrowdCard c={crowd} vi={vi} />}
      {listing && <ListingCard l={listing} vi={vi} />}
      {u && <UnlockCard u={u} vi={vi} />}
    </div>
  )
}

