import { useId, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Eyebrow, EASE, fadeUp } from './shared'

export function Faq() {
  const { t, lang } = useI18n()
  const vi = lang === 'vi'
  const [open, setOpen] = useState<number | null>(0)
  const uid = useId()

  const faqs: { q: string; a: string; link?: string }[] = [
    {
      q: vi ? 'Makoto xác minh một tín hiệu như thế nào?' : 'How does Makoto verify a signal?',
      a: vi
        ? 'Makoto tách tín hiệu thành từng nhận định và đối chiếu với dữ liệu thị trường, tin tức và dữ liệu on-chain. Hệ thống kiểm tra việc niêm yết trên sàn, lịch mở khóa token, vị thế thực tế của các ví KOL và phân tích hợp đồng thông minh. Sau khi đánh giá cả góc nhìn ủng hộ lẫn phản biện, Makoto đưa ra điểm tin cậy từ 0 đến 100 kèm lý do cụ thể.'
        : 'Makoto breaks a signal into individual claims and cross-checks each against market data, news and on-chain data. It verifies exchange listings, token unlock schedules, actual KOL wallet positions and the smart contract itself. After weighing both the bull and bear case, it returns a 0 to 100 credibility score with specific reasons.',
    },
    {
      q: vi ? 'Dữ liệu được lấy từ đâu?' : 'Where does the data come from?',
      a: vi
        ? 'Makoto truy vấn dữ liệu tại thời điểm bạn hỏi: giá và khối lượng giao dịch, dữ liệu on-chain, tin tức từ các nguồn uy tín, thông tin dự án và dữ liệu mạng Arc. Mỗi câu trả lời đều dựa trên dữ liệu thực, không dựa trên phỏng đoán.'
        : 'Makoto queries data at the moment you ask: prices and volume, on-chain data, news from reputable sources, project information and Arc network data. Every answer is grounded in live data, not guesswork.',
    },
    {
      q: vi ? 'Mô hình tính phí như thế nào?' : 'How does pricing work?',
      a: vi
        ? 'Makoto tính phí theo mức sử dụng bằng credit. Makoto Fast: 1 credit mỗi câu hỏi, cộng 1 credit cho mỗi công cụ dữ liệu được sử dụng. Makoto Pro: 5 credit mỗi câu hỏi, cộng 2 credit cho mỗi công cụ. Mỗi câu hỏi dùng tối đa 6 công cụ. Mỗi lần xác minh: 3 credit. Tài khoản mới nhận 20 credit, credit không có thời hạn sử dụng.'
        : 'Makoto uses usage-based credits. Makoto Fast: 1 credit per question plus 1 per data tool used. Makoto Pro: 5 credits per question plus 2 per tool. Up to 6 tools per question. Each verification: 3 credits. New accounts receive 20 credits, and credits never expire.',
    },
    {
      q: vi ? 'Những tính năng nào miễn phí?' : 'Which features are free?',
      a: vi
        ? 'Danh sách theo dõi, bản tin thị trường hằng ngày, hồ sơ dự án và công cụ tra cứu ví trên Arc đều miễn phí. Credit chỉ được trừ khi bạn đặt câu hỏi hoặc thực hiện xác minh.'
        : 'The watchlist, daily market briefing, project profiles and Arc wallet explorer are free. Credits are only used for questions and verifications.',
    },
    {
      q: vi ? 'Có cần ví crypto để sử dụng không?' : 'Do I need a crypto wallet?',
      a: vi
        ? 'Không. Tài khoản được tạo bằng Google. Ví chỉ cần thiết khi nạp credit bằng USDC và hỗ trợ hầu hết ví EVM phổ biến, bao gồm WalletConnect.'
        : 'No. Accounts are created with Google. A wallet is only needed to top up credits with USDC, and most popular EVM wallets are supported, including WalletConnect.',
    },
    {
      q: vi ? 'Vì sao Makoto sử dụng Arc và USDC?' : 'Why Arc and USDC?',
      a: vi
        ? 'Arc là blockchain Layer 1 do Circle phát triển, sử dụng USDC làm phí giao dịch. Chi phí ổn định, dễ dự đoán và không cần nắm giữ thêm token nào khác.'
        : "Arc is Circle's Layer 1 blockchain and uses USDC for fees. Costs are stable and predictable, with no extra token required.",
    },
    {
      q: vi ? 'Makoto có quyền truy cập tài sản của tôi không?' : 'Can Makoto access my funds?',
      a: vi
        ? 'Không. Makoto không lưu giữ tài sản và không bao giờ yêu cầu private key hay cụm từ khôi phục. Khi kết nối ví, bạn chỉ ký một tin nhắn xác nhận và tự phê duyệt mọi giao dịch nạp credit.'
        : 'No. Makoto never holds funds and never asks for a private key or recovery phrase. When you connect a wallet you only sign a confirmation message and approve every top-up yourself.',
    },
    {
      q: vi ? 'Kết quả của Makoto có phải là lời khuyên đầu tư?' : 'Is Makoto financial advice?',
      a: vi
        ? 'Không. Makoto chỉ đọc và phân tích dữ liệu, không thực hiện giao dịch thay bạn. Mọi kết quả chỉ mang tính tham khảo; quyết định đầu tư thuộc về bạn.'
        : 'No. Makoto only reads and analyzes data and never transacts on your behalf. All results are for information only; investment decisions remain yours.',
    },
  ]

  return (
    <section id="faq" className="mx-auto max-w-6xl scroll-mt-3 px-5 py-24 md:px-6 md:py-32">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <motion.div {...fadeUp} className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>{t('faq')}</Eyebrow>
          <h2 className="mt-4 text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-white md:text-[44px]">
            {vi ? 'Câu hỏi thường gặp' : 'Frequently asked questions'}
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-zinc-400">
            {vi ? 'Thông tin về cách Makoto hoạt động, chi phí và bảo mật.' : 'How Makoto works, what it costs and how it keeps you safe.'}
          </p>
        </motion.div>

        <motion.div {...fadeUp} className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {faqs.map((f, i) => {
            const isOpen = open === i
            const panelId = `${uid}-panel-${i}`
            const btnId = `${uid}-btn-${i}`
            return (
              <div key={i}>
                <h3>
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] font-medium text-white transition-colors hover:text-teal-100"
                  >
                    {f.q}
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${isOpen ? 'border-teal-300/30 bg-teal-300/10' : 'border-white/10 group-hover:border-white/20'}`}>
                      <Plus className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? 'rotate-45 text-teal-200' : 'text-zinc-400'}`} />
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={btnId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl pb-6 pr-12 text-sm leading-relaxed text-zinc-400">
                        {f.a}
                        {f.link && (
                          <>
                            {' '}
                            <a href={f.link} target="_blank" rel="noreferrer" className="text-teal-300 underline decoration-teal-300/30 underline-offset-4 hover:decoration-teal-300">
                              {vi ? 'Mở faucet' : 'Open faucet'}
                            </a>
                          </>
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
