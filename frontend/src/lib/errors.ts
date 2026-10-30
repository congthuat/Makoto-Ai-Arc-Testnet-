// Turn raw server messages into short, friendly text in the user's language.
type Lang = 'vi' | 'en'

const RULES: [RegExp, string, string][] = [
  [/too many|rate_limited/i, 'Bạn thao tác hơi nhanh. Đợi một phút rồi thử lại nhé.', 'You’re going a bit fast. Wait a minute and try again.'],
  [/not enough credits|NO_CREDITS/i, 'Bạn đã hết credit. Nạp thêm để tiếp tục.', 'You’re out of credits. Top up to continue.'],
  [/had trouble answering/i, 'Makoto gặp sự cố khi trả lời. Vui lòng thử lại.', 'Makoto had trouble answering. Please try again.'],
  [/AI service is not configured/i, 'Dịch vụ AI đang tạm gián đoạn. Vui lòng thử lại sau.', 'The AI service is temporarily unavailable. Please try again later.'],
  [/message is empty/i, 'Bạn chưa nhập nội dung.', 'Please type a message.'],
  [/message is too long/i, 'Tin nhắn quá dài (tối đa 4.000 ký tự).', 'Message is too long (max 4,000 characters).'],
  [/sign in again|sign in with google/i, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng Google.', 'Your session has expired. Please sign in again with Google.'],
  [/google sign-in failed|invalid google token|google sign-in expired/i, 'Đăng nhập Google không thành công. Vui lòng thử lại.', 'Google sign-in failed. Please try again.'],
  [/not for this app/i, 'Tài khoản Google này không dùng được cho Makoto.', 'This Google sign-in is not valid for Makoto.'],
  [/email is not verified/i, 'Email Google của bạn chưa được xác minh.', 'Your Google email is not verified.'],
  [/request expired|login request expired|EXPIRED/i, 'Yêu cầu đã hết hạn. Vui lòng thử lại.', 'The request expired. Please try again.'],
  [/signature does not match|BAD_SIGNATURE/i, 'Chữ ký không khớp với ví này. Vui lòng thử lại.', 'The signature doesn’t match this wallet. Please try again.'],
  [/invalid wallet address/i, 'Địa chỉ ví không hợp lệ.', 'Invalid wallet address.'],
  [/invalid transaction hash/i, 'Mã giao dịch không hợp lệ.', 'Invalid transaction hash.'],
  [/already used|TX_USED/i, 'Giao dịch này đã được dùng để nạp credit trước đó.', 'This transaction was already used.'],
  [/transaction failed on arc/i, 'Giao dịch bị lỗi trên Arc, chưa có tiền nào được chuyển.', 'The transaction failed on Arc; no funds were moved.'],
  [/not on arc testnet/i, 'Giao dịch không nằm trên mạng Arc Testnet.', 'The transaction is not on Arc Testnet.'],
  [/NO_WALLET/, 'Hãy kết nối ví trước khi nạp credit.', 'Connect a wallet before topping up.'],
  [/not sent from your connected wallet/i, 'Giao dịch không được gửi từ ví bạn đã kết nối.', 'The transaction wasn’t sent from your connected wallet.'],
  [/not sent to the makoto wallet/i, 'Giao dịch không được gửi tới ví kho bạc Makoto.', 'The transaction wasn’t sent to the Makoto treasury wallet.'],
  [/amount is below/i, 'Số USDC đã gửi thấp hơn giá gói đã chọn.', 'The amount sent is below the package price.'],
  [/unknown package/i, 'Gói nạp không hợp lệ.', 'Unknown package.'],
  [/conversation not found/i, 'Không tìm thấy cuộc trò chuyện.', 'Conversation not found.'],
  [/GOOGLE_NOT_CONFIGURED/, 'Đăng nhập tạm thời gián đoạn. Vui lòng thử lại sau.', 'Sign-in is temporarily unavailable. Please try again later.'],
  [/arc network is unreachable/i, 'Mạng Arc đang không phản hồi. Vui lòng thử lại sau ít phút.', 'The Arc network is unreachable right now. Please try again shortly.'],
  [/WALLET_TAKEN/, 'Ví này đã gắn với một tài khoản khác.', 'This wallet is already linked to another account.'],
  [/this wallet is your login/i, 'Ví này đang là tài khoản đăng nhập của bạn.', 'This wallet is your login.'],
  [/missing (google credential|address or signature)/i, 'Thiếu thông tin đăng nhập. Vui lòng thử lại.', 'Missing sign-in details. Please try again.'],
  [/server_error|something went wrong|request failed|failed to fetch|networkerror/i, 'Có lỗi xảy ra. Vui lòng thử lại.', 'Something went wrong. Please try again.'],
]

export function friendlyError(raw: unknown, lang: Lang, fallback?: string): string {
  const msg = String((raw as Error)?.message ?? raw ?? '').trim()
  for (const [re, vi, en] of RULES) if (re.test(msg)) return lang === 'vi' ? vi : en
  if (msg && (lang === 'en' || /[à-ỹđ]/i.test(msg))) return msg.slice(0, 160)
  return fallback || (lang === 'vi' ? 'Có lỗi xảy ra. Vui lòng thử lại.' : 'Something went wrong. Please try again.')
}
