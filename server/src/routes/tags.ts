import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  res.json(tags);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Tag name already exists' });
  const result = db.prepare('INSERT INTO tags (name, color, description) VALUES (?, ?, ?)').run(
    name, color ?? '#6366f1', description ?? null
  );
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  logAudit(db, 'tag', String(result.lastInsertRowid), 'created', (req as any).actor ?? 'user', { name }, (req as any).sourceIp);
  res.status(201).json(tag);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, color, description } = req.body;
  db.prepare('UPDATE tags SET name = ?, color = ?, description = ? WHERE id = ?').run(
    name, color, description ?? null, req.params.id
  );
  res.json(db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM tags WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Entity tag endpoints
router.get('/:entityType/:entityId', (req, res) => {
  const db = getDb();
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN entity_tags et ON t.id = et.tag_id
    WHERE et.entity_type = ? AND et.entity_id = ?
  `).all(req.params.entityType, req.params.entityId);
  res.json(tags);
});

router.post('/:entityType/:entityId', (req, res) => {
  const db = getDb();
  const { tag_id } = req.body;
  if (!tag_id) return res.status(400).json({ error: 'tag_id required' });
  db.prepare('INSERT OR IGNORE INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)').run(
    req.params.entityType, req.params.entityId, tag_id
  );
  res.status(201).json({ ok: true });
});

router.delete('/:entityType/:entityId/:tagId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM entity_tags WHERE entity_type = ? AND entity_id = ? AND tag_id = ?').run(
    req.params.entityType, req.params.entityId, req.params.tagId
  );
  res.status(204).send();
});

export default router;
