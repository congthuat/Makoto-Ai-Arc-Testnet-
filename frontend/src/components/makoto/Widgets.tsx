import ReactECharts from 'echarts-for-react'
import { motion } from 'motion/react'
import { VerdictReport, type Check } from './verify/Report'
import { ExternalLink, Newspaper, Globe, Blocks, Wallet, Receipt, Building2, ArrowRight } from 'lucide-react'
import { fmtNum, fmtPct, fmtUsd, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { shortAddr, ARC } from '@/lib/wallet'
import { usePalette, chartPalette } from '@/lib/theme'
import { Logo, openProject } from './project/shared'
import { fgLabel } from './chat/Home'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Widget = { type: string; [k: string]: any }

const card = 'rounded-2xl border border-white/[0.07] bg-[#0b0b13]/80 backdrop-blur'
type Pal = ReturnType<typeof chartPalette>

function tooltipBase(P: Pal) {
  return {
    trigger: 'axis' as const,
    backgroundColor: P.tipBg,
    borderColor: P.tipBorder,
    padding: [8, 10],
    textStyle: { color: P.text, fontSize: 12 },
    axisPointer: { type: 'line' as const, lineStyle: { color: P.crosshair, type: 'dashed' as const } },
  }
}

function PriceChart({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const P = usePalette()
  const pts: [number, number][] = w.points || []
  const s = w.summary || {}
  const up = (s.change_pct ?? 0) >= 0
  const color = up ? P.up : P.down
  const vi = lang === 'vi'
  const light = P.strong !== '#fff'
  const soft = up ? (light ? '#14B8A6' : '#5EEAD4') : (light ? '#F97316' : '#FDBA74')
  const glow = up ? 'rgba(52,211,153,.45)' : 'rgba(251,113,133,.45)'
  const fillTop = up ? (light ? 'rgba(5,150,105,.28)' : 'rgba(52,211,153,.38)') : (light ? 'rgba(225,29,72,.24)' : 'rgba(251,113,133,.36)')
  const data = pts.map(([t, v]) => [t * 1000, v])
  const last = data[data.length - 1]
  const open: number | null = pts.length ? pts[0][1] : null
  const vals = pts.map((p) => p[1])
  const span = vals.length ? Math.max(...vals) - Math.min(...vals) : 0
  const top = vals.length ? Math.max(...vals.map(Math.abs)) : 0
  // Pick axis precision from the visible range so tick labels never repeat ($2.2K, $2.2K…).
  const axisFmt = (v: number) => {
    if (top >= 1e5 && span >= 1e3) return fmtUsd(v, { compact: true })
    const d = span >= 10 ? 0 : span >= 0.1 ? 2 : span >= 0.001 ? 4 : 6
    return `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
  }
  const range = String(w.time_range || '').toUpperCase()
  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000)
    return w.time_range === '1d'
      ? d.toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' })
  }
  const option = {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 8, top: 12, bottom: 24, containLabel: true },
    xAxis: {
      type: 'time',
      axisLine: { show: true, lineStyle: { color: P.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: P.axis, fontSize: 11, hideOverlap: true, formatter: (v: number) => fmtTime(v / 1000) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      position: 'right',
      axisLabel: { color: P.axis, fontSize: 11, formatter: axisFmt },
      splitLine: { lineStyle: { color: P.grid, type: 'dashed' } },
    },
    tooltip: {
      ...tooltipBase(P),
      formatter: (p: any) => {
        const [ts, v] = p[0].value
        return `<div style="color:${P.muted};font-size:11px;margin-bottom:4px">${new Date(ts).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</div><div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:12px;height:2.5px;border-radius:2px;background:${color}"></span><b style="color:${P.strong}">${fmtUsd(v)}</b></div>`
      },
    },
    series: [
      {
        type: 'line',
        data: data,
        showSymbol: false,
        smooth: 0.25,
        z: 3,
        lineStyle: {
          width: 2.5,
          color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: soft }, { offset: 1, color }] },
          shadowColor: glow,
          shadowBlur: 14,
          shadowOffsetY: 4,
        },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: fillTop }, { offset: 0.55, color: up ? P.upFill : P.downFill }, { offset: 1, color: 'rgba(0,0,0,0)' }] } },
        markLine: open != null ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: P.crosshair, type: [3, 4], width: 1 },
          label: { show: true, position: 'insideStartTop', color: P.axis, fontSize: 10, formatter: () => (vi ? 'Mở cửa ' : 'Open ') + fmtUsd(open) },
          data: [{ yAxis: open }],
        } : undefined,
        animationDuration: 1100,
        animationEasing: 'cubicOut',
      },
      ...(last ? [{
        type: 'effectScatter',
        data: [last],
        symbolSize: 7,
        z: 4,
        rippleEffect: { scale: 3.2, brushType: 'stroke', period: 2.6 },
        itemStyle: { color, shadowColor: glow, shadowBlur: 10 },
        tooltip: { show: false },
        animationDelay: 900,
      }] : []),
    ],
  }
  return (
    <div className={`${card} relative overflow-hidden p-4`} style={{ borderColor: up ? 'rgba(52,211,153,.18)' : 'rgba(251,113,133,.18)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-24 right-0 h-48 w-2/3 rounded-full blur-3xl" style={{ background: up ? 'rgba(52,211,153,.12)' : 'rgba(251,113,133,.12)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }} />
      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <span className="relative flex h-2 w-2"><span className="absolute inset-0 rounded-full" style={{ background: color, animation: 'mk-pulse-ring 2s ease-out infinite' }} /><span className="relative h-2 w-2 rounded-full" style={{ background: color }} /></span>
            {w.symbol} · {range}
          </div>
          <div className="mt-0.5 text-2xl font-semibold text-white">{fmtUsd(s.last)}</div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center rounded-full px-2 py-0.5 text-sm font-bold" style={{ color, background: up ? 'rgba(52,211,153,.12)' : 'rgba(251,113,133,.12)' }}>{s.change_pct == null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(s.change_pct).toFixed(2)}%`}</div>
          <div className="text-xs text-zinc-500">H {fmtUsd(s.high)} · L {fmtUsd(s.low)}</div>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 220 }} notMerge opts={{ renderer: 'svg' }} />
    </div>
  )
}

