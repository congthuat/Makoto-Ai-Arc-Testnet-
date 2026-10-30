import { ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ARC } from '@/lib/wallet'
import { Logo } from '../Brand'

export function Footer() {
  const { t, lang } = useI18n()
  const vi = lang === 'vi'
  const link = 'text-sm text-zinc-500 transition-colors hover:text-white'
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] md:px-6">
        <div>
          <Logo size={26} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
            {vi ? 'Nền tảng AI xác minh thông tin crypto. Thanh toán theo mức sử dụng bằng USDC trên Arc.' : 'AI-powered crypto verification. Usage-based billing in USDC on Arc.'}
          </p>
        </div>
        <nav aria-label={vi ? 'Sản phẩm' : 'Product'}>
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">{vi ? 'Sản phẩm' : 'Product'}</h3>
          <ul className="mt-4 space-y-3">
            <li><a href="#verify" className={link}>{vi ? 'Xác minh' : 'Verify'}</a></li>
            <li><a href="#features" className={link}>{vi ? 'Tính năng' : 'Features'}</a></li>
            <li><a href="#pricing" className={link}>{t('pricing')}</a></li>
            <li><a href="#faq" className={link}>{t('faq')}</a></li>
          </ul>
        </nav>
        <nav aria-label="Arc">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">Arc</h3>
          <ul className="mt-4 space-y-3">
            <li><a href={ARC.explorer} target="_blank" rel="noreferrer" className={`${link} inline-flex items-center gap-1`}>Explorer<ArrowUpRight className="h-3 w-3" /></a></li>
            <li><a href={ARC.faucet} target="_blank" rel="noreferrer" className={`${link} inline-flex items-center gap-1`}>Faucet<ArrowUpRight className="h-3 w-3" /></a></li>
          </ul>
        </nav>
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">{vi ? 'Pháp lý' : 'Legal'}</h3>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            {vi ? 'Thông tin chỉ mang tính tham khảo, không phải lời khuyên đầu tư.' : 'For information only. Not financial advice.'}
          </p>
          <ul className="mt-4 space-y-3">
            <li><a href="#terms" className={link}>{vi ? 'Điều khoản sử dụng' : 'Terms of use'}</a></li>
            <li><a href="#privacy" className={link}>{vi ? 'Quyền riêng tư' : 'Privacy policy'}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <span>© 2026 Makoto</span>
          <span>{vi ? 'Xây dựng trên Arc Testnet' : 'Built on Arc Testnet'}</span>
        </div>
      </div>
    </footer>
  )
}
