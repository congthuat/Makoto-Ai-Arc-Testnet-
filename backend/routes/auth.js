require('../lib/safe')
const { Router } = require('express')
const crypto = require('node:crypto')
const { verifyMessage, isAddress } = require('viem')
const { dbQuery } = require('@surf-ai/sdk/db')
const { WELCOME_CREDITS } = require('../lib/config')
const { requireAuth, googleClientId, isLegacyWallet } = require('../lib/auth')
const { limit } = require('../lib/ratelimit')

const router = Router()

const loginMessage = (address, nonce) =>
  `Welcome to Makoto!\n\nSign this message to log in. It costs no gas.\n\nWallet: ${address}\nNonce: ${nonce}`
const linkMessage = (address, account, nonce) =>
  `Connect this wallet to your Makoto account.\n\nThis only proves you own the wallet. It costs no gas and cannot move your funds.\n\nAccount: ${account}\nWallet: ${address}\nNonce: ${nonce}`

async function newSession(address) {
  const token = crypto.randomBytes(32).toString('hex')
  await dbQuery(`INSERT INTO mk_sessions (token, address) VALUES ($1, $2)`, [token, address])
  return token
}

async function welcome(address) {
  await dbQuery(`INSERT INTO mk_ledger (address, delta, reason) VALUES ($1, $2, 'welcome')`, [address, WELCOME_CREDITS])
}

async function saveNonce(address) {
  const nonce = crypto.randomBytes(12).toString('hex')
  await dbQuery(
    `INSERT INTO mk_nonces (address, nonce, created_at) VALUES ($1, $2, NOW())
     ON CONFLICT (address) DO UPDATE SET nonce = $2, created_at = NOW()`,
    [address, nonce]
  )
  return nonce
}

// Single-use: the nonce is deleted in the same statement that reads it, so a signature can't be replayed.
async function takeNonce(address) {
  const { rows } = await dbQuery(`DELETE FROM mk_nonces WHERE address = $1 RETURNING nonce, created_at > NOW() - INTERVAL '10 minutes' AS fresh`, [address])
  return rows[0]?.fresh ? rows[0].nonce : null
}
// Link nonces are scoped to (account, wallet) so nobody can overwrite another user's pending link.
const linkKey = (account, wallet) => `link:${account}:${wallet}`

router.get('/config', (_req, res) => {
  const id = googleClientId()
  res.json({ google: id || null, walletLogin: !id, ai: !!require('../lib/config').OPENAI_API_KEY })
})

