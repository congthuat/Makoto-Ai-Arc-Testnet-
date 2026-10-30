export function fmtUsd(n?: number | null, opts: { compact?: boolean } = {}) {
  if (n == null || Number.isNaN(n)) return '—'
  if (opts.compact) {
    const abs = Math.abs(n)
    if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  }
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 2 : Math.abs(n) >= 0.01 ? 4 : 6
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export const fmtPct = (n?: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`)

export const fmtNum = (n?: number | string | null, d = 2) => {
  const v = typeof n === 'string' ? Number(n) : n
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { maximumFractionDigits: d })
}

export function timeAgo(ts: number | string, lang: 'vi' | 'en' = 'vi') {
  const ms = typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : new Date(ts).getTime()
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000))
  const units: [number, string, string][] = [[86400, 'ngày', 'd'], [3600, 'giờ', 'h'], [60, 'phút', 'm']]
  for (const [sec, vi, en] of units) {
    if (s >= sec) {
      const v = Math.floor(s / sec)
      return lang === 'vi' ? `${v} ${vi} trước` : `${v}${en} ago`
    }
  }
  return lang === 'vi' ? 'vừa xong' : 'just now'
}
