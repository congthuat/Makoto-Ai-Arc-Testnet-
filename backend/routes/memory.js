const { parseId } = require('../lib/safe')
// "Trí nhớ của Makoto" — view, add, edit, delete and switch off long-term memory.
const { Router } = require('express')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')
const { isEnabled, list, SECRET_RE, MAX_MEMORIES, clean } = require('../lib/memory')

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const [enabled, items] = await Promise.all([isEnabled(req.user.address), list(req.user.address)])
  res.json({ enabled, items, max: MAX_MEMORIES })
})

router.put('/settings', requireAuth, async (req, res) => {
  const enabled = req.body?.enabled !== false
  await dbQuery(
    `INSERT INTO mk_memory_prefs (address, enabled, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (address) DO UPDATE SET enabled = $2, updated_at = NOW()`,
    [req.user.address, enabled]
  )
  res.json({ enabled })
})

router.post('/', requireAuth, async (req, res) => {
  const content = clean(req.body?.content)
  if (content.length < 3) return res.status(400).json({ error: 'empty' })
  if (SECRET_RE.test(content)) return res.status(400).json({ error: 'sensitive', code: 'SENSITIVE' })
  const { rows: c } = await dbQuery(`SELECT COUNT(*)::int AS n FROM mk_memories WHERE address = $1`, [req.user.address])
  if (c[0].n >= MAX_MEMORIES) return res.status(400).json({ error: 'full', code: 'FULL' })
  const { rows } = await dbQuery(`INSERT INTO mk_memories (address, content, category, source) VALUES ($1, $2, 'other', 'manual') RETURNING id, content, category, source, created_at, updated_at`, [req.user.address, content])
  res.json({ item: rows[0] })
})

router.patch('/:id', requireAuth, async (req, res) => {
  const content = clean(req.body?.content)
  if (content.length < 3) return res.status(400).json({ error: 'empty' })
  if (parseId(req.params.id) == null) return res.status(404).json({ error: 'not_found' })
  if (SECRET_RE.test(content)) return res.status(400).json({ error: 'sensitive', code: 'SENSITIVE' })
  const { rows } = await dbQuery(`UPDATE mk_memories SET content = $3, updated_at = NOW() WHERE id = $1 AND address = $2 RETURNING id, content, category, source, created_at, updated_at`, [parseId(req.params.id), req.user.address, content])
  if (!rows[0]) return res.status(404).json({ error: 'not_found' })
  res.json({ item: rows[0] })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id)
  if (id == null) return res.status(404).json({ error: 'not_found' })
  await dbQuery(`DELETE FROM mk_memories WHERE id = $1 AND address = $2`, [id, req.user.address])
  res.json({ ok: true })
})

router.delete('/', requireAuth, async (req, res) => {
  const { rowCount } = await dbQuery(`DELETE FROM mk_memories WHERE address = $1`, [req.user.address])
  res.json({ ok: true, deleted: rowCount })
})

module.exports = router
