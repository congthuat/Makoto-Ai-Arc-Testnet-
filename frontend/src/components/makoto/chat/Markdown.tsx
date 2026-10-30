import { memo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

function CodeBlock({ children }: { children?: ReactNode }) {
  const { t } = useI18n()
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const cls = String((children as ReactElement<{ className?: string }>)?.props?.className || '')
  const lang = cls.match(/language-([\w+-]+)/)?.[1] || 'text'
  const copy = () => {
    navigator.clipboard.writeText(ref.current?.textContent || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="mk-code not-prose">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5">
        <span className="font-mono text-[11px] lowercase text-zinc-500">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white" aria-label={t('copy')}>
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
      <pre ref={ref} className="mk-scroll">{children}</pre>
    </div>
  )
}

const components = {
  a: (p: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...p} target="_blank" rel="noreferrer" />,
  pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="mk-scroll overflow-x-auto rounded-xl border border-white/[0.07]"><table className="!m-0">{children}</table></div>
  ),
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>
      {text}
    </ReactMarkdown>
  )
})
