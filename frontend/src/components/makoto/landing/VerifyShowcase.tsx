import { motion } from 'motion/react'
import { Check, X, AlertTriangle, HelpCircle, ScanSearch, Scale, Siren, ListChecks, TrendingUp, TrendingDown } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ScoreGauge, VerdictBadge } from '../verify/Report'
import { ConnectCta, DemoTag, EASE, SectionHeader, fadeUpDelay } from './shared'

type Status = 'false' | 'misleading' | 'unverifiable' | 'true'
const STATUS: Record<Status, { vi: string; en: string; cls: string; Icon: typeof Check }> = {
  true: { vi: 'Đúng', en: 'True', cls: 'text-emerald-300 bg-emerald-400/10', Icon: Check },
  false: { vi: 'Sai', en: 'False', cls: 'text-rose-300 bg-rose-400/10', Icon: X },
  misleading: { vi: 'Gây hiểu lầm', en: 'Misleading', cls: 'text-amber-300 bg-amber-400/10', Icon: AlertTriangle },
  unverifiable: { vi: 'Chưa kiểm chứng', en: 'Unverified', cls: 'text-zinc-300 bg-white/[0.06]', Icon: HelpCircle },
}

const DEMO = {
  vi: {
    input: '“$MOONCAT sắp niêm yết trên Binance, tăng x10 trong tuần này.”',
    headline: 'Cam kết lợi nhuận, không có nguồn xác thực',
    claims: [
      { c: 'Sắp được niêm yết trên Binance', s: 'unverifiable' as Status },
      { c: 'Tăng x10 trong một tuần', s: 'misleading' as Status },
    ],
    scan: [
      { k: 'Honeypot', v: 'Không', ok: true },
      { k: 'Thuế bán', v: '12%', ok: false },
      { k: 'Chủ hợp đồng', v: 'Còn quyền', ok: false },
    ],
    bull: 'Thanh khoản DEX tăng 3 ngày gần đây',
    bear: 'Top 10 ví nắm 61% nguồn cung',
    tactics: ['Cam kết lợi nhuận', 'Tạo áp lực tâm lý'],
  },
  en: {
    input: '“$MOONCAT is listing on Binance soon, 10x this week.”',
    headline: 'Return claims with no verifiable source',
    claims: [
      { c: 'About to list on Binance', s: 'unverifiable' as Status },
      { c: '10x within a week', s: 'misleading' as Status },
    ],
    scan: [
      { k: 'Honeypot', v: 'No', ok: true },
      { k: 'Sell tax', v: '12%', ok: false },
      { k: 'Contract owner', v: 'Retains control', ok: false },
    ],
    bull: 'DEX liquidity up over the last 3 days',
    bear: 'Top 10 wallets hold 61% of supply',
    tactics: ['Return promises', 'Urgency pressure'],
  },
}

