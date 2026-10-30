// Contract security scan via GoPlus Security public API (free, no key, rate-limited).
// Turns raw flags into a short checklist the UI and the judge can both read.

const BASE = 'https://api.gopluslabs.io/api/v1'
const CHAIN_IDS = { ethereum: '1', bsc: '56', polygon: '137', arbitrum: '42161', base: '8453', optimism: '10', avalanche: '43114' }
const ZERO = /^0x0{40}$|^0x0{36}dead$|^$/i

const num = (x) => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
const flag = (x) => (x === '1' || x === 1 ? true : x === '0' || x === 0 ? false : null)

async function get(path, ms = 9000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(`${BASE}${path}`, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (!r.ok) return null
    const j = await r.json()
    if (j?.code !== 1 || !j.result) return null
    const v = Object.values(j.result)[0]
    return v && typeof v === 'object' && Object.keys(v).length ? v : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** One checklist line. ok=true is reassuring, ok=false is a problem. */
const item = (key, ok, severity, vi, en) => ({ key, ok, severity: ok ? 'none' : severity, vi, en })

function evmChecks(d) {
  const owner = String(d.owner_address || '')
  const ownerless = ZERO.test(owner)
  const out = []
  const buyTax = num(d.buy_tax) != null ? num(d.buy_tax) * 100 : null
  const sellTax = num(d.sell_tax) != null ? num(d.sell_tax) * 100 : null
  const honeypot = flag(d.is_honeypot) || flag(d.cannot_buy) || flag(d.cannot_sell_all)

  if (flag(d.is_honeypot) != null) out.push(item('honeypot', !honeypot, 'high', honeypot ? 'Mua được nhưng KHÔNG bán ra được (bẫy honeypot)' : 'Mua và bán bình thường, không phải bẫy honeypot', honeypot ? 'Can buy but NOT sell (honeypot)' : 'Buy and sell work normally'))
  if (buyTax != null || sellTax != null) {
    const worst = Math.max(buyTax || 0, sellTax || 0)
    out.push(item('tax', worst < 1, worst >= 10 ? 'high' : 'medium', worst < 1 ? 'Không có thuế mua/bán ẩn' : `Thuế mua ${(buyTax ?? 0).toFixed(1)}% · thuế bán ${(sellTax ?? 0).toFixed(1)}%`, worst < 1 ? 'No hidden buy/sell tax' : `Buy tax ${(buyTax ?? 0).toFixed(1)}% · sell tax ${(sellTax ?? 0).toFixed(1)}%`))
  }
  if (flag(d.is_open_source) != null) out.push(item('open_source', flag(d.is_open_source), 'high', flag(d.is_open_source) ? 'Mã hợp đồng công khai, ai cũng kiểm tra được' : 'Mã hợp đồng bị giấu, không ai kiểm tra được', flag(d.is_open_source) ? 'Contract source is public' : 'Contract source is hidden'))
  out.push(item('owner', ownerless, 'low', ownerless ? 'Chủ hợp đồng đã từ bỏ quyền kiểm soát' : 'Chủ hợp đồng vẫn còn quyền kiểm soát', ownerless ? 'Ownership renounced' : 'Owner still has control'))

  // Owner powers only matter while someone still holds the keys.
  if (!ownerless) {
    if (flag(d.owner_change_balance)) out.push(item('change_balance', false, 'high', 'Chủ có thể tự sửa số dư ví của người khác', 'Owner can change anyone\'s balance'))
    if (flag(d.is_mintable)) out.push(item('mint', false, 'medium', 'Chủ có thể in thêm token bất cứ lúc nào', 'Owner can mint more tokens'))
    if (flag(d.slippage_modifiable) || flag(d.personal_slippage_modifiable)) out.push(item('tax_change', false, 'high', 'Chủ có thể tăng thuế bán bất cứ lúc nào', 'Owner can raise the sell tax at will'))
    if (flag(d.is_blacklisted)) out.push(item('blacklist', false, 'medium', 'Chủ có thể chặn ví bất kỳ không cho bán', 'Owner can blacklist wallets'))
    if (flag(d.transfer_pausable)) out.push(item('pause', false, 'medium', 'Chủ có thể tạm dừng mọi giao dịch', 'Owner can pause all transfers'))
    if (flag(d.trading_cooldown)) out.push(item('cooldown', false, 'low', 'Có giới hạn thời gian giữa các lần giao dịch', 'Trading cooldown enforced'))
  } else if (flag(d.is_mintable) === false) {
    out.push(item('mint', true, 'medium', 'Không thể in thêm token', 'Supply cannot be minted'))
  }
  if (flag(d.hidden_owner)) out.push(item('hidden_owner', false, 'high', 'Có "chủ ẩn" nắm quyền bí mật', 'Hidden owner detected'))
  if (flag(d.can_take_back_ownership)) out.push(item('take_back', false, 'high', 'Chủ có thể lấy lại quyền dù đã "từ bỏ"', 'Ownership can be reclaimed'))
  if (flag(d.selfdestruct)) out.push(item('selfdestruct', false, 'high', 'Hợp đồng có thể tự hủy', 'Contract can self-destruct'))
  if (flag(d.is_proxy)) out.push(item('proxy', false, 'medium', 'Hợp đồng có thể bị thay ruột (nâng cấp) sau này', 'Upgradeable proxy — logic can change'))
  if (flag(d.honeypot_with_same_creator)) out.push(item('creator_history', false, 'high', 'Người tạo token từng tạo token lừa đảo khác', 'Creator has deployed honeypots before'))

  // Liquidity lock: share of LP tokens locked or burned.
  const lps = Array.isArray(d.lp_holders) ? d.lp_holders : []
  if (lps.length) {
    const locked = lps.reduce((s, h) => s + ((h.is_locked === 1 || ZERO.test(String(h.address || '')) ? num(h.percent) || 0 : 0)), 0) * 100
    const cex = d.is_in_cex?.listed === '1'
    if (!cex || locked >= 50) out.push(item('lp_lock', locked >= 50, 'medium', locked >= 50 ? `${Math.min(100, locked).toFixed(0)}% thanh khoản đã khóa hoặc đốt` : `Chỉ ${locked.toFixed(0)}% thanh khoản bị khóa — chủ có thể rút bất cứ lúc nào`, locked >= 50 ? `${Math.min(100, locked).toFixed(0)}% of liquidity locked/burned` : `Only ${locked.toFixed(0)}% of liquidity locked — can be pulled`))
  }

  return {
    honeypot: honeypot ?? null,
    buy_tax_pct: buyTax,
    sell_tax_pct: sellTax,
    ownerless,
    holder_count: num(d.holder_count),
    creator_pct: num(d.creator_percent) != null ? num(d.creator_percent) * 100 : null,
    owner_pct: num(d.owner_percent) != null ? num(d.owner_percent) * 100 : null,
    cex_list: d.is_in_cex?.cex_list || [],
    checks: out,
  }
}

function solChecks(d) {
  const on = (x) => x?.status === '1'
  const out = []
  out.push(item('mint', !on(d.mintable), 'high', on(d.mintable) ? 'Vẫn còn người in thêm được token' : 'Không ai in thêm được token', on(d.mintable) ? 'Mint authority still active' : 'Mint authority revoked'))
  out.push(item('freeze', !on(d.freezable), 'high', on(d.freezable) ? 'Có người đóng băng được ví của bạn (không bán được)' : 'Không ai đóng băng được ví người giữ', on(d.freezable) ? 'Freeze authority active' : 'No freeze authority'))
  if (on(d.balance_mutable_authority)) out.push(item('change_balance', false, 'high', 'Có người sửa được số dư ví của người khác', 'Balances can be changed by an authority'))
  if (on(d.closable)) out.push(item('closable', false, 'high', 'Token có thể bị đóng/xóa', 'Token can be closed'))
  if (d.non_transferable === '1') out.push(item('non_transferable', false, 'high', 'Token không chuyển/bán được', 'Token is non-transferable'))
  const fee = d.transfer_fee && Object.keys(d.transfer_fee).length ? d.transfer_fee : null
  const feePct = fee ? (num(fee.fee_rate) ?? 0) * 100 : 0
  out.push(item('tax', feePct < 1, feePct >= 10 ? 'high' : 'medium', feePct < 1 ? 'Không có phí chuyển ẩn' : `Mỗi lần chuyển bị trừ ${feePct.toFixed(1)}%`, feePct < 1 ? 'No transfer fee' : `${feePct.toFixed(1)}% transfer fee`))
  if (on(d.transfer_fee_upgradable)) out.push(item('tax_change', false, 'high', 'Phí chuyển có thể bị tăng sau này', 'Transfer fee can be raised'))
  if (Array.isArray(d.transfer_hook) && d.transfer_hook.length) out.push(item('hook', false, 'medium', 'Có đoạn mã chạy kèm mỗi giao dịch (có thể chặn bán)', 'Transfer hook can block transfers'))
  if (on(d.metadata_mutable)) out.push(item('metadata', false, 'low', 'Tên/biểu tượng token có thể bị đổi', 'Name/logo can be changed'))
  return {
    honeypot: on(d.freezable) || d.non_transferable === '1' ? null : false,
    buy_tax_pct: null,
    sell_tax_pct: feePct || 0,
    ownerless: !on(d.mintable) && !on(d.freezable),
    holder_count: num(d.holder_count),
    creator_pct: null,
    owner_pct: null,
    cex_list: [],
    trusted: d.trusted_token === 1,
    checks: out,
  }
}

/**
 * Scan a token contract. If `chain` is unknown, tries the main EVM chains in parallel.
 * Returns null when GoPlus has no data (unsupported chain, brand-new token, rate limit).
 */
async function securityScan(address, chain) {
  if (!address) return null
  if (chain === 'solana' || (!/^0x/i.test(address) && !chain)) {
    const d = await get(`/solana/token_security?contract_addresses=${encodeURIComponent(address)}`)
    return d ? { chain: 'solana', source: 'GoPlus Security', ...solChecks(d) } : null
  }
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return null
  const chains = chain && CHAIN_IDS[chain] ? [chain] : ['ethereum', 'bsc', 'base', 'arbitrum']
  const results = await Promise.all(chains.map(async (c) => ({ c, d: await get(`/token_security/${CHAIN_IDS[c]}?contract_addresses=${address.toLowerCase()}`) })))
  const hit = results.find((r) => r.d && (r.d.token_symbol || r.d.holder_count))
  if (!hit) return null
  return { chain: hit.c, source: 'GoPlus Security', token_name: hit.d.token_name || null, token_symbol: hit.d.token_symbol || null, ...evmChecks(hit.d) }
}

module.exports = { securityScan }
