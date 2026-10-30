const fs = require('node:fs')
const path = require('node:path')
const { dbQuery } = require('@surf-ai/sdk/db')

// Read fresh each time so adding GOOGLE_CLIENT_ID to backend/.env takes effect without a restart.
function googleClientId() {
  if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID.trim()
  try {
    const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^\s*GOOGLE_CLIENT_ID\s*=\s*(\S+)/m)
    if (m) return m[1].trim()
  } catch {}
  // Public OAuth client ID (not a secret) — fallback so deployments work without .env
  return '933380416192-s7ebmo198ilh5plq2kcgsa1mphdvc441.apps.googleusercontent.com'
}

const isLegacyWallet = (id) => /^0x[0-9a-f]{40}$/.test(String(id || ''))

async function getUserByToken(token) {
  if (!token) return null
  const { rows } = await dbQuery(
    `SELECT u.* FROM mk_sessions s JOIN mk_users u ON u.address = s.address
     WHERE s.token = $1 AND (s.created_at IS NULL OR s.created_at > NOW() - INTERVAL '60 days')`,
    [token]
  )
  const u = rows[0]
  if (!u) return null
  // Old wallet-only accounts: their wallet is their id.
  if (!u.wallet && isLegacyWallet(u.address)) u.wallet = u.address
  return u
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  getUserByToken(token)
    .then((user) => {
      if (!user) return res.status(401).json({ error: 'Please sign in again.' })
      // Google is the only way in once it's configured: retire old wallet-only sessions.
      if (isLegacyWallet(user.address) && googleClientId()) return res.status(401).json({ error: 'Please sign in with Google.' })
      req.user = user
      next()
    })
    .catch((e) => { console.error('[auth]', e?.message); res.status(500).json({ error: 'server_error' }) })
}

async function addCredits(address, delta, reason, ref) {
  const col = delta >= 0 ? 'total_deposited_credits' : 'total_spent_credits'
  const { rows } = await dbQuery(
    `UPDATE mk_users SET credits = GREATEST(credits + $2, 0), ${col} = ${col} + $3 WHERE address = $1 RETURNING credits`,
    [address, delta, Math.abs(delta)]
  )
  await dbQuery(`INSERT INTO mk_ledger (address, delta, reason, ref) VALUES ($1, $2, $3, $4)`, [address, delta, reason, ref || null])
  return rows[0]?.credits ?? 0
}

/**
 * Atomically hold up to `max` credits (at least `min`) before doing paid work, so parallel
 * requests can't spend the same balance twice. Returns the amount held, or null if the
 * balance is below `min`.
 */
async function reserveCredits(address, min, max) {
  const { rows } = await dbQuery(
    `WITH cur AS (SELECT credits FROM mk_users WHERE address = $1 FOR UPDATE)
     UPDATE mk_users u SET credits = u.credits - LEAST(cur.credits, $3)
     FROM cur WHERE u.address = $1 AND cur.credits >= $2
     RETURNING LEAST(cur.credits, $3)::int AS held`,
    [address, min, max]
  )
  return rows[0] ? rows[0].held : null
}

/**
 * Finish a reservation: charge `cost` (never more than what was held), give the rest back,
 * and write the ledger entry. Returns the new balance.
 */
async function settleCredits(address, held, cost, reason, ref) {
  const charge = Math.max(0, Math.min(held, Math.round(cost)))
  // One statement: the refund and the ledger entry either both happen or neither does,
  // so a failed settle can be retried safely.
  const { rows } = await dbQuery(
    `WITH u AS (
       UPDATE mk_users SET credits = credits + $2, total_spent_credits = total_spent_credits + $3 WHERE address = $1 RETURNING credits
     ), l AS (
       INSERT INTO mk_ledger (address, delta, reason, ref) SELECT $1, -$3::int, $4, $5 FROM u WHERE $3::int > 0 RETURNING 1
     )
     SELECT credits FROM u`,
    [address, held - charge, charge, reason, ref || null]
  )
  return { balance: rows[0]?.credits ?? 0, charged: charge }
}

module.exports = { requireAuth, getUserByToken, addCredits, reserveCredits, settleCredits, googleClientId, isLegacyWallet }
