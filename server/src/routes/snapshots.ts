import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM coverage_snapshots ORDER BY taken_at ASC').all());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { notes } = req.body;

  const total = (db.prepare('SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique=0').get() as any).c;
  const active = db.prepare("SELECT technique_ids FROM detections WHERE status='active'").all() as any[];
  const covered = new Set<string>();
  for (const d of active) for (const id of JSON.parse(d.technique_ids)) covered.add(id);

  const coveredCount = covered.size;
  const mitigated = (db.prepare(`
    SELECT COUNT(DISTINCT tm.technique_id) as c FROM technique_mitigations tm
    JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
    JOIN tools t ON tlm.tool_id = t.id WHERE t.status = 'active'
  `).get() as any).c;

  const result = db.prepare(`
    INSERT INTO coverage_snapshots (total_techniques, covered_techniques, detected_techniques,
      mitigated_techniques, gap_techniques, coverage_pct, active_detections, total_tools, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    total, coveredCount, coveredCount, mitigated,
    total - coveredCount,
    Math.round((coveredCount / total) * 100),
    (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active'").get() as any).c,
    (db.prepare("SELECT COUNT(*) as c FROM tools WHERE status='active'").get() as any).c,
    notes ?? null
  );

  res.status(201).json(db.prepare('SELECT * FROM coverage_snapshots WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM coverage_snapshots WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.prepare('DELETE FROM coverage_snapshots WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
