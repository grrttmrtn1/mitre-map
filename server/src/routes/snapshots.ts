import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, buildTechniqueGraph, resolveToParent } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM coverage_snapshots ORDER BY taken_at ASC'));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { notes } = req.body;

  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);
  const total = parentTechIds.size;
  const active = await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'");
  const covered = new Set<string>();
  for (const d of active) for (const id of JSON.parse(d.technique_ids)) {
    const p = resolveToParent(id, parentTechIds, subtechToParent);
    if (p) covered.add(p);
  }

  const { c: mitigated } = await rawGet<{ c: number }>(db, `
    SELECT COUNT(DISTINCT tm.technique_id) as c FROM technique_mitigations tm
    JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
    JOIN tools t ON tlm.tool_id = t.id WHERE t.status='active'
  `) as any;
  const { c: activeDetCount } = await rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active'") as any;
  const { c: toolCount } = await rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM tools WHERE status='active'") as any;

  const coveredCount = covered.size;
  const id = await rawInsert(db, `
    INSERT INTO coverage_snapshots (total_techniques, covered_techniques, detected_techniques,
      mitigated_techniques, gap_techniques, coverage_pct, active_detections, total_tools, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [total, coveredCount, coveredCount, mitigated,
    total - coveredCount, Math.round((coveredCount / total) * 100),
    activeDetCount, toolCount, notes ?? null]);

  res.status(201).json(await rawGet(db, 'SELECT * FROM coverage_snapshots WHERE id = ?', [id]));
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM coverage_snapshots WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  await rawRun(db, 'DELETE FROM coverage_snapshots WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

export default router;
