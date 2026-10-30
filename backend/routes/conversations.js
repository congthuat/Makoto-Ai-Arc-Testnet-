const { parseId } = require('../lib/safe')
const { Router } = require('express')
const { dbQuery } = require('@surf-ai/sdk/db')
const { requireAuth } = require('../lib/auth')

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await dbQuery(
    `SELECT id, title, pinned, created_at, updated_at FROM mk_conversations WHERE address = $1 ORDER BY pinned DESC, updated_at DESC LIMIT 200`,
    [req.user.address]
  )
  res.json({ conversations: rows })
})

async function own(req, res) {
  const id = parseId(req.params.id)
  if (id == null) {
    res.status(404).json({ error: 'Conversation not found' })
    return null
  }
  const { rows } = await dbQuery(`SELECT * FROM mk_conversations WHERE id = $1 AND address = $2`, [id, req.user.address])
  if (!rows[0]) {
    res.status(404).json({ error: 'Conversation not found' })
    return null
  }
  return rows[0]
}

// Export every conversation with its messages (for the "download my data" button).
router.get('/export/all', requireAuth, async (req, res) => {
  const { rows: convs } = await dbQuery(
    `SELECT id, title, pinned, created_at, updated_at FROM mk_conversations WHERE address = $1 ORDER BY created_at ASC`,
    [req.user.address]
  )
  const { rows: msgs } = convs.length
    ? await dbQuery(
        `SELECT conversation_id, role, content, model, created_at FROM mk_messages WHERE conversation_id = ANY($1::int[]) AND content <> '' ORDER BY id ASC`,
        [convs.map((c) => c.id)]
      )
    : { rows: [] }
  const by = new Map(convs.map((c) => [c.id, { ...c, messages: [] }]))
  for (const m of msgs) by.get(m.conversation_id)?.messages.push({ role: m.role, content: m.content, model: m.model, created_at: m.created_at })
  res.json({ address: req.user.email || req.user.wallet || req.user.address, exported_at: new Date().toISOString(), conversations: [...by.values()] })
})

// Delete all of the user's conversations.
router.delete('/', requireAuth, async (req, res) => {
  await dbQuery(`DELETE FROM mk_messages WHERE conversation_id IN (SELECT id FROM mk_conversations WHERE address = $1)`, [req.user.address])
  const { rowCount } = await dbQuery(`DELETE FROM mk_conversations WHERE address = $1`, [req.user.address])
  res.json({ ok: true, deleted: rowCount })
})

router.get('/:id', requireAuth, async (req, res) => {
  const conv = await own(req, res)
  if (!conv) return
  const { rows } = await dbQuery(`SELECT * FROM mk_messages WHERE conversation_id = $1 ORDER BY id ASC`, [conv.id])
  res.json({ conversation: conv, messages: rows })
})

router.patch('/:id', requireAuth, async (req, res) => {
  const conv = await own(req, res)
  if (!conv) return
  const title = String(req.body?.title || '').trim().slice(0, 120) || conv.title
  const pinned = typeof req.body?.pinned === 'boolean' ? req.body.pinned : conv.pinned
  const { rows } = await dbQuery(`UPDATE mk_conversations SET title = $2, pinned = $3 WHERE id = $1 RETURNING *`, [conv.id, title, pinned])
  res.json({ conversation: rows[0] })
})

router.patch('/:id/messages/:mid', requireAuth, async (req, res) => {
  const conv = await own(req, res)
  if (!conv) return
  const mid = parseId(req.params.mid)
  if (mid == null) return res.status(404).json({ error: 'Message not found' })
  const v = Number(req.body?.feedback)
  const feedback = v === 1 || v === -1 ? v : null
  const { rows } = await dbQuery(
    `UPDATE mk_messages SET feedback = $3 WHERE id = $1 AND conversation_id = $2 AND role = 'assistant' RETURNING id, feedback`,
    [mid, conv.id, feedback]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Message not found' })
  res.json(rows[0])
})

router.delete('/:id', requireAuth, async (req, res) => {
  const conv = await own(req, res)
  if (!conv) return
  await dbQuery(`DELETE FROM mk_messages WHERE conversation_id = $1`, [conv.id])
  await dbQuery(`DELETE FROM mk_conversations WHERE id = $1`, [conv.id])
  res.json({ ok: true })
})

module.exports = router
