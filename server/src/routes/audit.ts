import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { entity_type, entity_id, actor, action, limit = '100', offset = '0' } = req.query;
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params: unknown[] = [];
  if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
  if (entity_id) { query += ' AND entity_id = ?'; params.push(entity_id); }
  if (actor) { query += ' AND actor = ?'; params.push(actor); }
  if (action) { query += ' AND action = ?'; params.push(action); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const rows = db.prepare(query).all(...params) as any[];
  const total = (db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as c').replace(/ LIMIT.+$/, '')).get(...params.slice(0, -2)) as any).c;
  res.json({ rows: rows.map(r => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })), total });
});

router.get('/:entityType/:entityId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 200'
  ).all(req.params.entityType, req.params.entityId) as any[];
  res.json(rows.map(r => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })));
});

export default router;
