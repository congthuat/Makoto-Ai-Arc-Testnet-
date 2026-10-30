import { motion } from 'motion/react'
import { Check, Wrench, Zap, Sparkles, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useSession } from '@/lib/session'
import { fmtNum } from '@/lib/format'
import { SpotlightCard } from '../Brand'
import { SectionHeader, fadeUp, fadeUpDelay, usePackages, pkgName, type Pkg } from './shared'

function PackageCard({ p, featured }: { p: Pkg; featured: boolean }) {
  const { t, lang } = useI18n()
  const { login } = useSession()
  const vi = lang === 'vi'
  const questions = Math.floor(p.credits / 3)
  const body = (
    <SpotlightCard className={`flex h-full flex-col p-6 ${featured ? '!rounded-[15px] !border-transparent ![background:var(--mk-pro-bg,#070912)]' : ''}`}>
      <div className="flex h-6 items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">{pkgName(p.id, lang)}</span>
        {featured && (
          <span className="rounded-full bg-gradient-to-r from-[#2DD4BF] via-[#3B82F6] to-[#7C3AED] px-2.5 py-0.5 text-[11px] font-medium text-white">{t('bestValue')}</span>
        )}
      </div>
      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-5xl font-semibold tracking-[-0.04em] text-white">{p.usdc}</span>
        <span className="text-sm text-zinc-500">USDC</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
        {fmtNum(p.credits, 0)} {t('credits')}
        {p.bonus > 0 && <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">+{p.bonus}% {vi ? 'thưởng' : 'bonus'}</span>}
      </div>
      <ul className="mt-6 space-y-2.5 border-t border-white/[0.06] pt-6 text-sm text-zinc-400">
        <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />{vi ? `Khoảng ${fmtNum(questions, 0)} câu hỏi` : `~${fmtNum(questions, 0)} questions`}</li>
        <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />{vi ? `Hoặc ${fmtNum(Math.floor(p.credits / 3), 0)} lần xác minh` : `Or ${fmtNum(Math.floor(p.credits / 3), 0)} verifications`}</li>
      </ul>
      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={() => login()}
          className={`h-10 w-full rounded-full text-sm font-medium transition-colors ${featured ? 'bg-white text-black hover:bg-zinc-200' : 'border border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.08]'}`}
        >
          {vi ? `Chọn ${pkgName(p.id, lang).toLowerCase()}` : `Choose ${pkgName(p.id, lang)}`}
        </button>
      </div>
    </SpotlightCard>
  )
  if (!featured) return body
  return (
    <div className="relative h-full rounded-2xl bg-gradient-to-b from-[#2DD4BF]/70 via-[#3B82F6]/50 to-[#7C3AED]/60 p-px shadow-[0_0_60px_-12px_rgba(59,130,246,.45)]">
      {body}
    </div>
  )
}

export function Pricing() {
  const { t, lang } = useI18n()
  const vi = lang === 'vi'
  const { data, isError } = usePackages()
  const pkgs = data?.packages ?? []

  const costs = [
    { icon: Zap, k: 'Makoto Fast', v: vi ? '1 credit / câu hỏi' : '1 credit / question', n: vi ? '+1 credit mỗi công cụ' : '+1 credit per tool' },
    { icon: Sparkles, k: 'Makoto Pro', v: vi ? '5 credit / câu hỏi' : '5 credits / question', n: vi ? '+2 credit mỗi công cụ' : '+2 credits per tool' },
    { icon: Wrench, k: vi ? 'Công cụ dữ liệu' : 'Data tools', v: vi ? 'Tối đa 6 lần / câu hỏi' : 'Up to 6 per question', n: vi ? 'Giá, tin tức, on-chain, web' : 'Price, news, on-chain, web' },
    { icon: ShieldCheck, k: vi ? 'Xác minh' : 'Verification', v: vi ? '3 credit / lần' : '3 credits / check', n: vi ? 'Mọi chế độ' : 'Any model' },
  ]

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-3 px-5 py-24 md:px-6 md:py-32">
      <SectionHeader
        eyebrow={t('pricing')}
        title={vi ? 'Thanh toán theo mức sử dụng' : 'Usage-based pricing'}
        sub={vi ? 'Không thuê bao, không ràng buộc. Thanh toán bằng USDC, credit không có thời hạn sử dụng.' : 'No subscription, no lock-in. Pay in USDC; credits never expire.'}
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pkgs.length
          ? pkgs.map((p, i) => (
              <motion.div key={p.id} {...fadeUpDelay(i * 0.07)} className="h-full">
                <PackageCard p={p} featured={p.id === 'pro'} />
              </motion.div>
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-[372px] rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
                {!isError && <><div className="mk-skel h-4 w-16" /><div className="mk-skel mt-6 h-12 w-24" /><div className="mk-skel mt-3 h-4 w-32" /></>}
              </div>
            ))}
      </div>

      <motion.div {...fadeUp} className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] lg:grid-cols-4">
        {costs.map((c) => (
          <div key={c.k} className="flex items-start gap-3 bg-[#05060B] px-5 py-4">
            <c.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
            <div>
              <div className="text-xs text-zinc-500">{c.k}</div>
              <div className="mt-0.5 text-sm font-medium text-zinc-200">{c.v}</div>
              {c.n && <div className="mt-0.5 text-xs text-zinc-500">{c.n}</div>}
            </div>
          </div>
        ))}
      </motion.div>
      <p className="mt-4 text-xs text-zinc-600">
        {vi
          ? 'Số câu hỏi là ước tính với Makoto Fast, trung bình 3 credit mỗi câu hỏi.'
          : 'Question counts are estimates for Makoto Fast, averaging 3 credits per question.'}
      </p>
    </section>
  )
}
