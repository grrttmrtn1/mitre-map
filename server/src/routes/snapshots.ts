import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit, computeCoverageState } from '../db/database';
import { snapshotComplianceCoverage } from './compliance';

const router = Router();

export async function takeSnapshot(notes?: string | null, actor?: string, sourceIp?: string): Promise<any> {
  const db = getKnex();
  const coverage = await computeCoverageState(db);
  const total = coverage.total;
  const { c: activeDetCount } = await rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active'") as any;
  const { c: toolCount } = await rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM tools WHERE status='active'") as any;
  const coveredCount = coverage.covered;
  const id = await rawInsert(db, `
    INSERT INTO coverage_snapshots (total_techniques, covered_techniques, detected_techniques,
      mitigated_techniques, gap_techniques, coverage_pct, active_detections, total_tools, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [total, coveredCount, coverage.detectedIds.size, coverage.mitigatedIds.size,
    total - coveredCount, coverage.pct,
    activeDetCount, toolCount, notes ?? null]);
  const snapshot = await rawGet<any>(db, 'SELECT * FROM coverage_snapshots WHERE id = ?', [id]);
  await logAudit(db, 'snapshot', String(id), 'created', actor ?? 'system',
    { coverage_pct: snapshot.coverage_pct, covered_techniques: snapshot.covered_techniques, total_techniques: snapshot.total_techniques },
    sourceIp);
  return snapshot;
}

router.get('/', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM coverage_snapshots ORDER BY taken_at ASC'));
});

router.post('/', async (req, res) => {
  const { notes } = req.body;
  const snapshot = await takeSnapshot(notes, (req as any).actor ?? 'user', (req as any).sourceIp);
  res.status(201).json(snapshot);
  snapshotComplianceCoverage(getKnex()).catch(() => {});
});

router.patch('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM coverage_snapshots WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { notes } = req.body;
  await rawRun(db, 'UPDATE coverage_snapshots SET notes = ? WHERE id = ?', [notes ?? null, req.params.id]);
  await logAudit(db, 'snapshot', req.params.id, 'annotated', (req as any).actor ?? 'user',
    { notes }, (req as any).sourceIp);
  res.json(await rawGet(db, 'SELECT * FROM coverage_snapshots WHERE id = ?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM coverage_snapshots WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  await rawRun(db, 'DELETE FROM coverage_snapshots WHERE id = ?', [req.params.id]);
  await logAudit(db, 'snapshot', req.params.id, 'deleted', (req as any).actor ?? 'user', undefined, (req as any).sourceIp);
  res.status(204).send();
});

export default router;
