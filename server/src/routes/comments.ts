import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/:entityType/:entityId', async (req, res) => {
  const db = getKnex();
  res.json(await rawAll(db,
    'SELECT * FROM comments WHERE entity_type=? AND entity_id=? ORDER BY created_at ASC',
    [req.params.entityType, req.params.entityId]
  ));
});

router.post('/:entityType/:entityId', async (req, res) => {
  const db = getKnex();
  const { body, author } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  const id = await rawInsert(db,
    'INSERT INTO comments (entity_type, entity_id, author, body) VALUES (?, ?, ?, ?) RETURNING id',
    [req.params.entityType, req.params.entityId, author ?? 'analyst', body.trim()]
  );
  const created = await rawGet(db, 'SELECT * FROM comments WHERE id = ?', [id]);
  await logAudit(db, req.params.entityType, req.params.entityId, 'commented',
    (req as any).actor ?? author ?? 'analyst', undefined, (req as any).sourceIp);
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  await rawRun(db, 'UPDATE comments SET body=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [body.trim(), req.params.id]);
  res.json(await rawGet(db, 'SELECT * FROM comments WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM comments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM comments WHERE id = ?', [req.params.id]);
  await logAudit(db, existing.entity_type, existing.entity_id, 'comment_deleted',
    (req as any).actor ?? 'user', undefined, (req as any).sourceIp);
  res.status(204).send();
});

export default router;
