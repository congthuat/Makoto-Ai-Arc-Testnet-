import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, ChevronRight, Copy, ExternalLink, Loader2, ShieldCheck, Smartphone, Wallet, X } from 'lucide-react'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { WALLET_CATALOG, catalogWallet } from '@/lib/wallets/walletCatalog'
import { discoverBrowserWallets, getBrowserWallets, subscribeBrowserWallets, browserWalletRevision, type BrowserWallet, type WalletKind } from '@/lib/wallets/walletProviders'
import { WC_WALLETS, lastWcWalletId, pairWalletConnect, walletConnectReady, wcWalletId, type WcWallet } from '@/lib/wallets/walletConnect'
import { isMobileBrowser, walletAppLinks } from '@/lib/wallets/walletAppLinks'
import { walletPickerCopy } from '@/lib/wallets/walletPickerCopy'
import { LogoMark } from './Brand'

const LOGOS = import.meta.glob('../../assets/wallets/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const logo = (file: string) => LOGOS[`../../assets/wallets/${file}`]
const LOGO_FILES: Partial<Record<WalletKind | 'okxwallet', string>> = {
  metamask: 'metamask.svg', rabby: 'rabby.svg', walletconnect: 'walletconnect.svg',
  okx: 'okx.png', okxwallet: 'okxwallet.png', binance: 'binance.png', trust: 'trust.png', bitget: 'bitget.png',
  coinbase: 'coinbase.png', phantom: 'phantom.png', rainbow: 'rainbow.png', zerion: 'zerion.png', brave: 'brave.png',
}

/** Announced icons stay inside <img>; wallet SVG markup never enters the DOM. */
function WalletIcon({ kind, wallet, alt, size = 40 }: { kind: WalletKind; wallet?: BrowserWallet; alt?: 'okxwallet'; size?: number }) {
  const [broken, setBroken] = useState(false)
  const [brokenFile, setBrokenFile] = useState(false)
  const cls = 'shrink-0 rounded-xl object-contain ring-1 ring-white/[0.08]'
  if (wallet?.icon && !broken) return <img src={wallet.icon} onError={() => setBroken(true)} width={size} height={size} alt="" className={cls} style={{ width: size, height: size }} />
  if (kind === 'embedded') return <LogoMark size={size} />
  const file = LOGO_FILES[alt ?? kind]
  const src = file && logo(file)
  if (src && !brokenFile) return <img src={src} onError={() => setBrokenFile(true)} width={size} height={size} alt="" className={cls} style={{ width: size, height: size }} />
  const mono = catalogWallet(kind)?.mono
  if (mono) return <span aria-hidden style={{ background: mono.bg, color: mono.fg, width: size, height: size }} className={`flex shrink-0 items-center justify-center rounded-xl font-semibold ${mono.text.length > 2 ? 'text-[11px]' : 'text-[15px]'}`}>{mono.text}</span>
  return <span aria-hidden style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-xl bg-white/[0.06]"><Wallet className="h-5 w-5" /></span>
}

const label = 'mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500'

export function ConnectModal() {
  const { connectOpen, closeConnect, connectWith, connectError, loggingIn, token, me } = useSession()
  const { t, lang } = useI18n()
  const copy = walletPickerCopy(lang)
  const vi = lang === 'vi'
  const revision = useSyncExternalStore(subscribeBrowserWallets, browserWalletRevision, () => 0)
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [qrUri, setQrUri] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const connection = useRef<AbortController | null>(null)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    if (connectOpen) { discoverBrowserWallets(); setMobile(isMobileBrowser()) }
    else { connection.current?.abort(); connection.current = null; setPending(null); setQrUri(null); setFailed(false) }
  }, [connectOpen])
  useEffect(() => {
    if (!connectOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  void revision
  const wallets = connectOpen ? getBrowserWallets().filter((w) => w.source !== 'walletconnect' && w.source !== 'embedded') : []
  const order = (kind: WalletKind) => { const i = WALLET_CATALOG.findIndex((e) => e.kind === kind); return i < 0 ? WALLET_CATALOG.length : i }
  const rows = [...wallets].sort((a, b) => order(a.kind) - order(b.kind))
  const installRows = (mobile && !wallets.length ? [] : WALLET_CATALOG).filter((e) => !wallets.some((w) => w.kind === e.kind))
  const wcReady = walletConnectReady()
  const recentWc = connectOpen ? lastWcWalletId() : null
  const pageUrl = typeof window === 'undefined' ? '' : window.location.href

  const close = () => { connection.current?.abort(); connection.current = null; closeConnect() }

  const run = async (id: string, getWallet: (signal: AbortSignal) => Promise<BrowserWallet>) => {
    if (connection.current) return
    const controller = new AbortController()
    connection.current = controller
    setPending(id)
    setFailed(false)
    try {
      const wallet = await getWallet(controller.signal)
      if (controller.signal.aborted) return
      setQrUri(null)
      const ok = await connectWith(wallet, controller.signal)
      if (!ok && !controller.signal.aborted) setFailed(true)
    } catch (e) {
      if (!controller.signal.aborted) { setFailed(true); setQrUri(null); console.warn(e) }
    } finally {
      if (connection.current === controller) { connection.current = null; setPending(null) }
    }
  }
  const choose = (w: BrowserWallet) => run(w.id, async () => w)
  const chooseWc = (w?: WcWallet) => run(w ? `wc:${wcWalletId(w)}` : 'wc:qr', (signal) => pairWalletConnect({ wallet: w, onUri: w ? undefined : setQrUri, signal }))
  const cancelQr = () => { connection.current?.abort(); connection.current = null; setPending(null); setQrUri(null) }
  const status = (id: string) => (pending === id ? (loggingIn === 'signing' ? t('signing') : copy.connecting) : null)

  const isCocCoc = typeof navigator !== 'undefined' && /coc_coc_browser/i.test(navigator.userAgent)

  return (
    <AnimatePresence>
      {connectOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
          <motion.div role="dialog" aria-modal aria-label={t('connectTitle')}
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative flex max-h-[92dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b14] shadow-[0_30px_120px_-20px_rgba(94,234,212,.25)] sm:rounded-3xl">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4 px-6 pb-3 pt-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">{token && me?.user.wallet ? (vi ? 'Kết nối lại ví' : 'Reconnect wallet') : t('connectTitle')}</h2>
                <p className="mt-1 text-sm text-zinc-400">{token && me?.user.wallet ? (vi ? `Mở ví ${me.user.wallet.slice(0, 6)}…${me.user.wallet.slice(-4)} đã kết nối để tiếp tục.` : `Open your connected wallet ${me.user.wallet.slice(0, 6)}…${me.user.wallet.slice(-4)} to continue.`) : t('connectSub')}</p>
              </div>
              <button onClick={close} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={vi ? "Đóng" : "Close"}><X className="h-4 w-4" /></button>
            </div>

            <div className="mk-scroll relative min-h-0 flex-1 overflow-y-auto px-6 pb-6">
              {rows.length > 0 && <p className={label}>{copy.inBrowser}</p>}
              <div className="space-y-2">
                {rows.map((w, i) => (
                  <motion.button key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    type="button" disabled={!!pending} onClick={() => void choose(w)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-default ${pending === w.id ? 'border-teal-300/50 bg-teal-300/[0.06]' : 'border-white/[0.09] bg-white/[0.03] hover:border-teal-300/40 hover:bg-white/[0.05]'}`}>
                    <WalletIcon kind={w.kind} wallet={w} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[14.5px] font-semibold text-white">{w.kind === 'other' && w.source === 'legacy' ? copy.other : w.name}</span>
                      <span className={`block text-xs ${pending === w.id ? 'text-teal-300' : 'text-emerald-400/80'}`}>{status(w.id) ?? copy.detected}</span>
                    </span>
                    {pending === w.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-300" /> : (
                      <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-3 text-[12.5px] font-semibold text-white transition group-hover:bg-white group-hover:text-black">{copy.connect}<ChevronRight className="h-3.5 w-3.5" /></span>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Desktop: WalletConnect QR for phone wallets */}
              {!mobile && wcReady && (
                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
                  {qrUri ? (
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-2 py-1 text-center">
                      <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={qrUri} size={196} level="M" /></div>
                      <p className="text-[12.5px] text-zinc-400">{status('wc:qr') && loggingIn !== 'idle' ? status('wc:qr') : copy.wcScan}</p>
                      <button onClick={cancelQr} className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">{vi ? 'Hủy' : 'Cancel'}</button>
                    </motion.div>
                  ) : (
                    <button type="button" disabled={!!pending} onClick={() => void chooseWc()} className="flex w-full items-center gap-3 text-left disabled:cursor-default">
                      <WalletIcon kind="walletconnect" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-white">{copy.wcPhone}</span>
                        <span className="block text-xs text-zinc-500">{pending === 'wc:qr' ? (status('wc:qr') ?? copy.wcWaiting) : copy.wcPhoneHint}</span>
                      </span>
                      {pending === 'wc:qr' ? <Loader2 className="h-4 w-4 animate-spin text-teal-300" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                    </button>
                  )}
                </div>
              )}

              {/* Phone without an injected wallet: deep-link into wallet apps over WalletConnect */}
              {mobile && !wallets.length && wcReady && (
                <div className="mt-1">
                  <p className={label}>{copy.wcTitle}</p>
                  <div className="space-y-2">
                    {WC_WALLETS.map((w) => {
                      const id = `wc:${wcWalletId(w)}`
                      return (
                        <button key={id} type="button" disabled={!!pending} onClick={() => void chooseWc(w)}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] p-3 text-left transition hover:border-teal-300/40 disabled:cursor-default">
                          <WalletIcon kind={w.kind} alt={w.logo} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14.5px] font-semibold text-white">
                              {w.name}
                              {w.note && <span className="ml-1.5 text-[11.5px] font-medium text-zinc-500">· {vi ? w.note : w.note === 'App sàn OKX' ? 'OKX exchange app' : 'Standalone OKX Wallet app'}</span>}
                              {recentWc === wcWalletId(w) && <span className="ml-2 rounded-md bg-teal-300/15 px-1.5 py-0.5 align-middle text-[10.5px] font-semibold text-teal-200">{copy.recent}</span>}
                            </span>
                            <span className={`block text-xs ${pending === id ? 'text-teal-300' : 'text-zinc-500'}`}>{pending === id ? (status(id) ?? copy.wcWaiting) : copy.wcHint}</span>
                          </span>
                          {pending === id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-300" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
                        </button>
                      )
                    })}
                    <button type="button" disabled={!!pending} onClick={() => void chooseWc()}
                      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/[0.12] p-3 text-left transition hover:border-teal-300/40 disabled:cursor-default">
                      <WalletIcon kind="walletconnect" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-white">{copy.wcOther}</span>
                        <span className="block text-xs text-zinc-500">{pending === 'wc:qr' ? copy.wcWaiting : copy.wcOtherHint}</span>
                      </span>
                    </button>
                  </div>
                  {qrUri && (
                    <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] p-3 text-center">
                      <div className="rounded-xl bg-white p-2"><QRCodeSVG value={qrUri} size={168} level="M" /></div>
                      <p className="text-xs text-zinc-400">{copy.wcCopyHint}</p>
                      <button onClick={() => { void navigator.clipboard.writeText(qrUri); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-white">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}{copy.wcCopy}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Phone: open Makoto inside a wallet app's browser */}
              {mobile && !wallets.length && (
                <details className="group/app mt-3 rounded-2xl border border-teal-300/20 bg-teal-300/[0.03] p-3" open={!wcReady}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[13.5px] font-semibold text-white">
                    <Smartphone className="h-4 w-4 text-teal-300" />{copy.wcAlt}<ChevronRight className="ml-auto h-4 w-4 text-zinc-500 transition group-open/app:rotate-90" />
                  </summary>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {walletAppLinks(pageUrl).map((l) => (
                      <a key={l.kind} href={l.href} rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 transition hover:bg-white/[0.05]">
                        <WalletIcon kind={l.kind} size={30} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{l.name}</span>
                        <ExternalLink className="h-3 w-3 text-zinc-500" />
                      </a>
                    ))}
                  </div>
                </details>
              )}

              {installRows.length > 0 && <p className={`${label} mt-5`}>{copy.more}</p>}
              <div className="grid grid-cols-2 gap-2">
                {installRows.map((e) => (
                  <a key={e.kind} href={e.installUrl} target="_blank" rel="noopener noreferrer" title={copy.notInstalled}
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] p-2.5 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
                    <WalletIcon kind={e.kind} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-white">{e.name}</span>
                      <span className="flex items-center gap-1 text-[11.5px] text-zinc-500">{copy.install}<ExternalLink className="h-2.5 w-2.5" /></span>
                    </span>
                  </a>
                ))}
              </div>

              {(failed || (!wallets.length && !mobile)) && (
                <div role="status" className={`mt-4 rounded-2xl border p-3.5 text-[12.5px] leading-5 ${failed ? 'border-amber-300/25 bg-amber-300/[0.06]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                  <p className="text-[13px] font-semibold text-white">{failed ? copy.helpTitle : copy.noWalletTitle}</p>
                  {failed && connectError && <p className="mt-1 break-words text-zinc-500">{copy.details}: “{connectError}”</p>}
                  {isCocCoc && <p className="mt-2 text-amber-300">{copy.coccoc}</p>}
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-zinc-400">
                    {failed && <><li>{copy.tipUnlock}</li><li>{copy.tipPopup}</li>{wallets.length > 1 && <li>{copy.tipConflict}</li>}<li>{copy.tipNetwork}</li></>}
                    {!isCocCoc && <li>{copy.tipBrowser}</li>}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setFailed(false); discoverBrowserWallets() }} className="rounded-lg bg-white/[0.07] px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/[0.12]">{copy.rescan}</button>
                    <button onClick={() => window.location.reload()} className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">{copy.reload}</button>
                  </div>
                </div>
              )}

              <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />{copy.safety}</p>
              <p className="mt-2 text-[11.5px] text-zinc-600">{lang === 'vi' ? <>Khi kết nối, bạn đồng ý với <a href="#terms" className="text-zinc-400 underline-offset-2 hover:text-white hover:underline">Điều khoản</a> và <a href="#privacy" className="text-zinc-400 underline-offset-2 hover:text-white hover:underline">Quyền riêng tư</a>.</> : <>By connecting, you agree to the <a href="#terms" className="text-zinc-400 underline-offset-2 hover:text-white hover:underline">Terms</a> and <a href="#privacy" className="text-zinc-400 underline-offset-2 hover:text-white hover:underline">Privacy policy</a>.</>}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
