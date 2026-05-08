import { Router } from 'express';
import { getKnex, rawAll, rawGet } from '../db/database';

const router = Router();

router.get('/', async (req, res) => {
  const db = getKnex();
  const { entity_type, entity_id, actor, action, limit = '100', offset = '0' } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];
  if (entity_type) { sql += ' AND entity_type=?'; params.push(entity_type); }
  if (entity_id) { sql += ' AND entity_id=?'; params.push(entity_id); }
  if (actor) { sql += ' AND actor=?'; params.push(actor); }
  if (action) { sql += ' AND action=?'; params.push(action); }
  const countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as c');
  const countRow = await rawGet<{ c: number }>(db, countSql, params);
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const rows = await rawAll(db, sql, [...params, Number(limit), Number(offset)]);
  res.json({ rows: rows.map((r: any) => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })), total: countRow?.c ?? 0 });
});

router.get('/:entityType/:entityId', async (req, res) => {
  const db = getKnex();
  const rows = await rawAll(db,
    'SELECT * FROM audit_log WHERE entity_type=? AND entity_id=? ORDER BY created_at DESC LIMIT 200',
    [req.params.entityType, req.params.entityId]
  );
  res.json(rows.map((r: any) => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })));
});

export default router;
