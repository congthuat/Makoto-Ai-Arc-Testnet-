// Safety net for async route handlers (Express 4 does not catch rejected promises).
// Any handler that throws/rejects now answers a generic 500 instead of crashing the process.
const Route = require('express/lib/router/route')

if (!Route.prototype.__mkSafe) {
  Route.prototype.__mkSafe = true
  const wrap = (fn) => {
    if (typeof fn !== 'function' || fn.length > 3) return fn // leave error handlers alone
    return function safeHandler(req, res, next) {
      try {
        const r = fn.call(this, req, res, next)
        if (r && typeof r.catch === 'function') r.catch((e) => fail(e, req, res))
        return r
      } catch (e) {
        fail(e, req, res)
      }
    }
  }
  for (const m of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']) {
    const orig = Route.prototype[m]
    if (typeof orig !== 'function') continue
    Route.prototype[m] = function (...handlers) {
      return orig.apply(this, handlers.flat(Infinity).map(wrap))
    }
  }
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e?.message || e))
}

function fail(e, req, res) {
  console.error(`[route] ${req.method} ${req.originalUrl}:`, e?.message || e)
  if (res.headersSent) { try { res.end() } catch {} return }
  res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
}

// Final error handler for the whole app (bad JSON bodies, oversized payloads, next(err)).
// Express's default one answers with an HTML stack trace that shows server paths.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const st = Number(err?.status || err?.statusCode)
  const status = st >= 400 && st < 600 ? st : 500
  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}:`, err?.message || err)
  if (res.headersSent) { try { res.end() } catch {} return }
  const error = err?.type === 'entity.parse.failed' ? 'bad_json' : err?.type === 'entity.too.large' ? 'too_large' : status < 500 ? 'bad_request' : 'server_error'
  res.status(status).json({ error })
}

/**
 * Wrap a route's router so that, once mounted, the app also gets `errorHandler` at the very
 * end of its middleware stack (route modules are the only hook we have into the app).
 */
function withErrorHandler(router) {
  const express = require('express')
  const sub = express()
  sub.disable('x-powered-by')
  sub.use(router)
  sub.on('mount', (parent) => {
    if (parent.__mkErrors) return
    parent.__mkErrors = true
    parent.disable('x-powered-by')
    setImmediate(() => parent.use(errorHandler)) // after every other route/middleware is registered
  })
  return sub
}

/** Parse a positive integer DB id from user input, or null. */
const parseId = (v) => (/^\d{1,9}$/.test(String(v ?? '')) ? Number(v) : null)

/** A normal public web address (http/https, a real domain, no credentials, sane length). */
function isPublicHttpUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2000) return false
  let u
  try { u = new URL(raw) } catch { return false }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return false
  const h = u.hostname.toLowerCase()
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return false
  return true
}

module.exports = { parseId, withErrorHandler, isPublicHttpUrl }
