import { motion } from 'motion/react'
import { useI18n } from '@/lib/i18n'
import { Aurora } from '../Aurora'
import { LogoMark } from '../Brand'
import { ConnectCta, fadeUp } from './shared'

export function FinalCta() {
  const { t, lang } = useI18n()
  const vi = lang === 'vi'
  return (
    <section aria-labelledby="mk-final-cta" className="px-5 pb-24 md:px-6 md:pb-32">
      <motion.div {...fadeUp} className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-white/[0.08] px-6 py-24 text-center md:py-32">
        <Aurora intensity={0.75} />
        <div aria-hidden className="mk-noise pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="relative">
          <div className="mx-auto mb-8 w-fit"><LogoMark size={48} animated /></div>
          <h2 id="mk-final-cta" className="mx-auto max-w-3xl text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-white md:text-[60px]">
            {vi ? 'Quyết định dựa trên dữ liệu, không dựa trên tin đồn' : 'Decide on data, not rumors'}
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty text-lg leading-relaxed text-zinc-300">
            {vi ? 'Tài khoản mới nhận 20 credit miễn phí.' : 'New accounts receive 20 free credits.'}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <ConnectCta big label={t('start')} />
            <a
              href="#pricing"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-black/20 px-6 text-[15px] font-medium text-zinc-100 backdrop-blur transition-colors hover:bg-white/[0.08]"
            >
              {vi ? 'Xem bảng giá' : 'See pricing'}
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
