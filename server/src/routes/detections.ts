import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { status, source, severity, technique } = req.query;
  let query = "SELECT * FROM detections WHERE 1=1";
  const params: unknown[] = [];

  if (status) { query += " AND status = ?"; params.push(status); }
  if (source) { query += " AND source = ?"; params.push(source); }
  if (severity) { query += " AND severity = ?"; params.push(severity); }
  if (technique) { query += ' AND technique_ids LIKE ?'; params.push(`%"${technique}"%`); }

  query += " ORDER BY updated_at DESC";
  const rows = db.prepare(query).all(...params);
  res.json(rows.map((d: any) => ({ ...d, technique_ids: JSON.parse(d.technique_ids) })));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const detection = db.prepare('SELECT * FROM detections WHERE id = ?').get(req.params.id) as any;
  if (!detection) return res.status(404).json({ error: 'Not found' });
  res.json({ ...detection, technique_ids: JSON.parse(detection.technique_ids) });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes } = req.body;
  if (!name || !technique_ids) return res.status(400).json({ error: 'name and technique_ids are required' });

  const result = db.prepare(`
    INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description ?? null, rule_id ?? null, source ?? null, JSON.stringify(technique_ids),
    status ?? 'active', severity ?? 'medium', confidence ?? 'medium', false_positive_rate ?? null, notes ?? null);

  const created = db.prepare('SELECT * FROM detections WHERE id = ?').get(result.lastInsertRowid) as any;
  logAudit(db, 'detection', String(result.lastInsertRowid), 'created', (req as any).actor ?? 'user', { name }, (req as any).sourceIp);
  res.status(201).json({ ...created, technique_ids: JSON.parse(created.technique_ids) });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM detections WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes } = req.body;
  db.prepare(`
    UPDATE detections SET
      name = ?, description = ?, rule_id = ?, source = ?, technique_ids = ?,
      status = ?, severity = ?, confidence = ?, false_positive_rate = ?, notes = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name, description ?? null, rule_id ?? null, source ?? null,
    JSON.stringify(technique_ids ?? []),
    status ?? 'active', severity ?? 'medium', confidence ?? 'medium',
    false_positive_rate ?? null, notes ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM detections WHERE id = ?').get(req.params.id) as any;
  logAudit(db, 'detection', req.params.id, 'updated', (req as any).actor ?? 'user', { status, severity }, (req as any).sourceIp);
  res.json({ ...updated, technique_ids: JSON.parse(updated.technique_ids) });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM detections WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  logAudit(db, 'detection', req.params.id, 'deleted', (req as any).actor ?? 'user', { name: existing.name }, (req as any).sourceIp);
  db.prepare('DELETE FROM detections WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Bulk status update: PATCH /api/detections/bulk { ids: number[], status: string }
router.patch('/bulk', (req, res) => {
  const db = getDb();
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: 'ids array and status are required' });
  }
  const validStatuses = ['active', 'tuning', 'planned', 'disabled', 'archived'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const placeholders = ids.map(() => '?').join(',');
  const update = db.transaction(() => {
    db.prepare(`UPDATE detections SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`).run(status, ...ids);
    for (const id of ids) logAudit(db, 'detection', String(id), 'bulk_status_update', (req as any).actor ?? 'user', { status }, (req as any).sourceIp);
  });
  update();
  res.json({ updated: ids.length });
});

// Bulk delete: DELETE /api/detections/bulk { ids: number[] }
router.delete('/bulk', (req, res) => {
  const db = getDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
  const placeholders = ids.map(() => '?').join(',');
  const del = db.transaction(() => {
    for (const id of ids) logAudit(db, 'detection', String(id), 'deleted', (req as any).actor ?? 'user', undefined, (req as any).sourceIp);
    db.prepare(`DELETE FROM detections WHERE id IN (${placeholders})`).run(...ids);
  });
  del();
  res.json({ deleted: ids.length });
});

router.post('/import', (req, res) => {
  const db = getDb();
  const { detections } = req.body;
  if (!Array.isArray(detections)) return res.status(400).json({ error: 'detections array required' });

  const insert = db.prepare(`
    INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  const importAll = db.transaction(() => {
    for (const d of detections) {
      if (!d.name || !d.technique_ids) continue;
      insert.run(d.name, d.description ?? null, d.rule_id ?? null, d.source ?? null,
        JSON.stringify(Array.isArray(d.technique_ids) ? d.technique_ids : [d.technique_ids]),
        d.status ?? 'active', d.severity ?? 'medium', d.confidence ?? 'medium', d.notes ?? null);
      imported++;
    }
  });
  importAll();
  res.json({ imported });
});

export default router;
