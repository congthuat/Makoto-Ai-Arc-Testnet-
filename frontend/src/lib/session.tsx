import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './api'
import { ensureArc, requestAccount, signMessage, getEthereum } from './wallet'
import { commitBrowserProvider, clearBrowserProvider, discoverBrowserWallets, subscribeBrowserWallets, browserWalletRevision, type BrowserWallet } from './wallets/walletProviders'
import { restoreWalletConnect, disconnectWalletConnect } from './wallets/walletConnect'
import { useSyncExternalStore } from 'react'
import { useI18n } from './i18n'
import { friendlyError } from './errors'

export type User = {
  address: string
  credits: number
  total_deposited_credits: number
  total_spent_credits: number
  language: string
  model: 'fast' | 'pro'
  email?: string | null
  name?: string | null
  avatar?: string | null
  /** Wallet linked in Settings → Connections (lowercase 0x…). */
  wallet?: string | null
}
export type Me = { user: User; arcBalance: string | null; stats: { conversations: number; messages: number; checks?: number; usdc_deposited: number } }

type Ctx = {
  token: string | null
  me: Me | undefined
  /** True when loading the profile failed (e.g. 500 / offline) and there is no cached copy. */
  meError: boolean
  ready: boolean
  loggingIn: 'idle' | 'connecting' | 'signing'
  /** Opens the Google sign-in dialog. */
  login: () => void
  loginOpen: boolean
  closeLogin: () => void
  /** Google OAuth client id: undefined = loading, null = not set up yet. */
  googleClientId: string | null | undefined
  /** Temporary wallet login, only while Google isn't configured. */
  walletLoginAllowed: boolean
  openWalletLogin: () => void
  googleLogin: (credential: string) => Promise<boolean>
  /** Opens the wallet picker to connect (link) a wallet to the signed-in account. */
  linkWallet: () => void
  unlinkWallet: () => Promise<void>
  /** Called by the picker with the chosen wallet: connects, switches to Arc and links / reconnects it. */
  connectWith: (wallet: BrowserWallet, signal?: AbortSignal) => Promise<boolean>
  connectOpen: boolean
  closeConnect: () => void
  connectError: string | null
  logout: () => void
  authFetch: (path: string, init?: RequestInit) => Promise<Response>
  refreshMe: () => void
  setCredits: (n: number) => void
}

