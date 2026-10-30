import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { FileText, ShieldCheck, WifiOff, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Overlay } from './CommandPalette'

/* ---------------- Page metadata (search engines, link previews, browser) ---------------- */

const META = {
  vi: {
    title: 'Makoto: Nền tảng AI xác minh thông tin crypto',
    desc: 'Makoto xác minh tín hiệu, tin đồn và token crypto bằng dữ liệu on-chain và thị trường theo thời gian thực, trả về điểm tin cậy kèm phân tích chi tiết. Thanh toán theo mức sử dụng bằng USDC.',
  },
  en: {
    title: 'Makoto: AI-powered crypto verification',
    desc: 'Makoto verifies crypto signals, rumors and tokens against live on-chain and market data, returning a credibility score with detailed analysis. Usage-based pricing in USDC.',
  },
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

export function useSiteHead() {
  const { lang } = useI18n()
  useEffect(() => {
    const m = META[lang]
    document.documentElement.lang = lang
    document.title = m.title
    setMeta('name', 'description', m.desc)
    setMeta('name', 'application-name', 'Makoto')
    setMeta('name', 'apple-mobile-web-app-title', 'Makoto')
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', 'Makoto')
    setMeta('property', 'og:title', m.title)
    setMeta('property', 'og:description', m.desc)
    setMeta('property', 'og:url', location.origin + location.pathname)
    setMeta('property', 'og:locale', lang === 'vi' ? 'vi_VN' : 'en_US')
    setMeta('name', 'twitter:card', 'summary')
    setMeta('name', 'twitter:title', m.title)
    setMeta('name', 'twitter:description', m.desc)
  }, [lang])
}

/* ---------------- Connection lost banner ---------------- */

export function OfflineBanner() {
  const { lang } = useI18n()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [back, setBack] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const on = () => { setOnline(true); setBack(true); t = setTimeout(() => setBack(false), 2500) }
    const off = () => { setOnline(false); setBack(false) }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearTimeout(t) }
  }, [])
  const show = !online || back
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className={`fixed left-1/2 top-3 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-xl backdrop-blur-xl ${online ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' : 'border-amber-400/30 bg-amber-500/15 text-amber-100'}`}
        >
          <WifiOff className={`h-4 w-4 ${online ? 'hidden' : ''}`} />
          {online
            ? lang === 'vi' ? 'Đã kết nối lại' : 'Back online'
            : lang === 'vi' ? 'Mất kết nối mạng. Makoto sẽ tự tiếp tục khi có mạng lại.' : "You're offline. Makoto will resume when you reconnect."}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------------- Terms of use & privacy ---------------- */

export type LegalDoc = 'terms' | 'privacy'
const UPDATED = '28/10/2026'

