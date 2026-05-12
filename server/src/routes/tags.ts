import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM tags ORDER BY name'));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const existing = await rawGet(db, 'SELECT id FROM tags WHERE name = ?', [name]);
  if (existing) return res.status(409).json({ error: 'Tag name already exists' });
  const id = await rawInsert(db, 'INSERT INTO tags (name, color, description) VALUES (?, ?, ?) RETURNING id',
    [name, color ?? '#6366f1', description ?? null]);
  const tag = await rawGet(db, 'SELECT * FROM tags WHERE id = ?', [id]);
  await logAudit(db, 'tag', String(id), 'created', (req as any).actor ?? 'user', { name }, (req as any).sourceIp);
  res.status(201).json(tag);
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM tags WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, color, description } = req.body;
  await rawRun(db, 'UPDATE tags SET name=?, color=?, description=? WHERE id=?', [name, color, description ?? null, req.params.id]);
  await logAudit(db, 'tag', req.params.id, 'updated', (req as any).actor ?? 'user', { name, color }, (req as any).sourceIp);
  res.json(await rawGet(db, 'SELECT * FROM tags WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const tag = await rawGet<any>(db, 'SELECT id, name FROM tags WHERE id = ?', [req.params.id]);
  if (!tag) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM tags WHERE id = ?', [req.params.id]);
  await logAudit(db, 'tag', req.params.id, 'deleted', (req as any).actor ?? 'user', { name: tag.name }, (req as any).sourceIp);
  res.status(204).send();
});

router.get('/:entityType/:entityId', async (req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, `
    SELECT t.* FROM tags t JOIN entity_tags et ON t.id = et.tag_id
    WHERE et.entity_type = ? AND et.entity_id = ?
  `, [req.params.entityType, req.params.entityId]));
});

router.post('/:entityType/:entityId', async (req, res) => {
  const db = getKnex();
  const { tag_id } = req.body;
  if (!tag_id) return res.status(400).json({ error: 'tag_id required' });
  await rawRun(db, 'INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    [req.params.entityType, req.params.entityId, tag_id]);
  await logAudit(db, req.params.entityType, req.params.entityId, 'tag_added',
    (req as any).actor ?? 'user', { tag_id }, (req as any).sourceIp);
  res.status(201).json({ ok: true });
});

router.delete('/:entityType/:entityId/:tagId', async (req, res) => {
  const db = getKnex();
  await rawRun(db, 'DELETE FROM entity_tags WHERE entity_type=? AND entity_id=? AND tag_id=?',
    [req.params.entityType, req.params.entityId, req.params.tagId]);
  await logAudit(db, req.params.entityType, req.params.entityId, 'tag_removed',
    (req as any).actor ?? 'user', { tag_id: req.params.tagId }, (req as any).sourceIp);
  res.status(204).send();
});

export default router;