const SessionCtx = createContext<Ctx | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loggingIn, setLoggingIn] = useState<'idle' | 'connecting' | 'signing'>('idle')
  const [connectOpen, setConnectOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const authCfg = useQuery<{ google: string | null; walletLogin: boolean }>({
    queryKey: ['auth-config'],
    queryFn: () => fetch(api('auth/config')).then((r) => r.json()),
    staleTime: 5 * 60_000,
  })
  const [connectError, setConnectError] = useState<string | null>(null)
  const walletRev = useSyncExternalStore(subscribeBrowserWallets, browserWalletRevision, () => 0)

  useEffect(() => {
    setToken(localStorage.getItem('mk_token'))
    setReady(true)
    discoverBrowserWallets()
    void restoreWalletConnect()
  }, [])

  const logout = useCallback(() => {
    const tk = localStorage.getItem('mk_token')
    if (tk) fetch(api('auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${tk}` } }).catch(() => {})
    localStorage.removeItem('mk_token')
    void disconnectWalletConnect()
    clearBrowserProvider()
    setToken(null)
    qc.clear()
  }, [qc])

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(api(path), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
      })
      if (res.status === 401) logout()
      return res
    },
    [token, logout]
  )

  const meQuery = useQuery<Me>({
    queryKey: ['me', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const r = await authFetch('me')
      if (!r.ok) throw new Error('Failed to load profile')
      return r.json()
    },
    refetchInterval: 60_000,
  })

  // If the browser wallet switches to another account, forget it (top-ups will ask to reconnect).
  useEffect(() => {
    const eth = getEthereum()
    if (!eth?.on || !token) return
    const onChange = (accs: unknown) => {
      const a = (accs as string[])?.[0]?.toLowerCase()
      const linked = meQuery.data?.user.wallet
      if (a && linked && a !== linked) clearBrowserProvider()
    }
    eth.on('accountsChanged', onChange)
    return () => eth.removeListener?.('accountsChanged', onChange)
  }, [token, meQuery.data, logout, walletRev])

  const login = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])
  const openWalletLogin = useCallback(() => { setLoginOpen(false); setConnectError(null); setConnectOpen(true) }, [])
  const linkWallet = useCallback(() => { setConnectError(null); setConnectOpen(true) }, [])
  const closeConnect = useCallback(() => setConnectOpen(false), [])

  const startSession = useCallback((v: { token: string; isNew?: boolean; user?: { credits?: number } }) => {
    localStorage.setItem('mk_token', v.token)
    setToken(v.token)
    setLoginOpen(false)
    setConnectOpen(false)
    if (v.isNew) toast.success(t('welcome', { n: v.user?.credits ?? 20 }))
  }, [t])

  const googleLogin = useCallback(async (credential: string) => {
    try {
      const v = await (await fetch(api('auth/google'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) })).json()
      if (!v.token) throw new Error(v.error || 'Login failed')
      startSession(v)
      return true
    } catch (e) {
      toast.error(friendlyError(e, lang, lang === 'vi' ? 'Đăng nhập không thành công. Vui lòng thử lại.' : 'Sign-in failed. Please try again.'))
      return false
    }
  }, [startSession, lang])

  const connectWith = useCallback(async (wallet: BrowserWallet, signal?: AbortSignal) => {
    const p = wallet.provider
    const aborted = () => signal?.aborted
    setConnectError(null)
    try {
      setLoggingIn('connecting')
      const address = await requestAccount(p)
      if (aborted()) return false
      await ensureArc(p).catch(() => {})
      if (aborted()) return false
      const user = meQuery.data?.user
      if (token && user) {
        const legacy = /^0x[0-9a-f]{40}$/.test(user.address)
        // Already linked (e.g. reconnecting for a top-up): just bind the provider.
        if (user.wallet && address === user.wallet) {
          commitBrowserProvider(p)
          setConnectOpen(false)
          return true
        }
        if (legacy) throw new Error(t('wrongAccount'))
        // Link a (new) wallet to the Google account: sign a free proof-of-ownership message.
        const n = await (await authFetch('auth/link/nonce', { method: 'POST', body: JSON.stringify({ address }) })).json()
        if (!n.message) throw new Error(n.error || 'Connect failed')
        setLoggingIn('signing')
        const signature = await signMessage(address, n.message, p)
        if (aborted()) return false
        const v = await (await authFetch('auth/link/verify', { method: 'POST', body: JSON.stringify({ address, signature }) })).json()
        if (!v.user) throw new Error(v.error === 'WALLET_TAKEN' ? t('walletTaken') : v.error || 'Connect failed')
        commitBrowserProvider(p)
        setConnectOpen(false)
        qc.setQueryData<Me>(['me', token], (old) => (old ? { ...old, user: v.user } : old))
        void meQuery.refetch()
        qc.invalidateQueries({ queryKey: ['conversations'] })
        toast.success(v.merged ? t('walletMerged', { n: v.merged.credits }) : t('walletLinked'))
        return true
      }
      const n = await (await fetch(api('auth/nonce'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) })).json()
      if (!n.message) throw new Error(n.error || 'Login failed')
      setLoggingIn('signing')
      const signature = await signMessage(address, n.message, p)
      if (aborted()) return false
      const v = await (await fetch(api('auth/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, signature }) })).json()
      if (!v.token) throw new Error(v.error || 'Login failed')
      commitBrowserProvider(p)
      startSession(v)
      return true
    } catch (e) {
      if (aborted()) return false
      const err = e as { code?: number; message?: string }
      const msg = err?.code === 4001 || err?.code === 4100 ? t('rejected') : friendlyError(err, lang, lang === 'vi' ? 'Không kết nối được ví. Vui lòng thử lại.' : 'Couldn’t connect the wallet. Please try again.')
      setConnectError(msg)
      toast.error(msg)
      return false
    } finally {
      setLoggingIn('idle')
    }
  }, [t, lang, token, meQuery, authFetch, qc, startSession])

  const unlinkWallet = useCallback(async () => {
    const r = await authFetch('auth/link', { method: 'DELETE' })
    const v = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(v.error || 'Failed'); return }
    void disconnectWalletConnect()
    clearBrowserProvider()
    qc.setQueryData<Me>(['me', token], (old) => (old ? { ...old, user: v.user, arcBalance: null } : old))
    void meQuery.refetch()
    toast.success(t('walletUnlinked'))
  }, [authFetch, qc, token, meQuery, t])

  const setCredits = useCallback(
    (n: number) => {
      qc.setQueryData<Me>(['me', token], (old) => (old ? { ...old, user: { ...old.user, credits: n } } : old))
    },
    [qc, token]
  )

  const value = useMemo(
    () => ({
      token, me: meQuery.data, meError: meQuery.isError && !meQuery.data, ready, loggingIn, login, loginOpen, closeLogin,
      googleClientId: authCfg.isLoading ? undefined : authCfg.data?.google ?? null,
      walletLoginAllowed: Boolean(authCfg.data?.walletLogin) && !authCfg.data?.google,
      openWalletLogin, googleLogin, linkWallet, unlinkWallet,
      connectWith, connectOpen, closeConnect, connectError, logout, authFetch, refreshMe: () => meQuery.refetch(), setCredits,
    }),
    [token, meQuery, authCfg.isLoading, authCfg.data, ready, loggingIn, login, loginOpen, closeLogin, openWalletLogin, googleLogin, linkWallet, unlinkWallet, connectWith, connectOpen, closeConnect, connectError, logout, authFetch, setCredits]
  )
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const c = useContext(SessionCtx)
  if (!c) throw new Error('useSession outside provider')
  return c
}
