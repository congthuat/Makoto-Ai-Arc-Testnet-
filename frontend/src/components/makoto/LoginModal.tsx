import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Gift, Loader2, Lock, ShieldCheck, X } from 'lucide-react'
import { useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import { LogoMark } from './Brand'

type Gis = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
      cancel?: () => void
    }
  }
}
declare global { interface Window { google?: Gis } }

let gisPromise: Promise<Gis> | null = null
function loadGis(): Promise<Gis> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('gis')))
    s.onerror = () => { gisPromise = null; reject(new Error('gis')) }
    document.head.appendChild(s)
  })
  return gisPromise
}

function GoogleG({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** The only way to sign in: Google. Wallets are connected later in Settings → Connections. */
export function LoginModal() {
  const { loginOpen, closeLogin, googleClientId, googleLogin } = useSession()
  const { t, lang } = useI18n()
  const { theme } = useTheme()
  const vi = lang === 'vi'
  const btnRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [gisError, setGisError] = useState(false)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    if (!loginOpen) { setBusy(false); return }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLogin() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginOpen, closeLogin])

  // Render Google's official button once the dialog is open and the client id is known.
  useEffect(() => {
    if (!loginOpen || !googleClientId) return
    let cancelled = false
    setGisError(false)
    loadGis()
      .then((g) => {
        if (cancelled || !btnRef.current) return
        g.accounts.id.initialize({
          client_id: googleClientId,
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
          callback: async (resp: { credential?: string }) => {
            if (!resp?.credential) return
            setBusy(true)
            const ok = await googleLogin(resp.credential)
            if (!ok) setBusy(false)
          },
        })
        const w = Math.min(360, Math.max(240, btnRef.current.parentElement?.clientWidth || 320))
        setWidth(w)
        btnRef.current.innerHTML = ''
        g.accounts.id.renderButton(btnRef.current, {
          type: 'standard', theme: theme === 'light' ? 'outline' : 'filled_black', size: 'large',
          shape: 'pill', text: 'continue_with', logo_alignment: 'left', locale: vi ? 'vi' : 'en', width: w,
        })
      })
      .catch(() => !cancelled && setGisError(true))
    return () => { cancelled = true }
  }, [loginOpen, googleClientId, googleLogin, theme, vi])

  const perks = vi
    ? [[Gift, 'Tặng 20 credit dùng thử khi đăng nhập lần đầu'], [Lock, 'Không cần ví để bắt đầu. Kết nối ví sau, khi muốn nạp credit'], [ShieldCheck, 'Makoto không bao giờ hỏi cụm từ khôi phục (seed phrase) hay khóa riêng (private key)']]
    : [[Gift, 'Free trial credits on your first sign-in'], [Lock, 'No wallet needed to start. Connect one later to top up'], [ShieldCheck, 'Makoto never asks for your recovery phrase or private key']]

  return (
    <AnimatePresence>
      {loginOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) closeLogin() }}>
          <motion.div role="dialog" aria-modal aria-label={t('signIn')}
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-[420px] overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0b14] shadow-[0_30px_120px_-20px_rgba(94,234,212,.25)] sm:rounded-3xl">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl" />
            <button onClick={closeLogin} className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white" aria-label={vi ? 'Đóng' : 'Close'}><X className="h-4 w-4" /></button>

            <div className="relative px-7 pb-7 pt-9 text-center">
              <div className="mx-auto w-fit"><LogoMark size={52} animated /></div>
              <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-white">{vi ? 'Đăng nhập Makoto' : 'Sign in to Makoto'}</h2>
              <p className="mt-1.5 text-sm text-zinc-400">{vi ? 'Nền tảng AI xác minh thông tin crypto' : 'AI-powered crypto verification'}</p>

              <div className="mt-7 flex min-h-[44px] items-center justify-center">
                {googleClientId === undefined ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                ) : googleClientId && !gisError ? (
                  <div className="relative" style={{ width }}>
                    <div ref={btnRef} className={busy ? 'pointer-events-none opacity-40' : ''} style={{ minHeight: 44, colorScheme: 'normal' }} />
                    {busy && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-200"><Loader2 className="h-4 w-4 animate-spin" />{vi ? 'Đang đăng nhập…' : 'Signing in…'}</div>}
                  </div>
                ) : (
                  <div className="w-full">
                    <button disabled className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-400">
                      <GoogleG />{t('signIn')}
                    </button>
                    <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
                      {gisError
                        ? (vi ? 'Không tải được nút Google. Kiểm tra mạng hoặc tắt chặn quảng cáo rồi thử lại.' : 'Could not load Google sign-in. Check your connection or ad blocker and try again.')
                        : (vi ? 'Đăng nhập tạm thời gián đoạn. Vui lòng thử lại sau.' : 'Sign-in is temporarily unavailable. Please try again later.')}
                    </p>
                  </div>
                )}
              </div>

              <ul className="mt-7 space-y-2.5 text-left">
                {perks.map(([Icon, text], i) => {
                  const I = Icon as typeof Gift
                  return (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-zinc-400">
                      <I className="mt-0.5 h-4 w-4 shrink-0 text-teal-300/80" />{text as string}
                    </li>
                  )
                })}
              </ul>


              <p className="mt-6 text-[11.5px] leading-relaxed text-zinc-500">
                {vi ? 'Khi tiếp tục, bạn đồng ý với ' : 'By continuing you agree to the '}
                <a href="#terms" onClick={closeLogin} className="text-zinc-300 hover:text-white">{vi ? 'Điều khoản' : 'Terms'}</a>
                {vi ? ' và ' : ' and '}
                <a href="#privacy" onClick={closeLogin} className="text-zinc-300 hover:text-white">{vi ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}</a>.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { GoogleG }
