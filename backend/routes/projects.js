require('../lib/safe')
// "Dự án" — browse project profiles (free) and keep a saved list.
const { Router } = require('express')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')
const { limit } = require('../lib/ratelimit')
const projects = require('../lib/projects')
const { enrich } = require('../lib/projectLinks')

const router = Router()
const MAX_SAVED = 60
const KEY_RE = /^[\w-]{1,80}$/

router.get('/', limit('projects', 60, 60_000), async (req, res) => {
  try {
    const { items, updated_at, stale } = await projects.list()
    res.set('Cache-Control', 'private, max-age=120')
    res.json({ items: items.map(projects.card), updated_at, stale: !!stale })
  } catch (e) {
    console.error('[projects]', e?.message)
    res.status(503).json({ error: 'Project data is unavailable right now', code: 'UNAVAILABLE' })
  }
})

router.get('/search', limit('project-search', 40, 60_000), async (req, res) => {
  const q = String(req.query.q || '').slice(0, 60)
  try {
    res.json({ q, items: await projects.search(q) })
  } catch (e) {
    console.error('[projects/search]', e?.message)
    res.status(503).json({ error: 'Search is unavailable right now', code: 'UNAVAILABLE' })
  }
})

router.get('/item/:key', limit('project-item', 60, 60_000), async (req, res) => {
  const key = String(req.params.key || '')
  if (!KEY_RE.test(key)) return res.status(404).json({ error: 'not_found' })
  const id = await projects.resolve(key, String(req.query.name || '').slice(0, 80))
  const info = id ? await projects.projectInfo(id).catch(() => null) : null
  if (!info) return res.status(404).json({ error: 'not_found' })
  const extra = await enrich(info).catch(() => null)
  // Team X links are only kept after checking them against the live X profile.
  const project = { ...info, links: extra?.links || [], team: extra?.team || info.team.map((m) => ({ ...m, x: null, x_status: null })) }
  const [token, related] = await Promise.all([
    project.symbol || project.tge_status === 'post' ? projects.tokenInfo(id).catch(() => null) : null,
    projects.related(id, project).catch(() => []),
  ])
  res.json({ project, token, related })
})

/* ---------- Saved projects ---------- */

router.get('/saved', requireAuth, async (req, res) => {
  const { rows } = await dbQuery(`SELECT akey AS key, name, logo, created_at FROM mk_airdrop_tracks WHERE address = $1 ORDER BY created_at DESC`, [req.user.address])
  res.json({ items: rows })
})

router.post('/saved', requireAuth, async (req, res) => {
  const key = String(req.body?.key || '')
  if (!projects.isId(key)) return res.status(400).json({ error: 'not_found' })
  const info = await projects.projectInfo(key).catch(() => null)
  const name = info?.name || String(req.body?.name || '').slice(0, 80)
  if (!name) return res.status(404).json({ error: 'not_found' })
  const { rows: c } = await dbQuery(`SELECT COUNT(*)::int AS n, BOOL_OR(akey = $2) AS has FROM mk_airdrop_tracks WHERE address = $1`, [req.user.address, key])
  if (c[0].has) return res.json({ ok: true })
  if (c[0].n >= MAX_SAVED) return res.status(400).json({ error: 'limit', code: 'LIMIT' })
  await dbQuery(`INSERT INTO mk_airdrop_tracks (address, akey, name, logo, done) VALUES ($1, $2, $3, $4, '[]'::jsonb)`, [req.user.address, key, name, info?.logo || null])
  res.json({ ok: true })
})

router.delete('/saved/:key', requireAuth, async (req, res) => {
  const key = String(req.params.key || '')
  if (!KEY_RE.test(key)) return res.status(404).json({ error: 'not_found' })
  await dbQuery(`DELETE FROM mk_airdrop_tracks WHERE address = $1 AND akey = $2`, [req.user.address, key])
  res.json({ ok: true })
})

module.exports = router