const DOCS: Record<LegalDoc, Record<'vi' | 'en', { title: string; intro: string; sections: [string, string][] }>> = {
  terms: {
    vi: {
      title: 'Điều khoản sử dụng',
      intro: 'Khi đăng nhập và dùng Makoto, bạn đồng ý với các điều khoản dưới đây.',
      sections: [
        ['Dịch vụ', 'Makoto là nền tảng AI xác minh thông tin crypto (chấm điểm tin cậy cho tín hiệu, tin đồn, địa chỉ token) và trả lời câu hỏi về giá, tin tức, ví và mạng Arc. Makoto hiện chạy trên Arc Testnet: USDC dùng để nạp credit là tiền thử nghiệm, không có giá trị thật.'],
        ['Không phải lời khuyên đầu tư', 'Câu trả lời, bản tin và mọi nội dung do AI tạo ra chỉ mang tính tham khảo. AI có thể sai hoặc thiếu thông tin. Bạn tự chịu trách nhiệm với quyết định của mình; hãy luôn tự kiểm tra lại.'],
        ['Tài khoản', 'Bạn đăng nhập bằng tài khoản Google. Ví crypto là tùy chọn: bạn có thể kết nối ví trong Cài đặt → Kết nối bằng cách ký một tin nhắn xác nhận (không tốn phí) để nạp credit. Makoto không bao giờ hỏi khóa riêng (private key) hay cụm từ khôi phục (seed phrase) của bạn. Ai yêu cầu những thứ này đều là lừa đảo.'],
        ['Credit và thanh toán', 'Credit được cộng sau khi giao dịch USDC đến ví kho bạc của Makoto được xác nhận trên chuỗi. Credit không hết hạn, không chuyển nhượng và không hoàn lại. Giao dịch trên blockchain không thể đảo ngược, hãy kiểm tra kỹ trước khi gửi.'],
        ['Sử dụng hợp lý', 'Không dùng Makoto để làm việc phạm pháp, lừa đảo, spam hay cố tình làm quá tải hệ thống. Để bảo vệ dịch vụ, Makoto giới hạn số lượt hỏi trong một khoảng thời gian.'],
        ['Thay đổi', 'Makoto có thể cập nhật tính năng, bảng giá hoặc các điều khoản này. Thay đổi quan trọng sẽ được thông báo trên trang.'],
      ],
    },
    en: {
      title: 'Terms of use',
      intro: 'By signing in and using Makoto, you agree to the terms below.',
      sections: [
        ['The service', 'Makoto is an AI assistant that answers questions about crypto, prices, news, wallets and the Arc network. It currently runs on Arc Testnet: the USDC used to buy credits is test money with no real value.'],
        ['Not financial advice', 'Answers, briefings and all AI-generated content are for information only. AI can be wrong or incomplete. You are responsible for your own decisions; always double-check.'],
        ['Your account', 'You sign in with your Google account. A crypto wallet is optional: connect one in Settings → Connections by signing a free confirmation message to top up credits. Makoto will never ask for your private key or recovery phrase. Anyone who does is a scammer.'],
        ['Credits and payment', 'Credits are added once a USDC transfer to the Makoto treasury is confirmed on-chain. Credits do not expire and are non-transferable and non-refundable. Blockchain transfers cannot be reversed, so check carefully before sending.'],
        ['Fair use', 'Do not use Makoto for illegal activity, scams, spam or to deliberately overload the service. To protect the service, Makoto limits how many requests you can make in a short time.'],
        ['Changes', 'Makoto may update features, pricing or these terms. Important changes will be announced on the site.'],
      ],
    },
  },
  privacy: {
    vi: {
      title: 'Chính sách quyền riêng tư',
      intro: 'Makoto chỉ lưu những gì cần để dịch vụ hoạt động.',
      sections: [
        ['Những gì Makoto lưu', 'Tên, email và ảnh đại diện từ tài khoản Google của bạn; địa chỉ ví nếu bạn kết nối; số credit và lịch sử nạp, các cuộc trò chuyện, danh sách theo dõi, bản tin hằng ngày, những điều Makoto ghi nhớ (bạn xem và xóa được) và cài đặt. Makoto không lưu số điện thoại hay mật khẩu Google của bạn.'],
        ['Những gì Makoto không bao giờ có', 'Khóa bí mật, cụm từ khôi phục hay quyền chuyển tiền từ ví của bạn. Ký tin nhắn kết nối ví không cho phép ai lấy tiền của bạn.'],
        ['Xử lý câu hỏi', 'Để trả lời, nội dung câu hỏi được gửi tới nhà cung cấp mô hình AI (OpenAI) và các nguồn dữ liệu thị trường. Đừng gửi thông tin nhạy cảm vào khung chat.'],
        ['Dữ liệu trên chuỗi', 'Số dư và giao dịch trên Arc là công khai với tất cả mọi người. Makoto chỉ đọc dữ liệu công khai này.'],
        ['Bộ nhớ trình duyệt', 'Makoto lưu phiên đăng nhập và tùy chọn giao diện trong trình duyệt của bạn. Không dùng cookie quảng cáo hay công cụ theo dõi.'],
        ['Quyền của bạn', 'Trong Cài đặt, bạn có thể tải về toàn bộ cuộc trò chuyện hoặc xóa hết bất cứ lúc nào. Đăng xuất sẽ xóa phiên trên thiết bị này.'],
      ],
    },
    en: {
      title: 'Privacy policy',
      intro: 'Makoto only keeps what it needs to work.',
      sections: [
        ['What Makoto stores', 'Your name, email and profile photo from Google; your wallet address if you connect one; credits and deposit history, conversations, watchlist, daily briefings, what Makoto remembers about you (you can view and delete it) and settings. Makoto never stores your phone number or Google password.'],
        ['What Makoto never has', 'Your private key, recovery phrase or any ability to move funds from your wallet. Signing the wallet connection message does not let anyone take your money.'],
        ['How questions are processed', 'To answer, your question is sent to the AI model provider (OpenAI) and market data sources. Do not put sensitive information in the chat.'],
        ['On-chain data', 'Balances and transactions on Arc are public to everyone. Makoto only reads this public data.'],
        ['Browser storage', 'Makoto keeps your login session and interface preferences in your browser. No advertising cookies or trackers are used.'],
        ['Your choices', 'In Settings you can download all your conversations or delete them at any time. Logging out removes the session from this device.'],
      ],
    },
  },
}

const readHash = (): LegalDoc | null => {
  const h = typeof location === 'undefined' ? '' : location.hash.replace('#', '')
  return h === 'terms' || h === 'privacy' ? h : null
}

/** Open a legal page from anywhere (also works as plain `href="#terms"` links). */
export function openLegal(doc: LegalDoc) {
  if (location.hash !== `#${doc}`) location.hash = doc
  else window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function LegalDialog() {
  const { lang } = useI18n()
  const [doc, setDoc] = useState<LegalDoc | null>(readHash)
  useEffect(() => {
    const on = () => setDoc(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const close = useCallback(() => {
    setDoc(null)
    if (readHash()) history.replaceState(null, '', location.pathname + location.search)
  }, [])
  const d = doc ? DOCS[doc][lang] : null
  return (
    <Overlay open={!!d} onClose={close} className="max-w-2xl" layer="z-[80]">
      {d && (
        <div className="flex max-h-[76vh] flex-col">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-6 py-4">
            {doc === 'terms' ? <FileText className="h-4 w-4 text-teal-300" /> : <ShieldCheck className="h-4 w-4 text-teal-300" />}
            <h2 className="text-base font-semibold text-white">{d.title}</h2>
            <div className="ml-auto flex items-center gap-1 rounded-full bg-white/[0.04] p-0.5 text-xs">
              {(['terms', 'privacy'] as const).map((k) => (
                <button key={k} onClick={() => openLegal(k)} className={`min-h-8 rounded-full px-3 py-1 transition ${doc === k ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {k === 'terms' ? (lang === 'vi' ? 'Điều khoản' : 'Terms') : lang === 'vi' ? 'Quyền riêng tư' : 'Privacy'}
                </button>
              ))}
            </div>
            <button onClick={close} aria-label={lang === 'vi' ? 'Đóng' : 'Close'} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="mk-scroll overflow-y-auto px-6 py-5">
            <p className="text-sm text-zinc-300">{d.intro}</p>
            <ol className="mt-5 space-y-5">
              {d.sections.map(([h, body], i) => (
                <li key={h}>
                  <h3 className="text-sm font-semibold text-white">{i + 1}. {h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-zinc-600">{lang === 'vi' ? 'Cập nhật lần cuối' : 'Last updated'}: {UPDATED}</p>
          </div>
        </div>
      )}
    </Overlay>
  )
}
