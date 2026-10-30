import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { ExternalLink, Zap, Sparkles, LogOut, Download, Trash2, Loader2, ShieldCheck } from 'lucide-react'
import { useSession } from '@/lib/session'
import { useI18n, creditsText } from '@/lib/i18n'
import { ARC, shortAddr } from '@/lib/wallet'
import { fmtNum } from '@/lib/format'
import { ThemePicker } from './Brand'
import { MemoryPanel } from './Memory'
import { ConnectionsPanel } from './Connections'
import { UserAvatar } from './Sidebar'
import { usePalette } from '@/lib/theme'

type Deposit = { tx_hash: string; amount_usdc: string; credits: number; created_at: string }
type Ledger = { id: number; delta: number; reason: string; ref: string | null; created_at: string }

type Usage = { daily: { day: string; credits: number; questions: number }[]; byModel: { model: string; answers: number; credits: number }[] }

function UsagePanel() {
  const { authFetch, token } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const P = usePalette()
  const { data, isLoading, isError } = useQuery<Usage>({
    queryKey: ['usage', token],
    queryFn: async () => {
      const r = await authFetch('me/usage')
      if (!r.ok) throw new Error('Failed to load usage')
      return r.json()
    },
  })
  const daily = data?.daily ?? []
  const total = daily.reduce((a, d) => a + Number(d.credits || 0), 0)
  const questions = daily.reduce((a, d) => a + Number(d.questions || 0), 0)
  const by = (m: string) => data?.byModel?.find((x) => x.model === m)
  const option = useMemo(() => ({
    grid: { left: 4, right: 4, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: P.pointer } },
      backgroundColor: P.tipBg, borderColor: P.tipBorder, padding: [8, 12],
      textStyle: { color: P.text, fontSize: 12, fontFamily: 'Geist Variable, sans-serif' },
      formatter: (p: { dataIndex: number }[]) => {
        const d = daily[p[0].dataIndex]
        const date = new Date(d.day + 'T00:00:00').toLocaleDateString(vi ? 'vi-VN' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
        return `<div style="color:${P.muted};font-size:11px">${date}</div><div style="margin-top:2px"><b style="color:${P.strong}">${d.credits}</b> ${lang === 'en' && Number(d.credits) !== 1 ? 'credits' : 'credit'} · ${d.questions} ${vi ? 'câu hỏi' : 'questions'}</div>`
      },
    },
    xAxis: {
      type: 'category', data: daily.map((d) => d.day.slice(8, 10) + '/' + d.day.slice(5, 7)),
      axisLine: { lineStyle: { color: P.axisLine } }, axisTick: { show: false },
      axisLabel: { color: P.axis, fontSize: 10, interval: 1 },
    },
    yAxis: {
      type: 'value', minInterval: 1, splitNumber: 3,
      splitLine: { lineStyle: { color: P.grid } }, axisLabel: { color: P.axis, fontSize: 10 },
    },
    series: [{
      type: 'bar', data: daily.map((d) => Number(d.credits || 0)), barMaxWidth: 18,
      itemStyle: { color: P.bar, borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: P.barHover } },
    }],
  }), [daily, vi, lang, P])

  const tile = 'rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4'
  return (
    <div className="mt-6 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: vi ? 'Credit đã dùng (14 ngày)' : 'Credits used (14d)', v: total },
          { l: vi ? 'Câu hỏi (14 ngày)' : 'Questions (14d)', v: questions },
          { l: 'Makoto Fast', v: by('fast')?.answers ?? 0, s: creditsText(by('fast')?.credits ?? 0, lang) },
          { l: 'Makoto Pro', v: by('pro')?.answers ?? 0, s: creditsText(by('pro')?.credits ?? 0, lang) },
        ].map((x) => (
          <div key={x.l} className={tile}>
            <div className="text-xs text-zinc-500">{x.l}</div>
            {isLoading ? <div className="mk-skel mt-2 h-6 w-12" /> : <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{fmtNum(x.v, 0)}</div>}
            {x.s && <div className="text-[11px] text-zinc-500">{fmtNum(x.v, 0)} {vi ? 'câu trả lời' : 'answers'} · {x.s}</div>}
          </div>
        ))}
      </div>
      <div className={tile}>
        <div className="text-sm font-medium text-zinc-200">{vi ? 'Credit đã dùng mỗi ngày' : 'Credits used per day'}</div>
        <div className="text-xs text-zinc-500">{vi ? '14 ngày gần nhất' : 'Last 14 days'}</div>
        {isLoading ? <div className="mk-skel mt-3 h-[180px] w-full" /> : isError ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-zinc-500">{vi ? 'Không tải được thống kê sử dụng' : 'Couldn’t load usage stats'}</div>
        ) : total === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-zinc-500">{vi ? 'Chưa có hoạt động trong 14 ngày qua' : 'No activity in the last 14 days'}</div>
        ) : <ReactECharts option={option} style={{ height: 180, marginTop: 8 }} notMerge />}
      </div>
    </div>
  )
}

