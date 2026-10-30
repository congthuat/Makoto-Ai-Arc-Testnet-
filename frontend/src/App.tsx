import { lazy, Suspense, useEffect } from 'react'
import { Toaster } from 'sonner'
import { MotionConfig } from 'motion/react'
import { useIsFetching } from '@tanstack/react-query'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { I18nProvider } from '@/lib/i18n'
import { ThemeProvider, useTheme } from '@/lib/theme'
import { THEME_CSS } from '@/components/makoto/themeCss'
import { SessionProvider, useSession } from '@/lib/session'
import { useI18n } from '@/lib/i18n'
import { GLOBAL_CSS, LogoMark, logoSvg } from '@/components/makoto/Brand'

const Landing = lazy(() => import('@/components/makoto/Landing').then((m) => ({ default: m.Landing })))
const AppShell = lazy(() => import('@/components/makoto/AppShell').then((m) => ({ default: m.AppShell })))
import { ConnectModal } from '@/components/makoto/ConnectModal'
import { LoginModal } from '@/components/makoto/LoginModal'
import { useSiteHead, OfflineBanner, LegalDialog } from '@/components/makoto/Site'
import { Tooltips } from '@/components/makoto/Tooltips'

// Frontend API calls should use `src/lib/api.ts`, not absolute `/api/...` URLs.
function Splash() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[#05060B]">
      <div className="relative" style={{ animation: 'mk-float 2.4s ease-in-out infinite' }}>
        <div className="absolute inset-0 scale-150 rounded-full bg-gradient-to-br from-teal-300/30 via-blue-500/30 to-violet-600/30 blur-2xl" />
        <div className="relative"><LogoMark size={48} animated /></div>
      </div>
    </div>
  )
}

function MeError() {
  const { refreshMe, logout } = useSession()
  const { lang } = useI18n()
  const vi = lang === 'vi'
  const fetching = useIsFetching({ queryKey: ['me'] }) > 0
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-[#05060B] px-6 text-center">
      <LogoMark size={40} />
      <div>
        <p className="text-base font-semibold text-white">{vi ? 'Không tải được tài khoản của bạn' : 'Couldn’t load your account'}</p>
        <p className="mt-1 text-sm text-zinc-400">{vi ? 'Kiểm tra kết nối mạng rồi thử lại.' : 'Check your connection and try again.'}</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => refreshMe()} disabled={fetching} className="min-h-10 rounded-full bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60">
          {fetching ? (vi ? 'Đang thử lại…' : 'Retrying…') : vi ? 'Thử lại' : 'Try again'}
        </button>
        <button onClick={logout} className="min-h-10 rounded-full border border-white/10 px-5 text-sm text-zinc-300 transition hover:bg-white/[0.06]">{vi ? 'Đăng xuất' : 'Log out'}</button>
      </div>
    </div>
  )
}

function Root() {
  useSiteHead()
  const { token, ready, me, meError } = useSession()
  if (ready && token && !me && meError) return <MeError />
  if (!ready || (token && !me)) return <Splash />
  return <Suspense fallback={<Splash />}>{token ? <AppShell /> : <Landing />}</Suspense>
}

function useBrandHead() {
  useEffect(() => {
    const href = `data:image/svg+xml,${encodeURIComponent(logoSvg(64))}`
    document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((l) => l.remove())
    for (const rel of ['icon', 'apple-touch-icon']) {
      const link = document.createElement('link')
      link.rel = rel
      link.type = 'image/svg+xml'
      link.href = href
      document.head.appendChild(link)
    }
  }, [])
}

function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="top-center" richColors toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 14 } }} />
}

export default function App() {
  useBrandHead()
  return (
    <ThemeProvider>
      <I18nProvider>
        <SessionProvider>
          <MotionConfig reducedMotion="user">
            <style>{GLOBAL_CSS}</style>
            <style>{THEME_CSS}</style>
            <Root />
            <LoginModal />
            <ConnectModal />
            <LegalDialog />
            <OfflineBanner />
            <Tooltips />
            <ThemedToaster />
          </MotionConfig>
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