function DemoReport() {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const d = DEMO[lang]
  const label = 'text-[11px] font-medium uppercase tracking-wider text-zinc-500'
  return (
    <div className="mk-border-spin rounded-3xl" role="img" aria-label={vi ? 'Minh họa một báo cáo xác minh' : 'Illustrative verification report'}>
      <div className="rounded-3xl border border-white/[0.08] bg-[#08080f]/90 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm italic leading-relaxed text-zinc-400">{d.input}</p>
          <DemoTag>{vi ? 'Minh họa' : 'Demo'}</DemoTag>
        </div>

        <div className="mt-5 flex items-center gap-5">
          <ScoreGauge score={22} verdict="risky" size={104} />
          <div className="min-w-0">
            <VerdictBadge verdict="risky" small />
            <div className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">{d.headline}</div>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className={label}>{vi ? 'Các nhận định' : 'Claims'}</div>
          {d.claims.map((x, i) => {
            const s = STATUS[x.s]
            return (
              <motion.div key={x.c} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: EASE }} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <span className="text-sm text-zinc-200">{x.c}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}><s.Icon className="h-3 w-3" />{vi ? s.vi : s.en}</span>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className={label}>{vi ? 'Phân tích hợp đồng' : 'Contract analysis'}</div>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              {d.scan.map((x) => (
                <div key={x.k} className="flex items-center justify-between gap-2">
                  <dt className="text-zinc-400">{x.k}</dt>
                  <dd className={`flex items-center gap-1 font-medium ${x.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{x.ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{x.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className={label}>{vi ? 'Ủng hộ & phản biện' : 'Bull & bear case'}</div>
            <div className="mt-2 space-y-2 text-[13px] leading-snug">
              <div className="flex gap-2"><TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /><span className="text-zinc-300">{d.bull}</span></div>
              <div className="flex gap-2"><TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" /><span className="text-zinc-300">{d.bear}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-zinc-500"><Siren className="h-3.5 w-3.5 text-rose-300" />{vi ? 'Dấu hiệu thao túng:' : 'Manipulation signals:'}</span>
          {d.tactics.map((x) => <span key={x} className="rounded-full border border-rose-300/20 bg-rose-400/[0.06] px-2 py-0.5 text-[11px] text-rose-200">{x}</span>)}
        </div>
      </div>
    </div>
  )
}

export function VerifyShowcase() {
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const points = [
    { icon: ListChecks, t: vi ? 'Xác minh từng nhận định' : 'Claim-level verification', b: vi ? 'Mỗi nhận định được đối chiếu độc lập với dữ liệu giá, tin tức và on-chain.' : 'Each claim is checked independently against price, news and on-chain data.' },
    { icon: ScanSearch, t: vi ? 'Phân tích hợp đồng' : 'Contract analysis', b: vi ? 'Honeypot, thuế mua bán, quyền chủ sở hữu và mức độ tập trung nguồn cung.' : 'Honeypots, buy/sell tax, owner privileges and supply concentration.' },
    { icon: Scale, t: vi ? 'Đánh giá đa chiều' : 'Balanced assessment', b: vi ? 'Cân nhắc cả luận điểm ủng hộ và phản biện trước khi đưa ra điểm tin cậy.' : 'Weighs the case for and against before assigning a score.' },
    { icon: Siren, t: vi ? 'Phát hiện thao túng' : 'Manipulation detection', b: vi ? 'Nhận diện cam kết lợi nhuận, áp lực thời gian và yêu cầu chuyển tiền đáng ngờ.' : 'Flags return promises, artificial urgency and suspicious payment requests.' },
  ]
  return (
    <section id="verify" className="relative mx-auto max-w-6xl scroll-mt-3 px-5 py-24 md:px-6 md:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <SectionHeader
            eyebrow={vi ? 'Xác minh' : 'Verification'}
            title={vi ? 'Đánh giá độ tin cậy của mọi tín hiệu' : 'Score the credibility of any signal'}
            sub={vi ? 'Từ tín hiệu giao dịch, tin đồn thị trường đến địa chỉ token. Makoto trả về điểm tin cậy kèm phân tích chi tiết trong chưa đầy một phút.' : 'From trading signals and market rumors to token addresses. Makoto returns a credibility score with detailed analysis in under a minute.'}
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {points.map((p, i) => (
              <motion.li key={p.t} {...fadeUpDelay(0.05 + i * 0.06)} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]"><p.icon className="h-4 w-4 text-teal-200" /></span>
                <div>
                  <h3 className="text-[15px] font-medium text-white">{p.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{p.b}</p>
                </div>
              </motion.li>
            ))}
          </ul>
          <motion.div {...fadeUpDelay(0.25)} className="mt-10 flex flex-wrap items-center gap-4">
            <ConnectCta label={vi ? 'Bắt đầu xác minh' : 'Start verifying'} />
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.9, ease: EASE }}>
          <DemoReport />
        </motion.div>
      </div>
    </section>
  )
}
