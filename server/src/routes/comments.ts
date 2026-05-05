import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

router.get('/:entityType/:entityId', (req, res) => {
  const db = getDb();
  res.json(db.prepare(
    'SELECT * FROM comments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC'
  ).all(req.params.entityType, req.params.entityId));
});

router.post('/:entityType/:entityId', (req, res) => {
  const db = getDb();
  const { body, author } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  const result = db.prepare(
    'INSERT INTO comments (entity_type, entity_id, author, body) VALUES (?, ?, ?, ?)'
  ).run(req.params.entityType, req.params.entityId, author ?? 'analyst', body.trim());
  const created = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
  logAudit(db, req.params.entityType, req.params.entityId, 'commented', author ?? 'analyst');
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
  db.prepare("UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ?").run(body.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  logAudit(db, existing.entity_type, existing.entity_id, 'comment_deleted', 'user');
  res.status(204).send();
});

export default router;
