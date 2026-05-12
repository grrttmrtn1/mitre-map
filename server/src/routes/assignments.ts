import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (req, res) => {
  const db = getKnex();
  const { assignee, status, entity_type } = req.query;
  let sql = 'SELECT * FROM assignments WHERE 1=1';
  const params: any[] = [];
  if (assignee) { sql += ' AND assignee=?'; params.push(assignee); }
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (entity_type) { sql += ' AND entity_type=?'; params.push(entity_type); }
  sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';
  res.json(await rawAll(db, sql, params));
});

router.get('/:entityType/:entityId', async (req, res) => {
  const db = getKnex();
  res.json(await rawAll(db,
    'SELECT * FROM assignments WHERE entity_type=? AND entity_id=? ORDER BY created_at DESC',
    [req.params.entityType, req.params.entityId]
  ));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { entity_type, entity_id, assignee, status, priority, due_date, notes } = req.body;
  if (!entity_type || !entity_id || !assignee) {
    return res.status(400).json({ error: 'entity_type, entity_id, and assignee are required' });
  }
  const id = await rawInsert(db, `
    INSERT INTO assignments (entity_type, entity_id, assignee, status, priority, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [entity_type, String(entity_id), assignee, status ?? 'open', priority ?? 'medium', due_date ?? null, notes ?? null]);
  const created = await rawGet(db, 'SELECT * FROM assignments WHERE id = ?', [id]);
  await logAudit(db, entity_type, String(entity_id), 'assigned', (req as any).actor ?? 'user', { assignee }, (req as any).sourceIp);
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM assignments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { assignee, status, priority, due_date, notes } = req.body;
  await rawRun(db, `
    UPDATE assignments SET assignee=?, status=?, priority=?, due_date=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `, [assignee ?? existing.assignee, status ?? existing.status, priority ?? existing.priority,
    due_date ?? existing.due_date, notes ?? existing.notes, req.params.id]);
  const changes: Record<string, unknown> = {};
  if (status && status !== existing.status) changes.status = { from: existing.status, to: status };
  if (assignee && assignee !== existing.assignee) changes.assignee = { from: existing.assignee, to: assignee };
  if (priority && priority !== existing.priority) changes.priority = { from: existing.priority, to: priority };
  if (Object.keys(changes).length > 0) {
    await logAudit(db, existing.entity_type, existing.entity_id, 'assignment_updated',
      (req as any).actor ?? 'user', changes, (req as any).sourceIp);
  }
  res.json(await rawGet(db, 'SELECT * FROM assignments WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM assignments WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM assignments WHERE id = ?', [req.params.id]);
  await logAudit(db, existing.entity_type, existing.entity_id, 'unassigned',
    (req as any).actor ?? 'user', { assignee: existing.assignee }, (req as any).sourceIp);
  res.status(204).send();
});

export default router;
