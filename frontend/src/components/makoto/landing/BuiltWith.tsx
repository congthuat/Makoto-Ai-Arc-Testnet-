import { motion } from 'motion/react'
import { Blocks, CircleDollarSign, Database, Sparkles } from 'lucide-react'
import { useVi, fadeUp } from './shared'

/** Technologies Makoto is built with (not partners). */
export function BuiltWith() {
  const vi = useVi()
  const items = [
    { icon: Blocks, name: 'Arc', note: vi ? 'của Circle' : 'by Circle' },
    { icon: CircleDollarSign, name: 'USDC' },
    { icon: Sparkles, name: 'OpenAI' },
    { icon: Database, name: 'Surf', note: vi ? 'dữ liệu' : 'data' },
  ]
  return (
    <section aria-label={vi ? 'Công nghệ sử dụng' : 'Technology'} className="border-y border-white/[0.05] bg-white/[0.01]">
      <motion.div {...fadeUp} className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-10 md:flex-row md:justify-between md:gap-10 md:px-6">
        <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{vi ? 'Xây dựng trên' : 'Built with'}</span>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 md:gap-x-14">
          {items.map((it) => (
            <li key={it.name} className="flex items-center gap-2 text-zinc-500 transition-colors duration-300 hover:text-zinc-200">
              <it.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              <span className="text-[17px] font-semibold tracking-[-0.03em]">{it.name}</span>
              {it.note && <span className="text-xs text-zinc-600">{it.note}</span>}
            </li>
          ))}
        </ul>
      </motion.div>
    </section>
  )
}
