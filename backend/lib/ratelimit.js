// Tiny in-memory sliding-window limiter. key -> timestamps
const buckets = new Map()

function hit(key, max, windowMs) {
  const now = Date.now()
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (arr.length >= max) { buckets.set(key, arr); return false }
  arr.push(now)
  buckets.set(key, arr)
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [k, arr] of buckets) if (!arr.length || now - arr[arr.length - 1] > 3_600_000) buckets.delete(k)
}, 600_000).unref?.()

// The proxy in front of us appends the real client IP last; earlier entries are client-supplied and spoofable.
const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean).pop() || req.ip || 'unknown'

/** Express middleware: `max` requests per `windowMs`, keyed by wallet (if logged in) or IP. */
function limit(name, max, windowMs) {
  return (req, res, next) => {
    const who = req.user?.address || clientIp(req)
    if (hit(`${name}:${who}`, max, windowMs)) return next()
    res.set('Retry-After', String(Math.ceil(windowMs / 1000)))
    res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' })
  }
}

module.exports = { limit, hit, clientIp }
