import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { assignee, status, entity_type } = req.query;
  let query = 'SELECT * FROM assignments WHERE 1=1';
  const params: unknown[] = [];
  if (assignee) { query += ' AND assignee = ?'; params.push(assignee); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
  query += ' ORDER BY priority DESC, due_date ASC, created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:entityType/:entityId', (req, res) => {
  const db = getDb();
  res.json(db.prepare(
    'SELECT * FROM assignments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC'
  ).all(req.params.entityType, req.params.entityId));
});

router.post('/', (req, res) => {
  const db = getDb();
  const { entity_type, entity_id, assignee, status, priority, due_date, notes } = req.body;
  if (!entity_type || !entity_id || !assignee) {
    return res.status(400).json({ error: 'entity_type, entity_id, and assignee are required' });
  }
  const result = db.prepare(`
    INSERT INTO assignments (entity_type, entity_id, assignee, status, priority, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entity_type, String(entity_id), assignee, status ?? 'open', priority ?? 'medium', due_date ?? null, notes ?? null);
  const created = db.prepare('SELECT * FROM assignments WHERE id = ?').get(result.lastInsertRowid);
  logAudit(db, entity_type, String(entity_id), 'assigned', (req as any).actor ?? 'user', { assignee }, (req as any).sourceIp);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { assignee, status, priority, due_date, notes } = req.body;
  db.prepare(`
    UPDATE assignments SET assignee = ?, status = ?, priority = ?, due_date = ?, notes = ?,
    updated_at = datetime('now') WHERE id = ?
  `).run(assignee ?? existing.assignee, status ?? existing.status, priority ?? existing.priority,
    due_date ?? existing.due_date, notes ?? existing.notes, req.params.id);
  if (status && status !== existing.status) {
    logAudit(db, existing.entity_type, existing.entity_id, 'assignment_status_changed', (req as any).actor ?? 'user', { from: existing.status, to: status }, (req as any).sourceIp);
  }
  res.json(db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  logAudit(db, existing.entity_type, existing.entity_id, 'unassigned', (req as any).actor ?? 'user', { assignee: existing.assignee }, (req as any).sourceIp);
  res.status(204).send();
});

export default router;
