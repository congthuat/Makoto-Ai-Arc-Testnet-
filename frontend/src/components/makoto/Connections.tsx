import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, ExternalLink, Link2, Loader2, Unlink, Wallet } from 'lucide-react'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { ARC, shortAddr } from '@/lib/wallet'
import { fmtNum } from '@/lib/format'
import { GoogleG } from './LoginModal'

/** Opens Settings and scrolls to Connections (used by "Connect wallet" prompts across the app). */
export function openConnections() {
  window.dispatchEvent(new CustomEvent('mk:open-settings', { detail: 'connections' }))
}

export function ConnectionsPanel() {
  const { me, linkWallet, unlinkWallet, loggingIn } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const [confirm, setConfirm] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [copied, setCopied] = useState(false)
  const u = me?.user
  const wallet = u?.wallet || null
  const legacy = Boolean(u && /^0x[0-9a-f]{40}$/.test(u.address))
  const busy = loggingIn !== 'idle'

  const copy = () => {
    if (!wallet) return
    navigator.clipboard.writeText(wallet)
    setCopied(true)
    toast.success(vi ? 'Đã sao chép địa chỉ ví' : 'Address copied')
    setTimeout(() => setCopied(false), 1500)
  }
  const remove = async () => {
    setRemoving(true)
    await unlinkWallet()
    setRemoving(false)
    setConfirm(false)
  }

  const card = 'flex flex-col gap-4 border-b border-white/[0.05] px-5 py-5 last:border-0 sm:flex-row sm:items-center'
  const icon = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]'
  const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold'

  return (
    <section id="connections" className="mt-8 scroll-mt-6">
      <h2 className="text-lg font-semibold text-white">{vi ? 'Kết nối' : 'Connections'}</h2>
      <p className="mt-1 text-sm text-zinc-500">{vi ? 'Tài khoản đăng nhập và ví đã liên kết với Makoto.' : 'Your sign-in account and the wallet linked to Makoto.'}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        {/* Google */}
        <div className={card}>
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className={icon}><GoogleG className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">Google</span>
                {u?.email
                  ? <span className={`${pill} bg-emerald-400/10 text-emerald-300`}><Check className="h-3 w-3" />{vi ? 'Dùng để đăng nhập' : 'Used to sign in'}</span>
                  : <span className={`${pill} bg-white/[0.06] text-zinc-400`}>{vi ? 'Chưa liên kết' : 'Not linked'}</span>}
              </div>
              <div className="mt-0.5 truncate text-sm text-zinc-400">
                {u?.email || (vi ? 'Lần tới hãy đăng nhập bằng Google. Sau đó kết nối lại ví này để chuyển credit và lịch sử sang.' : 'Next time, sign in with Google, then connect this wallet to move your credits and history over.')}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className={card}>
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className={`${icon} ${wallet ? 'text-teal-300' : 'text-zinc-400'}`}><Wallet className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{vi ? 'Ví crypto' : 'Crypto wallet'}</span>
                {wallet
                  ? <span className={`${pill} bg-emerald-400/10 text-emerald-300`}><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{vi ? 'Đã kết nối' : 'Connected'}</span>
                  : <span className={`${pill} bg-white/[0.06] text-zinc-400`}>{vi ? 'Chưa kết nối' : 'Not connected'}</span>}
              </div>
              {wallet ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <button onClick={copy} className="inline-flex items-center gap-1.5 font-mono text-zinc-200 hover:text-white" title={wallet}>
                    {shortAddr(wallet)}{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-500" />}
                  </button>
                  <a href={`${ARC.explorer}/address/${wallet}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white">{vi ? 'Xem trên Arc' : 'View on Arc'}<ExternalLink className="h-3 w-3" /></a>
                  <span className="text-xs text-zinc-500">{me?.arcBalance != null ? `${fmtNum(me.arcBalance, 2)} USDC · ${ARC.name}` : ARC.name}</span>
                </div>
              ) : (
                <div className="mt-0.5 text-sm text-zinc-400">{vi ? 'Kết nối ví để nạp credit bằng USDC và để Makoto xem ví của bạn khi bạn hỏi.' : 'Connect a wallet to top up with USDC and let Makoto look at your wallet when you ask.'}</div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {legacy ? (
              <span className="text-xs text-zinc-500">{vi ? 'Ví đang dùng để đăng nhập' : 'Your current login'}</span>
            ) : !wallet ? (
              <button onClick={linkWallet} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_0_24px_rgba(94,234,212,.35)] disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{vi ? 'Kết nối ví' : 'Connect wallet'}
              </button>
            ) : confirm ? (
              <>
                <span className="text-xs text-zinc-400">{vi ? 'Gỡ ví này?' : 'Disconnect?'}</span>
                <button onClick={remove} disabled={removing} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60">
                  {removing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{vi ? 'Gỡ' : 'Disconnect'}
                </button>
                <button onClick={() => setConfirm(false)} className="rounded-xl px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white">{vi ? 'Hủy' : 'Cancel'}</button>
              </>
            ) : (
              <>
                <button onClick={linkWallet} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-60">{vi ? 'Đổi ví' : 'Change'}</button>
                <button onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-400 hover:border-rose-400/30 hover:text-rose-200"><Unlink className="h-3.5 w-3.5" />{vi ? 'Gỡ' : 'Disconnect'}</button>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-zinc-500">
        {vi
          ? 'Kết nối ví chỉ cần ký một tin nhắn xác nhận, không tốn phí và không cho phép ai rút tiền của bạn. Makoto không bao giờ hỏi cụm từ khôi phục hay khóa riêng.'
          : 'Connecting only asks you to sign a free message. It can’t move your funds. Makoto never asks for your recovery phrase or private key.'}
      </p>
    </section>
  )
}
