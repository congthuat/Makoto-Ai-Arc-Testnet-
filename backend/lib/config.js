const fs = require('node:fs')
const path = require('node:path')

// Load backend/.env regardless of the process cwd (secrets live server-side only).
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const ARC = {
  chainId: 5042002,
  chainIdHex: '0x4cef52',
  name: 'Arc Testnet',
  rpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.io',
  explorer: 'https://explorer.testnet.arc.io',
  faucet: 'https://faucet.circle.com',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
}

// Credit packages: price in USDC (native, 18 decimals on Arc)
const PACKAGES = [
  { id: 'starter', usdc: '1', credits: 100, bonus: 0 },
  { id: 'plus', usdc: '5', credits: 550, bonus: 10 },
  { id: 'pro', usdc: '10', credits: 1200, bonus: 20 },
  { id: 'max', usdc: '25', credits: 3250, bonus: 30 },
]

const MODELS = {
  // base = credits per question; tool = credits per data tool used (capped at 6 tools' worth).
  fast: { id: 'gpt-5-mini', label: 'Makoto Fast', base: 1, tool: 1, reasoning: 'low' },
  // gpt-5.5 rejects function tools + reasoning_effort on /chat/completions unless effort is 'none'.
  pro: { id: 'gpt-5.5', label: 'Makoto Pro', base: 5, tool: 2, reasoning: 'low', toolReasoning: 'none' },
}

// Fallback: read a value straight from backend/.env if the process env doesn't carry it.
function fromEnvFile(name) {
  try {
    const txt = require('fs').readFileSync(require('path').join(__dirname, '..', '.env'), 'utf8')
    const m = txt.match(new RegExp('^\\s*' + name + '\\s*=\\s*(\\S+)', 'm'))
    return m ? m[1].trim() : ''
  } catch { return '' }
}

module.exports = {
  ARC,
  PACKAGES,
  MODELS,
  TREASURY: (process.env.TREASURY_ADDRESS || '0x16299b74c616994eaecb9b20e37d369d5d62586b').toLowerCase(),
  OPENAI_API_KEY: (process.env.OPPENAI || process.env.OPENAI || process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || fromEnvFile('OPENAI_API_KEY') || '').trim(),
  WELCOME_CREDITS: 20,
  TOOL_CREDIT: 1,
  MAX_TOOL_ROUNDS: 6,
  MAX_INPUT_CHARS: 4000,
}