function Ranking({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const P = usePalette()
  const title: Record<string, [string, string]> = {
    market_cap: ['Vốn hóa lớn nhất', 'Top by market cap'],
    top_gainers: ['Tăng mạnh nhất 24h', 'Top gainers 24h'],
    top_losers: ['Giảm mạnh nhất 24h', 'Top losers 24h'],
    volume: ['Khối lượng lớn nhất', 'Top by volume'],
  }
  const tt = title[w.sort_by] || title.market_cap
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-sm font-bold text-white">{lang === 'vi' ? tt[0] : tt[1]}</span>
        {w.category && w.category !== 'ALL' && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-zinc-300">{w.category}</span>}
      </div>
      <div className="overflow-x-auto mk-scroll">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2 font-semibold">#</th>
              <th className="py-2 font-semibold">Token</th>
              <th className="py-2 text-right font-semibold">{lang === 'vi' ? 'Giá' : 'Price'}</th>
              <th className="py-2 text-right font-semibold">24h</th>
              <th className="px-4 py-2 text-right font-semibold">{lang === 'vi' ? 'Vốn hóa' : 'Mcap'}</th>
            </tr>
          </thead>
          <tbody>
            {(w.rows || []).map((r: any, i: number) => (
              <motion.tr key={r.symbol ?? i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-zinc-500">{i + 1}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    {r.image ? <img src={r.image} alt="" className="h-6 w-6 rounded-full bg-white/5" loading="lazy" /> : <div className="h-6 w-6 rounded-full bg-white/10" />}
                    <div className="leading-tight"><div className="font-bold text-white">{r.symbol}</div><div className="max-w-[140px] truncate text-xs text-zinc-500">{r.name}</div></div>
                  </div>
                </td>
                <td className="py-2.5 text-right font-mono text-[13px] text-zinc-200">{fmtUsd(r.price)}</td>
                <td className="py-2.5 text-right font-mono text-[13px] font-medium" style={{ color: (r.change_24h ?? 0) >= 0 ? P.up : P.down }}>{fmtPct(r.change_24h)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[13px] text-zinc-400">{fmtUsd(r.market_cap, { compact: true })}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function News({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const items = (w.items || []).slice(0, 6)
  return (
    <div className={`${card} p-2`}>
      <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-sm font-bold text-white"><Newspaper className="h-4 w-4 text-teal-300" />{lang === 'vi' ? 'Tin tức' : 'News'}</div>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((n: any, i: number) => (
          <a key={n.id ?? i} href={n.url || '#'} target="_blank" rel="noreferrer" className="group rounded-xl p-2.5 transition hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="font-semibold uppercase tracking-wide text-zinc-400">{n.source || '—'}</span>
              {n.published_at && <span>· {timeAgo(n.published_at, lang)}</span>}
            </div>
            <div className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug text-zinc-100 group-hover:text-white">{n.title}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

function FearGreed({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const P = usePalette()
  const v = Number(w.value ?? 0)
  const color = P.fg[v < 25 ? 0 : v < 45 ? 1 : v < 56 ? 2 : v < 75 ? 3 : 4]
  const gauge = {
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '100%', center: ['50%', '62%'],
      progress: { show: true, width: 10, roundCap: true, itemStyle: { color } },
      axisLine: { lineStyle: { width: 10, color: [[1, P.track]] }, roundCap: true },
      pointer: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, offsetCenter: [0, '-5%'], fontSize: 30, fontWeight: 900, color: P.strong, formatter: '{value}' },
      title: { show: false },
      data: [{ value: v }],
    }],
  }
  const hist: [number, number][] = w.history || []
  const line = {
    grid: { left: 0, right: 0, top: 6, bottom: 0 },
    xAxis: { type: 'time', show: false }, yAxis: { type: 'value', min: 0, max: 100, show: false },
    tooltip: { ...tooltipBase(P), formatter: (p: any) => `${new Date(p[0].value[0]).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US')}<br/><b>${p[0].value[1]}</b>` },
    series: [{ type: 'line', data: hist.map(([t, x]) => [t * 1000, x]), showSymbol: false, smooth: true, lineStyle: { width: 2, color: P.line } }],
  }
  return (
    <div className={`${card} grid grid-cols-[150px_1fr] items-center gap-4 p-4`}>
      <div>
        <ReactECharts option={gauge} style={{ height: 110 }} opts={{ renderer: 'svg' }} />
        <div className="-mt-3 text-center text-xs font-bold" style={{ color }}>{fgLabel(w.classification ?? null, lang === 'vi')}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{lang === 'vi' ? 'Sợ hãi & Tham lam · 30 ngày' : 'Fear & Greed · 30D'}</div>
        <ReactECharts option={line} style={{ height: 90 }} opts={{ renderer: 'svg' }} />
      </div>
    </div>
  )
}

function ArcWallet({ w }: { w: Widget }) {
  const { lang } = useI18n()
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500"><Wallet className="h-3.5 w-3.5" />Arc · {shortAddr(w.address)}</div>
          <div className="mt-1 text-2xl font-semibold text-white">{fmtNum(w.usdc, 2)} <span className="text-base font-bold text-zinc-400">USDC</span></div>
        </div>
        <a href={w.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5">Explorer<ExternalLink className="h-3 w-3" /></a>
      </div>
      {w.tokens?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {w.tokens.slice(0, 8).map((tk: any, i: number) => (
            <span key={tk.address ?? i} className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs"><b className="text-white">{fmtNum(tk.balance, 4)}</b> <span className="text-zinc-400">{tk.symbol}</span></span>
          ))}
        </div>
      )}
      {w.transactions?.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{lang === 'vi' ? 'Giao dịch gần đây' : 'Recent transactions'}</div>
          <div className="divide-y divide-white/[0.04]">
            {w.transactions.slice(0, 6).map((t: any) => (
              <a key={t.hash} href={`${ARC.explorer}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 py-2 text-xs hover:bg-white/[0.02]">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.status === 'ok' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="truncate font-mono text-zinc-300">{t.method || (lang === 'vi' ? 'chuyển tiền' : 'transfer')}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-zinc-500">
                  {Number(t.value_usdc) > 0 && <span className="text-zinc-200">{fmtNum(t.value_usdc, 4)} USDC</span>}
                  <span>{t.time ? timeAgo(t.time, lang) : ''}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ArcTx({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const ok = w.status === 'success'
  const rows = [[vi ? 'Từ' : 'From', shortAddr(w.from)], [vi ? 'Đến' : 'To', shortAddr(w.to)], [vi ? 'Giá trị' : 'Value', `${fmtNum(w.value_usdc, 6)} USDC`], [vi ? 'Phí' : 'Fee', w.fee_usdc ? `${fmtNum(w.fee_usdc, 6)} USDC` : '—'], [vi ? 'Khối' : 'Block', fmtNum(w.block, 0)]]
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><Receipt className="h-4 w-4 text-teal-300" />{shortAddr(w.hash)}</div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ok ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>{ok ? (vi ? '✓ Thành công' : '✓ Success') : w.status === 'failed' || w.status === 'reverted' ? (vi ? 'Thất bại' : 'Failed') : String(w.status)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
        {rows.map(([k, v]) => <div key={k}><div className="text-zinc-500">{k}</div><div className="font-mono text-zinc-200">{v}</div></div>)}
      </div>
      <a href={w.explorer} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-sky-300 hover:underline">Arc Explorer<ExternalLink className="h-3 w-3" /></a>
    </div>
  )
}

function ArcNetwork({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const items = [
    [vi ? 'Block mới nhất' : 'Latest block', fmtNum(w.latest_block, 0)],
    [vi ? 'Giá gas' : 'Gas price', `${fmtNum(w.gas_price_gwei, 1)} gwei`],
    [vi ? 'Giao dịch hôm nay' : 'Txs today', fmtNum(w.transactions_today, 0)],
    [vi ? 'Tổng giao dịch' : 'Total txs', fmtNum(w.total_transactions, 0)],
    [vi ? 'Tổng địa chỉ' : 'Addresses', fmtNum(w.total_addresses, 0)],
    [vi ? 'Mức sử dụng' : 'Utilization', w.network_utilization_pct != null ? `${fmtNum(w.network_utilization_pct, 2)}%` : '—'],
  ]
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Blocks className="h-4 w-4 text-teal-300" />{w.chain || 'Arc Testnet'}
        <span className="relative ml-1 flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" style={{ animation: 'mk-pulse-ring 1.6s ease-out infinite' }} /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([k, v]) => <div key={k} className="rounded-xl bg-white/[0.03] px-3 py-2"><div className="text-[11px] text-zinc-500">{k}</div><div className="font-mono text-sm text-white">{v}</div></div>)}
      </div>
    </div>
  )
}

function WebResults({ w }: { w: Widget }) {
  const items = (w.items || []).slice(0, 5)
  return (
    <div className={`${card} p-2`}>
      <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-sm font-bold text-white"><Globe className="h-4 w-4 text-teal-300" /><span className="truncate">{w.query}</span></div>
      {items.map((it: any, i: number) => {
        let host = ''
        try { host = new URL(it.url).hostname.replace('www.', '') } catch { /* ignore */ }
        return (
          <a key={it.url ?? i} href={it.url} target="_blank" rel="noreferrer" className="flex gap-3 rounded-xl p-2.5 hover:bg-white/[0.04]">
            <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" className="mt-0.5 h-4 w-4 rounded" loading="lazy" />
            <div className="min-w-0"><div className="truncate text-[13.5px] font-semibold text-zinc-100">{it.title}</div><div className="text-[11px] text-zinc-500">{host}</div></div>
          </a>
        )
      })}
    </div>
  )
}

type ProjectRow = { id?: string; key?: string; project_id?: string | null; name: string; logo?: string | null; symbol?: string | null; tags?: string[]; backers?: string[] | null; last_raise?: number | null; raise_usd?: number | null; total_raise?: number | null }

function Projects({ w }: { w: Widget }) {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  // Also renders cards saved in older chats (same shape, different field names).
  const items = ((w.items || []) as ProjectRow[]).map((a) => ({ ...a, id: a.id || a.project_id || a.key || '' })).filter((a) => a.id && a.name)
  if (!items.length) return null
  return (
    <div className={`${card} p-2`}>
      <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-sm font-bold text-white"><Building2 className="h-4 w-4 text-teal-300" />{vi ? 'Hồ sơ dự án' : 'Project profiles'}</div>
      {items.map((a) => {
        const raised = a.last_raise || a.raise_usd || a.total_raise || null
        return (
          <button key={a.id} onClick={() => openProject({ id: a.id, name: a.name, logo: a.logo, symbol: a.symbol })} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white/[0.04]">
            <Logo src={a.logo || null} name={a.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5"><span className="truncate text-[13.5px] font-semibold text-zinc-100">{a.name}</span>{a.symbol && <span className="shrink-0 font-mono text-[11px] text-zinc-500">${a.symbol}</span>}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-zinc-500">
                {[a.tags?.slice(0, 2).join(', ') || null, a.backers?.length ? `${vi ? 'Quỹ' : 'Backers'}: ${a.backers.slice(0, 2).join(', ')}` : null].filter(Boolean).join(' · ') || (vi ? 'Xem hồ sơ dự án' : 'View profile')}
              </div>
            </div>
            {raised ? <div className="shrink-0 text-right"><div className="font-mono text-[13px] font-semibold text-zinc-100">{fmtUsd(raised, { compact: true })}</div><div className="text-[10px] text-zinc-500">{vi ? 'Gọi vốn' : 'Raised'}</div></div> : null}
          </button>
        )
      })}
      <button onClick={() => window.dispatchEvent(new CustomEvent('mk:view', { detail: 'projects' }))} className="mx-2 mb-1.5 mt-1 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-teal-300 hover:underline">{vi ? 'Mở trang Dự án' : 'Open Projects'}<ArrowRight className="h-3.5 w-3.5" /></button>
    </div>
  )
}

export function WidgetView({ w }: { w: Widget }) {
  const inner = (() => {
    switch (w.type) {
      case 'price_chart': return <PriceChart w={w} />
      case 'ranking': return <Ranking w={w} />
      case 'news': return <News w={w} />
      case 'fear_greed': return <FearGreed w={w} />
      case 'arc_wallet': return <ArcWallet w={w} />
      case 'arc_tx': return <ArcTx w={w} />
      case 'arc_network': return <ArcNetwork w={w} />
      case 'web_results': return <WebResults w={w} />
      case 'projects':
      case 'airdrops': return <Projects w={w} /> // no longer emitted; renders cards saved in old chats
      case 'verdict': return <VerdictReport c={w as unknown as Check} compact />
      default: return null
    }
  })()
  if (!inner) return null
  return <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>{inner}</motion.div>
}
