export const ARC = {
  chainId: 5042002,
  chainIdHex: '0x4cef52',
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.io',
  explorer: 'https://explorer.testnet.arc.io',
  faucet: 'https://faucet.circle.com',
}

import { getProvider, type Eip1193 } from './wallets/walletProviders'
export type { Eip1193 }

/** The wallet the user picked in the connect dialog (EIP-6963 / WalletConnect). */
export function getEthereum(): Eip1193 | null {
  if (typeof window === 'undefined') return null
  return getProvider() ?? null
}

export const hasWallet = () => Boolean(getEthereum())

function requireEth(p?: Eip1193): Eip1193 {
  const eth = p ?? getEthereum()
  if (!eth) throw new Error('NO_WALLET')
  return eth
}

export async function requestAccount(p?: Eip1193): Promise<string> {
  const accounts = (await requireEth(p).request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts?.[0]) throw new Error('No account selected')
  return accounts[0].toLowerCase()
}

export async function getChainId(p?: Eip1193): Promise<number | null> {
  const eth = p ?? getEthereum()
  if (!eth) return null
  const hex = (await eth.request({ method: 'eth_chainId' })) as string
  return parseInt(hex, 16)
}

export async function ensureArc(p?: Eip1193): Promise<void> {
  const eth = requireEth(p)
  if ((await getChainId(eth)) === ARC.chainId) return
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC.chainIdHex }] })
  } catch (e) {
    const code = (e as { code?: number })?.code
    if (code === 4001) throw new Error('Network switch was rejected')
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: ARC.chainIdHex,
        chainName: ARC.name,
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: [ARC.rpcUrl],
        blockExplorerUrls: [ARC.explorer],
      }],
    })
  }
}

function toHexUtf8(s: string) {
  return '0x' + Array.from(new TextEncoder().encode(s)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signMessage(address: string, message: string, p?: Eip1193): Promise<string> {
  return (await requireEth(p).request({ method: 'personal_sign', params: [toHexUtf8(message), address] })) as string
}

/** Send native USDC on Arc (18 decimals). Returns tx hash. */
export async function sendUsdc(from: string, to: string, usdc: string): Promise<string> {
  await ensureArc()
  const [whole, frac = ''] = usdc.split('.')
  const wei = BigInt(whole) * 10n ** 18n + BigInt((frac + '0'.repeat(18)).slice(0, 18))
  return (await requireEth().request({
    method: 'eth_sendTransaction',
    params: [{ from, to, value: '0x' + wei.toString(16) }],
  })) as string
}

export const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