// ---- Google sign-in (the only login once GOOGLE_CLIENT_ID is set) ----
router.post('/google', limit('google', 20, 60_000), async (req, res) => {
  try {
    const clientId = googleClientId()
    if (!clientId) return res.status(503).json({ error: 'GOOGLE_NOT_CONFIGURED' })
    const credential = String(req.body?.credential || '')
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' })

    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(10_000) })
    const info = await r.json().catch(() => ({}))
    if (!r.ok || !info.sub) return res.status(401).json({ error: 'Google sign-in failed. Try again.' })
    if (info.aud !== clientId) return res.status(401).json({ error: 'Google sign-in is not for this app.' })
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) return res.status(401).json({ error: 'Invalid Google token.' })
    if (Number(info.exp) * 1000 < Date.now()) return res.status(401).json({ error: 'Google sign-in expired. Try again.' })
    if (String(info.email_verified) !== 'true') return res.status(401).json({ error: 'Your Google email is not verified.' })

    const id = `g:${info.sub}`
    const email = String(info.email || '').toLowerCase()
    const created = await dbQuery(
      `INSERT INTO mk_users (address, credits, email, name, avatar) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (address) DO NOTHING RETURNING address`,
      [id, WELCOME_CREDITS, email, info.name || null, info.picture || null]
    )
    if (created.rows[0]) await welcome(id)
    else await dbQuery(`UPDATE mk_users SET email = $2, name = COALESCE($3, name), avatar = COALESCE($4, avatar) WHERE address = $1`, [id, email, info.name || null, info.picture || null])

    const token = await newSession(id)
    const user = (await dbQuery(`SELECT * FROM mk_users WHERE address = $1`, [id])).rows[0]
    res.json({ token, user, isNew: Boolean(created.rows[0]) })
  } catch (e) {
    console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

// ---- Wallet login: only while Google sign-in isn't configured yet ----
router.post('/nonce', limit('nonce', 20, 60_000), async (req, res) => {
  try {
    if (googleClientId()) return res.status(403).json({ error: 'Please sign in with Google.' })
    const address = String(req.body?.address || '').toLowerCase()
    if (!isAddress(address)) return res.status(400).json({ error: 'Invalid wallet address' })
    res.json({ message: loginMessage(address, await saveNonce(address)) })
  } catch (e) {
    console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

router.post('/verify', limit('verify', 20, 60_000), async (req, res) => {
  try {
    if (googleClientId()) return res.status(403).json({ error: 'Please sign in with Google.' })
    const address = String(req.body?.address || '').toLowerCase()
    const signature = req.body?.signature
    if (!isAddress(address) || !signature) return res.status(400).json({ error: 'Missing address or signature' })
    const nonce = await takeNonce(address)
    if (!nonce) return res.status(400).json({ error: 'Login request expired. Try again.' })
    const ok = await verifyMessage({ address, message: loginMessage(address, nonce), signature })
    if (!ok) return res.status(401).json({ error: 'Signature does not match this wallet' })
    const created = await dbQuery(
      `INSERT INTO mk_users (address, credits) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING RETURNING address`,
      [address, WELCOME_CREDITS]
    )
    if (created.rows[0]) await welcome(address)
    const token = await newSession(address)
    const user = (await dbQuery(`SELECT * FROM mk_users WHERE address = $1`, [address])).rows[0]
    res.json({ token, user, isNew: Boolean(created.rows[0]) })
  } catch (e) {
    console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

// ---- Settings → Connections: link a wallet to the signed-in account ----
const accountLabel = (u) => u.email || u.address

router.post('/link/nonce', requireAuth, limit('link', 20, 60_000), async (req, res) => {
  try {
    const address = String(req.body?.address || '').toLowerCase()
    if (!isAddress(address)) return res.status(400).json({ error: 'Invalid wallet address' })
    res.json({ message: linkMessage(address, accountLabel(req.user), await saveNonce(linkKey(req.user.address, address))) })
  } catch (e) {
    console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

// Move an old wallet-only account's credits & history into the Google account.
async function mergeLegacy(from, into) {
  // Remove the old account and add its balance in ONE statement, so it can only ever be merged once.
  const old = (await dbQuery(
    `WITH old AS (DELETE FROM mk_users WHERE address = $1 RETURNING *)
     UPDATE mk_users u SET credits = u.credits + COALESCE(old.credits, 0),
       total_deposited_credits = u.total_deposited_credits + COALESCE(old.total_deposited_credits, 0),
       total_spent_credits = u.total_spent_credits + COALESCE(old.total_spent_credits, 0),
       watchlist_seeded = u.watchlist_seeded OR COALESCE(old.watchlist_seeded, false)
     FROM old WHERE u.address = $2 RETURNING old.credits AS credits`,
    [from, into]
  )).rows[0]
  if (!old) return null
  for (const t of ['mk_conversations', 'mk_deposits', 'mk_ledger', 'mk_briefings', 'mk_checks', 'mk_memories']) {
    await dbQuery(`UPDATE ${t} SET address = $2 WHERE address = $1`, [from, into])
  }
  await dbQuery(`DELETE FROM mk_watchlist WHERE address = $1 AND symbol IN (SELECT symbol FROM mk_watchlist WHERE address = $2)`, [from, into])
  await dbQuery(`UPDATE mk_watchlist SET address = $2 WHERE address = $1`, [from, into])
  await dbQuery(`DELETE FROM mk_memory_prefs WHERE address = $1`, [from])
  await dbQuery(`DELETE FROM mk_sessions WHERE address = $1`, [from])
  return { credits: old.credits || 0 }
}

router.post('/link/verify', requireAuth, limit('link', 20, 60_000), async (req, res) => {
  try {
    const me = req.user
    if (isLegacyWallet(me.address)) return res.status(400).json({ error: 'Sign in with Google to connect a wallet.' })
    const address = String(req.body?.address || '').toLowerCase()
    const signature = req.body?.signature
    if (!isAddress(address) || !signature) return res.status(400).json({ error: 'Missing address or signature' })
    const nonce = await takeNonce(linkKey(me.address, address))
    if (!nonce) return res.status(400).json({ error: 'Request expired. Try again.', code: 'EXPIRED' })
    const ok = await verifyMessage({ address, message: linkMessage(address, accountLabel(me), nonce), signature })
    if (!ok) return res.status(401).json({ error: 'Signature does not match this wallet', code: 'BAD_SIGNATURE' })

    const taken = await dbQuery(`SELECT address FROM mk_users WHERE wallet = $1 AND address <> $2`, [address, me.address])
    if (taken.rows[0]) return res.status(409).json({ error: 'WALLET_TAKEN' })

    await dbQuery(`UPDATE mk_users SET wallet = $2 WHERE address = $1`, [me.address, address])
    const merged = await mergeLegacy(address, me.address)
    const user = (await dbQuery(`SELECT * FROM mk_users WHERE address = $1`, [me.address])).rows[0]
    res.json({ user, merged })
  } catch (e) {
    console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

router.delete('/link', requireAuth, async (req, res) => {
  try {
    if (isLegacyWallet(req.user.address)) return res.status(400).json({ error: 'This wallet is your login.' })
    const { rows } = await dbQuery(`UPDATE mk_users SET wallet = NULL WHERE address = $1 RETURNING *`, [req.user.address])
    res.json({ user: rows[0] })
  } catch (e) {
    console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' })
  }
})

router.post('/logout', requireAuth, async (req, res) => {
  const token = (req.headers.authorization || '').slice(7)
  await dbQuery(`DELETE FROM mk_sessions WHERE token = $1`, [token]).catch(() => {})
  res.json({ ok: true })
})

module.exports = router
