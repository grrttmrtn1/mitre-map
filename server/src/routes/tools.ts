import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit, computeCoverageSummary } from '../db/database';
import { recordCoverageChangeDirect } from '../coverage/attribution';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  const tools = await rawAll(db, 'SELECT * FROM tools ORDER BY category, name');
  const withCoverage = await Promise.all(tools.map(async (tool: any) => {
    const [d3, mit] = await Promise.all([
      rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM tool_d3fend WHERE tool_id = ?', [tool.id]),
      rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM tool_mitigations WHERE tool_id = ?', [tool.id]),
    ]);
    return { ...tool, d3fend_count: d3?.c ?? 0, mitigation_count: mit?.c ?? 0 };
  }));
  res.json(withCoverage);
});

router.get('/:id', async (req, res) => {
  const db = getKnex();
  const tool = await rawGet(db, 'SELECT * FROM tools WHERE id = ?', [req.params.id]);
  if (!tool) return res.status(404).json({ error: 'Not found' });
  const [d3fend, mitigations] = await Promise.all([
    rawAll(db, `SELECT d.*, td.notes FROM d3fend_techniques d JOIN tool_d3fend td ON d.id = td.d3fend_id WHERE td.tool_id = ? ORDER BY d.category, d.name`, [req.params.id]),
    rawAll(db, `SELECT m.*, tm.notes FROM attack_mitigations m JOIN tool_mitigations tm ON m.id = tm.mitigation_id WHERE tm.tool_id = ? ORDER BY m.id`, [req.params.id]),
  ]);
  res.json({ ...tool, d3fend_techniques: d3fend, mitigations });
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, vendor, description, category, status, notes, d3fend_ids, mitigation_ids } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'name and category are required' });
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  const toolId = await rawInsert(db, `
    INSERT INTO tools (name, vendor, description, category, status, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING id
  `, [name, vendor ?? null, description ?? null, category, status ?? 'active', notes ?? null]);
  if (Array.isArray(d3fend_ids)) {
    for (const id of d3fend_ids) await rawRun(db, 'INSERT INTO tool_d3fend (tool_id, d3fend_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [toolId, id]);
  }
  if (Array.isArray(mitigation_ids)) {
    for (const id of mitigation_ids) await rawRun(db, 'INSERT INTO tool_mitigations (tool_id, mitigation_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [toolId, id]);
  }
  const created = await rawGet(db, 'SELECT * FROM tools WHERE id = ?', [toolId]);
  await logAudit(db, 'tool', String(toolId), 'created', actor, { name }, (req as any).sourceIp);
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'tool', String(toolId), name, 'created', actor, coverageBefore, after)
  ).catch(() => {});
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM tools WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, vendor, description, category, status, notes, d3fend_ids, mitigation_ids } = req.body;
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  await rawRun(db, `
    UPDATE tools SET name=?, vendor=?, description=?, category=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `, [name, vendor ?? null, description ?? null, category, status ?? 'active', notes ?? null, req.params.id]);
  if (Array.isArray(d3fend_ids)) {
    await rawRun(db, 'DELETE FROM tool_d3fend WHERE tool_id = ?', [req.params.id]);
    for (const id of d3fend_ids) await rawRun(db, 'INSERT INTO tool_d3fend (tool_id, d3fend_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.params.id, id]);
  }
  if (Array.isArray(mitigation_ids)) {
    await rawRun(db, 'DELETE FROM tool_mitigations WHERE tool_id = ?', [req.params.id]);
    for (const id of mitigation_ids) await rawRun(db, 'INSERT INTO tool_mitigations (tool_id, mitigation_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.params.id, id]);
  }
  const updated = await rawGet(db, 'SELECT * FROM tools WHERE id = ?', [req.params.id]);
  await logAudit(db, 'tool', req.params.id, 'updated', actor, { name, status }, (req as any).sourceIp);
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'tool', req.params.id, name, 'updated', actor, coverageBefore, after)
  ).catch(() => {});
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM tools WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  await logAudit(db, 'tool', req.params.id, 'deleted', actor, { name: existing.name }, (req as any).sourceIp);
  await rawRun(db, 'DELETE FROM tools WHERE id = ?', [req.params.id]);
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'tool', req.params.id, existing.name, 'deleted', actor, coverageBefore, after)
  ).catch(() => {});
  res.status(204).send();
});

export default router;
