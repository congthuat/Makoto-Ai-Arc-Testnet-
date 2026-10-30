import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'vi' | 'en'

const dict = {
  vi: {
    tagline: 'Xác minh trước khi đầu tư.',
    sub: 'Makoto là nền tảng AI xác minh thông tin crypto. Đối chiếu dữ liệu on-chain và thị trường theo thời gian thực, phân tích hợp đồng thông minh và đánh giá mức độ tin cậy của mọi tín hiệu chỉ trong vài giây.',
    start: 'Bắt đầu',
    connect: 'Kết nối ví',
    signIn: 'Đăng nhập bằng Google',
    walletTaken: 'Ví này đã được kết nối với một tài khoản Makoto khác.',
    walletLinked: 'Đã kết nối ví.',
    walletMerged: 'Đã kết nối ví và chuyển {n} credit cùng lịch sử từ tài khoản ví cũ sang.',
    walletUnlinked: 'Đã gỡ kết nối ví.',
    connecting: 'Đang kết nối…',
    signing: 'Ký để xác nhận…',
    howItWorks: 'Cách hoạt động',
    pricing: 'Bảng giá',
    faq: 'Hỏi đáp',
    newChat: 'Cuộc trò chuyện mới',
    searchChats: 'Tìm cuộc trò chuyện',
    noChats: 'Chưa có cuộc trò chuyện nào',
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    earlier: 'Trước đó',
    credits: 'credit',
    topUp: 'Nạp credit',
    history: 'Lịch sử',
    settings: 'Cài đặt',
    logout: 'Đăng xuất',
    placeholder: 'Hỏi Makoto bất cứ điều gì…',
    send: 'Gửi',
    stop: 'Dừng',
    thinking: 'Makoto đang suy nghĩ',
    hello: 'Hôm nay Makoto giúp gì cho bạn?',
    helloSub: 'Hỏi về thị trường, hoặc gửi một tín hiệu để Makoto xác minh.',
    costHint: 'Mỗi câu hỏi tốn {base} credit, cộng {tool} credit cho mỗi công cụ Makoto dùng.',
    noCredits: 'Bạn đã hết credit. Nạp thêm USDC để tiếp tục.',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    rename: 'Đổi tên',
    delete: 'Xóa',
    deleteConfirm: 'Xóa cuộc trò chuyện này?',
    balance: 'Số dư',
    arcBalance: 'USDC trên Arc',
    getTestUsdc: 'Nhận USDC testnet miễn phí',
    buy: 'Mua',
    bestValue: 'Lợi nhất',
    payWith: 'Thanh toán bằng USDC trên Arc Testnet',
    confirmWallet: 'Xác nhận giao dịch trong ví…',
    verifying: 'Đang xác minh trên Arc…',
    paid: 'Nạp thành công',
    deposits: 'Các lần nạp',
    usage: 'Sử dụng credit',
    noDeposits: 'Chưa có lần nạp nào',
    language: 'Ngôn ngữ',
    model: 'Mô hình',
    wallet: 'Ví',
    stats: 'Thống kê',
    conversations: 'Cuộc trò chuyện',
    messages: 'Tin nhắn',
    spent: 'Đã dùng',
    deposited: 'Đã nạp',
    noWallet: 'Không tìm thấy ví. Hãy cài MetaMask hoặc Rabby rồi thử lại.',
    welcome: 'Chào mừng! Bạn được tặng {n} credit để dùng thử.',
    network: 'Mạng',
    used: 'Đã dùng {n} credit',
    retry: 'Thử lại',
    back: 'Quay lại',
    connectTitle: 'Kết nối ví',
    connectSub: 'Chọn ví để kết nối với tài khoản Makoto. Bạn chỉ ký một tin nhắn xác nhận, không tốn phí gas.',
    wrongAccount: 'Ví đang mở tài khoản khác với tài khoản đã đăng nhập. Hãy chọn đúng tài khoản trong ví.',
    rejected: 'Bạn đã từ chối trong ví.',
    reconnect: 'Hãy kết nối lại ví để thanh toán.',
  },
  en: {
    tagline: 'Verify before you invest.',
    sub: 'Makoto is an AI platform for crypto verification. It cross-checks live on-chain and market data, analyzes smart contracts and scores the credibility of any signal in seconds.',
    start: 'Get started',
    connect: 'Connect wallet',
    signIn: 'Continue with Google',
    walletTaken: 'This wallet is already connected to another Makoto account.',
    walletLinked: 'Wallet connected.',
    walletMerged: 'Wallet connected. Moved {n} {n|credit|credits} and your history from your old wallet account.',
    walletUnlinked: 'Wallet disconnected.',
    connecting: 'Connecting…',
    signing: 'Sign to confirm…',
    howItWorks: 'How it works',
    pricing: 'Pricing',
    faq: 'FAQ',
    newChat: 'New chat',
    searchChats: 'Search chats',
    noChats: 'No conversations yet',
    today: 'Today',
    yesterday: 'Yesterday',
    earlier: 'Earlier',
    credits: 'credits',
    topUp: 'Top up',
    history: 'History',
    settings: 'Settings',
    logout: 'Log out',
    placeholder: 'Ask Makoto anything…',
    send: 'Send',
    stop: 'Stop',
    thinking: 'Makoto is thinking',
    hello: 'What can Makoto do for you today?',
    helloSub: 'Ask about the market, or send a signal for Makoto to verify.',
    costHint: 'Each question costs {base} {base|credit|credits}, plus {tool} {tool|credit|credits} per tool Makoto uses.',
    noCredits: 'You are out of credits. Top up with USDC to continue.',
    copy: 'Copy',
    copied: 'Copied',
    rename: 'Rename',
    delete: 'Delete',
    deleteConfirm: 'Delete this conversation?',
    balance: 'Balance',
    arcBalance: 'USDC on Arc',
    getTestUsdc: 'Get free testnet USDC',
    buy: 'Buy',
    bestValue: 'Best value',
    payWith: 'Pay with USDC on Arc Testnet',
    confirmWallet: 'Confirm the transaction in your wallet…',
    verifying: 'Verifying on Arc…',
    paid: 'Top-up complete',
    deposits: 'Deposits',
    usage: 'Credit usage',
    noDeposits: 'No deposits yet',
    language: 'Language',
    model: 'Model',
    wallet: 'Wallet',
    stats: 'Stats',
    conversations: 'Conversations',
    messages: 'Messages',
    spent: 'Spent',
    deposited: 'Deposited',
    noWallet: 'No wallet found. Install MetaMask or Rabby and try again.',
    welcome: 'Welcome! You got {n} free {n|credit|credits} to try Makoto.',
    network: 'Network',
    used: 'Used {n} {n|credit|credits}',
    retry: 'Try again',
    back: 'Back',
    connectTitle: 'Connect a wallet',
    connectSub: 'Pick a wallet to connect to your Makoto account. You only sign a message, no gas.',
    wrongAccount: 'Your wallet is on a different account than the one signed in. Switch accounts in your wallet.',
    rejected: 'Request rejected in your wallet.',
    reconnect: 'Reconnect your wallet to pay.',
  },
} as const

export type TKey = keyof typeof dict.vi

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey, vars?: Record<string, string | number>) => string }
const I18nCtx = createContext<Ctx | null>(null)

/** "1 credit" / "5 credits" in English; Vietnamese has no plural form ("5 credit"). */
export const creditsText = (n: number | string, lang: Lang) => `${n} ${lang === 'en' && Number(n) !== 1 ? 'credits' : 'credit'}`

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('vi')
  useEffect(() => {
    const saved = localStorage.getItem('mk_lang')
    if (saved === 'en' || saved === 'vi') setLangState(saved)
  }, [])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('mk_lang', l)
  }, [])
  const t = useCallback(
    (k: TKey, vars?: Record<string, string | number>) => {
      let s: string = dict[lang][k] ?? dict.vi[k] ?? k
      if (vars) {
        // Plurals: "{n|credit|credits}" picks the singular form when vars.n === 1.
        s = s.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_, key: string, one: string, other: string) => (Number(vars[key]) === 1 ? one : other))
        for (const [key, v] of Object.entries(vars)) s = s.replace(`{${key}}`, String(v))
      }
      return s
    },
    [lang]
  )
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) throw new Error('useI18n outside provider')
  return c
}
