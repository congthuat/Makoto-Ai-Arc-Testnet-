require('../lib/safe')
const { Router } = require('express')
const { formatEther, parseEther } = require('viem')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')
const { limit } = require('../lib/ratelimit')
const { PACKAGES, TREASURY, ARC } = require('../lib/config')
const { getTransaction, isHash } = require('../lib/arc')

const router = Router()

router.get('/packages', (_req, res) => {
  res.json({ packages: PACKAGES, treasury: TREASURY, network: ARC })
})

// Verify a native-USDC transfer on Arc Testnet and credit the sender.
router.post('/verify', requireAuth, limit('pay', 12, 60_000), async (req, res) => {
  try {
    const hash = String(req.body?.txHash || '').toLowerCase()
    const pkg = PACKAGES.find((p) => p.id === req.body?.packageId)
    if (!isHash(hash)) return res.status(400).json({ error: 'Invalid transaction hash' })
    if (!pkg) return res.status(400).json({ error: 'Unknown package' })

    const existing = await dbQuery(`SELECT * FROM mk_deposits WHERE tx_hash = $1`, [hash])
    if (existing.rows[0]) {
      if (existing.rows[0].address !== req.user.address) return res.status(409).json({ error: 'This transaction was already used.' })
      return res.json({ status: 'confirmed', deposit: existing.rows[0], credits: req.user.credits, duplicate: true })
    }

    let tx, receipt
    try {
      ;({ tx, receipt } = await getTransaction(hash))
    } catch {
      return res.json({ status: 'pending' })
    }
    if (!receipt) return res.json({ status: 'pending' })
    if (receipt.status !== 'success') return res.status(400).json({ error: 'Transaction failed on Arc.' })
    if (Number(tx.chainId) !== ARC.chainId) return res.status(400).json({ error: 'Transaction is not on Arc Testnet.' })
    if (!req.user.wallet) return res.status(400).json({ error: 'NO_WALLET' })
    if (tx.from?.toLowerCase() !== req.user.wallet) return res.status(400).json({ error: 'Transaction was not sent from your connected wallet.' })
    if (tx.to?.toLowerCase() !== TREASURY) return res.status(400).json({ error: 'Transaction was not sent to the Makoto wallet.' })
    if (tx.value < parseEther(pkg.usdc)) return res.status(400).json({ error: `Amount is below ${pkg.usdc} USDC.` })

    const amount = formatEther(tx.value)
    // One statement: record the deposit, add the credits and write the ledger together,
    // so a transaction can never be marked used without the credits landing.
    const ins = await dbQuery(
      `WITH d AS (
         INSERT INTO mk_deposits (tx_hash, address, amount_usdc, credits, block_number) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tx_hash) DO NOTHING RETURNING *
       ), u AS (
         UPDATE mk_users SET credits = credits + $4, total_deposited_credits = total_deposited_credits + $4
         WHERE address = $2 AND EXISTS (SELECT 1 FROM d) RETURNING credits
       ), l AS (
         INSERT INTO mk_ledger (address, delta, reason, ref) SELECT $2, $4, 'deposit', $1 FROM d RETURNING id
       )
       SELECT d.*, (SELECT credits FROM u) AS balance FROM d`,
      [hash, req.user.address, amount, pkg.credits, Number(receipt.blockNumber)]
    )
    if (!ins.rows[0]) return res.status(409).json({ error: 'This transaction was already used.', code: 'TX_USED' })
    const { balance, ...deposit } = ins.rows[0]
    res.json({ status: 'confirmed', deposit, credits: balance })
  } catch (e) {
    console.error('[payments]', e?.message)
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