const fmtDate = (s: string, lang: string) => new Date(s).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function HistoryView() {
  const { authFetch, token } = useSession()
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<'deposits' | 'usage'>('deposits')
  const { data, isLoading } = useQuery<{ deposits: Deposit[]; ledger: Ledger[] }>({ queryKey: ['history', token], queryFn: () => authFetch('me/history').then((r) => r.json()) })
  const reason = (r: string) => ({ welcome: lang === 'vi' ? 'Quà chào mừng' : 'Welcome gift', deposit: lang === 'vi' ? 'Nạp USDC' : 'USDC top-up', chat: lang === 'vi' ? 'Hỏi Makoto' : 'Chat', verify: lang === 'vi' ? 'Xác minh' : 'Verification' }[r] || r)

  return (
    <div className="mk-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">{t('history')}</h1>
        <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm font-semibold">
          {(['deposits', 'usage'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`relative rounded-full px-4 py-1.5 transition ${tab === k ? 'text-black' : 'text-zinc-400 hover:text-white'}`}>
              {tab === k && <motion.span layoutId="hist-tab" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              <span className="relative">{k === 'deposits' ? t('deposits') : t('usage')}</span>
            </button>
          ))}
        </div>
        <UsagePanel />
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          {isLoading && <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="flex justify-between"><div className="mk-skel h-4 w-40" /><div className="mk-skel h-4 w-16" /></div>)}</div>}
          {tab === 'deposits' && data && (data.deposits.length === 0 ? (
            <div className="p-10 text-center text-sm text-zinc-500">{t('noDeposits')}</div>
          ) : data.deposits.map((d) => (
            <div key={d.tx_hash} className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4 last:border-0">
              <div>
                <div className="font-semibold text-white">+{fmtNum(d.credits, 0)} {t('credits')}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{fmtDate(d.created_at, lang)}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-zinc-200">{fmtNum(d.amount_usdc, 4)} USDC</div>
                <a href={`${ARC.explorer}/tx/${d.tx_hash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-sky-300 hover:underline">{shortAddr(d.tx_hash)}<ExternalLink className="h-3 w-3" /></a>
              </div>
            </div>
          )))}
          {tab === 'usage' && data && data.ledger.length === 0 && (
            <div className="p-10 text-center text-sm text-zinc-500">{lang === 'vi' ? 'Chưa có giao dịch credit nào' : 'No credit activity yet'}</div>
          )}
          {tab === 'usage' && data && data.ledger.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3 last:border-0">
              <div>
                <div className="text-sm text-zinc-200">{reason(l.reason)}</div>
                <div className="text-xs text-zinc-500">{fmtDate(l.created_at, lang)}</div>
              </div>
              <div className={`font-mono text-sm font-semibold ${l.delta >= 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>{l.delta >= 0 ? '+' : ''}{l.delta}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type ExportConv = { id: number; title: string; created_at: string; messages: { role: string; content: string; created_at: string }[] }

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DataPanel({ onCleared }: { onCleared: () => void }) {
  const { authFetch } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const qc = useQueryClient()
  const [busy, setBusy] = useState<'md' | 'json' | 'del' | null>(null)
  const [confirming, setConfirming] = useState(false)

  const exportAll = async (fmt: 'md' | 'json') => {
    setBusy(fmt)
    try {
      const r = await authFetch('conversations/export/all')
      if (!r.ok) throw new Error()
      const data = (await r.json()) as { address: string; exported_at: string; conversations: ExportConv[] }
      if (!data.conversations.length) { toast(vi ? 'Bạn chưa có cuộc trò chuyện nào' : 'No conversations yet'); return }
      const stamp = new Date().toISOString().slice(0, 10)
      if (fmt === 'json') download(`makoto-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
      else {
        const md = [`# Makoto — ${vi ? 'Lịch sử trò chuyện' : 'Chat history'}`, `${vi ? 'Tài khoản' : 'Account'}: ${data.address}`, `${vi ? 'Xuất lúc' : 'Exported'}: ${new Date(data.exported_at).toLocaleString(vi ? 'vi-VN' : 'en-US')}`, '']
        for (const c of data.conversations) {
          md.push('---', '', `## ${c.title}`, `_${new Date(c.created_at).toLocaleString(vi ? 'vi-VN' : 'en-US')}_`, '')
          for (const m of c.messages) md.push(`**${m.role === 'user' ? (vi ? 'Bạn' : 'You') : 'Makoto'}:**`, '', m.content, '')
        }
        download(`makoto-${stamp}.md`, md.join('\n'), 'text/markdown')
      }
      toast.success(vi ? `Đã tải về ${data.conversations.length} cuộc trò chuyện` : `Downloaded ${data.conversations.length} conversations`)
    } catch {
      toast.error(vi ? 'Không tải về được, thử lại sau' : 'Download failed, try again')
    } finally {
      setBusy(null)
    }
  }

  const deleteAll = async () => {
    setBusy('del')
    try {
      const r = await authFetch('conversations', { method: 'DELETE' })
      if (!r.ok) throw new Error()
      qc.invalidateQueries({ queryKey: ['conversations'] })
      onCleared()
      toast.success(vi ? 'Đã xóa toàn bộ cuộc trò chuyện' : 'All conversations deleted')
      setConfirming(false)
    } catch {
      toast.error(vi ? 'Không xóa được, thử lại sau' : 'Could not delete, try again')
    } finally {
      setBusy(null)
    }
  }

  const btn = 'inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50'
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <div className="flex flex-col gap-3 border-b border-white/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="font-semibold text-white">{vi ? 'Tải về dữ liệu của bạn' : 'Download your data'}</div><div className="text-sm text-zinc-500">{vi ? 'Toàn bộ cuộc trò chuyện, dạng văn bản dễ đọc hoặc JSON' : 'All conversations, as readable text or JSON'}</div></div>
        <div className="flex gap-2">
          <button disabled={!!busy} onClick={() => exportAll('md')} className={btn}>{busy === 'md' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{vi ? 'Văn bản' : 'Text'}</button>
          <button disabled={!!busy} onClick={() => exportAll('json')} className={btn}>{busy === 'json' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}JSON</button>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-b border-white/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="font-semibold text-white">{vi ? 'Xóa toàn bộ cuộc trò chuyện' : 'Delete all conversations'}</div><div className="text-sm text-zinc-500">{vi ? 'Không thể hoàn tác. Credit và ví của bạn không bị ảnh hưởng.' : "Can't be undone. Your credits and wallet are not affected."}</div></div>
        {confirming ? (
          <div className="flex gap-2">
            <button disabled={!!busy} onClick={deleteAll} className="inline-flex items-center gap-2 mk-on-color rounded-xl bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">{busy === 'del' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{vi ? 'Xóa hết' : 'Delete all'}</button>
            <button disabled={!!busy} onClick={() => setConfirming(false)} className={btn}>{vi ? 'Hủy' : 'Cancel'}</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className={`${btn} hover:!border-rose-400/40 hover:!text-rose-200`}><Trash2 className="h-4 w-4" />{vi ? 'Xóa…' : 'Delete…'}</button>
        )}
      </div>
      <div className="flex items-center gap-2 px-5 py-4 text-sm text-zinc-500">
        <ShieldCheck className="h-4 w-4 text-emerald-400/70" />
        <a href="#privacy" className="hover:text-white">{vi ? 'Chính sách quyền riêng tư' : 'Privacy policy'}</a>
        <span>·</span>
        <a href="#terms" className="hover:text-white">{vi ? 'Điều khoản sử dụng' : 'Terms of use'}</a>
      </div>
    </div>
  )
}

export function SettingsView({ onCleared }: { onCleared?: () => void } = {}) {
  const { me, authFetch, refreshMe, logout } = useSession()
  const { t, lang, setLang } = useI18n()
  const model = me?.user.model || 'fast'
  const setModel = async (m: 'fast' | 'pro') => {
    await authFetch('me', { method: 'PATCH', body: JSON.stringify({ model: m }) })
    refreshMe()
  }
  const row = 'flex flex-col gap-3 border-b border-white/[0.05] px-5 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between'
  return (
    <div className="mk-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-white">{t('settings')}</h1>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <div className={row}>
            <div className="flex min-w-0 items-center gap-3.5">
              <UserAvatar user={me?.user} size={44} />
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{me?.user.name || me?.user.email || shortAddr(me?.user.wallet || me?.user.address)}</div>
                <div className="truncate text-sm text-zinc-500">{me?.user.email || (lang === 'vi' ? 'Tài khoản ví' : 'Wallet account')}</div>
              </div>
            </div>
            <button onClick={logout} className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 sm:self-auto"><LogOut className="h-4 w-4" />{t('logout')}</button>
          </div>
          <div className={row}>
            <div><div className="font-semibold text-white">{t('language')}</div><div className="text-sm text-zinc-500">{lang === 'vi' ? 'Ngôn ngữ giao diện và câu trả lời mặc định' : 'Interface and default reply language'}</div></div>
            <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm font-semibold">
              {([['vi', 'Tiếng Việt'], ['en', 'English']] as const).map(([k, l]) => (
                <button key={k} onClick={() => {
                  setLang(k)
                  const fail = () => toast.error(k === 'vi' ? 'Không lưu được ngôn ngữ lên tài khoản. Vui lòng thử lại.' : 'Couldn’t save your language to your account. Please try again.')
                  authFetch('me', { method: 'PATCH', body: JSON.stringify({ language: k }) }).then((r) => { if (!r.ok) fail() }).catch(fail)
                }} className={`rounded-full px-3 py-1.5 transition ${lang === k ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className={row}>
            <div><div className="font-semibold text-white">{lang === 'vi' ? 'Giao diện' : 'Appearance'}</div><div className="text-sm text-zinc-500">{lang === 'vi' ? 'Sáng, tối, hoặc tự đổi theo máy của bạn' : 'Light, dark, or follow your device'}</div></div>
            <ThemePicker />
          </div>
          <div className={row}>
            <div><div className="font-semibold text-white">{t('model')}</div><div className="text-sm text-zinc-500">{lang === 'vi' ? 'Mô hình mặc định cho cuộc trò chuyện mới' : 'Default model for new chats'}</div></div>
            <div className="grid grid-cols-2 gap-2">
              {([['fast', 'Makoto Fast', Zap, 1], ['pro', 'Makoto Pro', Sparkles, 5]] as const).map(([k, l, Icon, c]) => (
                <button key={k} onClick={() => setModel(k)} className={`rounded-xl border px-3 py-2 text-left transition ${model === k ? 'border-teal-300/40 bg-teal-300/[0.06]' : 'border-white/[0.08] hover:bg-white/[0.04]'}`}>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white"><Icon className="h-3.5 w-3.5" />{l}</div>
                  <div className="text-xs text-zinc-500">{creditsText(c, lang)} / {lang === 'vi' ? 'câu' : 'msg'}</div>
                </button>
              ))}
            </div>
          </div>
          <div className={row}>
            <div className="font-semibold text-white">{t('stats')}</div>
            <div className="grid grid-cols-3 gap-6 text-sm">
              <div><div className="text-zinc-500">{t('conversations')}</div><div className="font-mono text-white">{me?.stats.conversations ?? 0}</div></div>
              <div><div className="text-zinc-500">{t('messages')}</div><div className="font-mono text-white">{me?.stats.messages ?? 0}</div></div>
              <div><div className="text-zinc-500">USDC</div><div className="font-mono text-white">{fmtNum(me?.stats.usdc_deposited ?? 0, 2)}</div></div>
            </div>
          </div>
        </div>
        <ConnectionsPanel />
        <MemoryPanel />
        <DataPanel onCleared={() => { refreshMe(); onCleared?.() }} />
      </div>
    </div>
  )
}
