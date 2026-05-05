import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const tools = db.prepare('SELECT * FROM tools ORDER BY category, name').all() as any[];

  const withCoverage = tools.map(tool => {
    const d3fendCount = (db.prepare('SELECT COUNT(*) as c FROM tool_d3fend WHERE tool_id = ?').get(tool.id) as any).c;
    const mitigationCount = (db.prepare('SELECT COUNT(*) as c FROM tool_mitigations WHERE tool_id = ?').get(tool.id) as any).c;
    return { ...tool, d3fend_count: d3fendCount, mitigation_count: mitigationCount };
  });

  res.json(withCoverage);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Not found' });

  const d3fend = db.prepare(`
    SELECT d.*, td.notes FROM d3fend_techniques d
    JOIN tool_d3fend td ON d.id = td.d3fend_id
    WHERE td.tool_id = ?
    ORDER BY d.category, d.name
  `).all(req.params.id);

  const mitigations = db.prepare(`
    SELECT m.*, tm.notes FROM attack_mitigations m
    JOIN tool_mitigations tm ON m.id = tm.mitigation_id
    WHERE tm.tool_id = ?
    ORDER BY m.id
  `).all(req.params.id);

  res.json({ ...tool, d3fend_techniques: d3fend, mitigations });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, vendor, description, category, status, notes, d3fend_ids, mitigation_ids } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });

  const result = db.prepare(`
    INSERT INTO tools (name, vendor, description, category, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, vendor ?? null, description ?? null, category, status ?? 'active', notes ?? null);

  const toolId = result.lastInsertRowid;

  if (Array.isArray(d3fend_ids)) {
    const ins = db.prepare('INSERT OR IGNORE INTO tool_d3fend (tool_id, d3fend_id) VALUES (?, ?)');
    for (const id of d3fend_ids) ins.run(toolId, id);
  }
  if (Array.isArray(mitigation_ids)) {
    const ins = db.prepare('INSERT OR IGNORE INTO tool_mitigations (tool_id, mitigation_id) VALUES (?, ?)');
    for (const id of mitigation_ids) ins.run(toolId, id);
  }

  const created = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
  logAudit(db, 'tool', String(toolId), 'created', 'user', { name });
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, vendor, description, category, status, notes, d3fend_ids, mitigation_ids } = req.body;

  db.prepare(`
    UPDATE tools SET name = ?, vendor = ?, description = ?, category = ?, status = ?, notes = ?,
    updated_at = datetime('now') WHERE id = ?
  `).run(name, vendor ?? null, description ?? null, category, status ?? 'active', notes ?? null, req.params.id);

  if (Array.isArray(d3fend_ids)) {
    db.prepare('DELETE FROM tool_d3fend WHERE tool_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO tool_d3fend (tool_id, d3fend_id) VALUES (?, ?)');
    for (const id of d3fend_ids) ins.run(req.params.id, id);
  }
  if (Array.isArray(mitigation_ids)) {
    db.prepare('DELETE FROM tool_mitigations WHERE tool_id = ?').run(req.params.id);
    const ins = db.prepare('INSERT OR IGNORE INTO tool_mitigations (tool_id, mitigation_id) VALUES (?, ?)');
    for (const id of mitigation_ids) ins.run(req.params.id, id);
  }

  const updated = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
  logAudit(db, 'tool', req.params.id, 'updated', 'user', { name, status });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  logAudit(db, 'tool', req.params.id, 'deleted', 'user', { name: existing.name });
  db.prepare('DELETE FROM tools WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
