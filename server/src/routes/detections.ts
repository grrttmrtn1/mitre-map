import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (req, res) => {
  const db = getKnex();
  const { status, source, severity, technique } = req.query;
  let sql = 'SELECT * FROM detections WHERE 1=1';
  const params: any[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }
  if (technique) { sql += ' AND technique_ids LIKE ?'; params.push(`%"${technique}"%`); }
  sql += ' ORDER BY updated_at DESC';
  const rows = await rawAll(db, sql, params);
  res.json(rows.map((d: any) => ({ ...d, technique_ids: JSON.parse(d.technique_ids) })));
});

const SEVERITY_SCORES: Record<string, number> = { critical: 25, high: 20, medium: 15, low: 10, informational: 5 };
const CONFIDENCE_SCORES: Record<string, number> = { high: 25, medium: 15, low: 5 };
const FP_SCORES: Record<string, number> = { low: 15, medium: 8, high: 0 };

router.get('/quality-scores', async (_req, res) => {
  const db = getKnex();

  const detections = await rawAll<any>(db,
    'SELECT id, technique_ids, severity, confidence, false_positive_rate FROM detections', []);

  const testRows = await rawAll<any>(db, `
    SELECT detection_id,
      SUM(CASE WHEN status='validated' THEN 1 ELSE 0 END) AS validated,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
    FROM detection_art_results
    GROUP BY detection_id
  `, []);
  const testMap = new Map(testRows.map((r: any) => [r.detection_id, r]));

  // count how many detections cover each technique to compute uniqueness
  const techCoverage = new Map<string, number>();
  for (const d of detections) {
    const techs = JSON.parse(d.technique_ids) as string[];
    for (const t of techs) techCoverage.set(t, (techCoverage.get(t) ?? 0) + 1);
  }

  const scores = detections.map((d: any) => {
    const techs = JSON.parse(d.technique_ids) as string[];
    const tests = testMap.get(d.id) ?? { validated: 0, failed: 0 };

    const severityScore = SEVERITY_SCORES[d.severity] ?? 15;
    const confidenceScore = CONFIDENCE_SCORES[d.confidence] ?? 15;
    const fpScore = FP_SCORES[d.false_positive_rate ?? 'medium'] ?? 8;
    const testScore = Math.max(0, Math.min(30, Number(tests.validated) * 10 - Number(tests.failed) * 10));
    const uniqueTechs = techs.filter(t => techCoverage.get(t) === 1).length;
    const uniquenessScore = techs.length > 0 ? Math.round((uniqueTechs / techs.length) * 5) : 0;

    const total = severityScore + confidenceScore + fpScore + testScore + uniquenessScore;
    const grade = total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : total >= 20 ? 'D' : 'F';

    return {
      detection_id: d.id,
      score: total,
      grade,
      components: { severity: severityScore, confidence: confidenceScore, fp_rate: fpScore, tests: testScore, uniqueness: uniquenessScore },
    };
  });

  res.json(scores);
});

router.get('/:id', async (req, res) => {
  const db = getKnex();
  const detection = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!detection) return res.status(404).json({ error: 'Not found' });
  res.json({ ...detection, technique_ids: JSON.parse(detection.technique_ids) });
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes } = req.body;
  if (!name || !technique_ids) return res.status(400).json({ error: 'name and technique_ids are required' });
  const id = await rawInsert(db, `
    INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [name, description ?? null, rule_id ?? null, source ?? null, JSON.stringify(technique_ids),
    status ?? 'active', severity ?? 'medium', confidence ?? 'medium', false_positive_rate ?? null, notes ?? null]);
  const created = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [id]);
  await logAudit(db, 'detection', String(id), 'created', (req as any).actor ?? 'user', { name }, (req as any).sourceIp);
  res.status(201).json({ ...created, technique_ids: JSON.parse(created.technique_ids) });
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes } = req.body;
  await rawRun(db, `
    UPDATE detections SET name=?, description=?, rule_id=?, source=?, technique_ids=?,
      status=?, severity=?, confidence=?, false_positive_rate=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [name, description ?? null, rule_id ?? null, source ?? null, JSON.stringify(technique_ids ?? []),
    status ?? 'active', severity ?? 'medium', confidence ?? 'medium',
    false_positive_rate ?? null, notes ?? null, req.params.id]);
  const updated = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  await logAudit(db, 'detection', req.params.id, 'updated', (req as any).actor ?? 'user', { status, severity }, (req as any).sourceIp);
  res.json({ ...updated, technique_ids: JSON.parse(updated.technique_ids) });
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await logAudit(db, 'detection', req.params.id, 'deleted', (req as any).actor ?? 'user', { name: existing.name }, (req as any).sourceIp);
  await rawRun(db, 'DELETE FROM detections WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

router.patch('/bulk', async (req, res) => {
  const db = getKnex();
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: 'ids array and status are required' });
  }
  const validStatuses = ['active', 'tuning', 'planned', 'disabled', 'archived'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const placeholders = ids.map(() => '?').join(',');
  await db.transaction(async trx => {
    await trx.raw(`UPDATE detections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, [status, ...ids]);
    for (const id of ids) await logAudit(trx, 'detection', String(id), 'bulk_status_update', (req as any).actor ?? 'user', { status }, (req as any).sourceIp);
  });
  res.json({ updated: ids.length });
});

router.delete('/bulk', async (req, res) => {
  const db = getKnex();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
  const placeholders = ids.map(() => '?').join(',');
  await db.transaction(async trx => {
    for (const id of ids) await logAudit(trx, 'detection', String(id), 'deleted', (req as any).actor ?? 'user', undefined, (req as any).sourceIp);
    await trx.raw(`DELETE FROM detections WHERE id IN (${placeholders})`, ids);
  });
  res.json({ deleted: ids.length });
});

router.post('/import', async (req, res) => {
  const db = getKnex();
  const { detections } = req.body;
  if (!Array.isArray(detections)) return res.status(400).json({ error: 'detections array required' });
  let imported = 0;
  await db.transaction(async trx => {
    for (const d of detections) {
      if (!d.name || !d.technique_ids) continue;
      await trx.raw(`
        INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [d.name, d.description ?? null, d.rule_id ?? null, d.source ?? null,
        JSON.stringify(Array.isArray(d.technique_ids) ? d.technique_ids : [d.technique_ids]),
        d.status ?? 'active', d.severity ?? 'medium', d.confidence ?? 'medium', d.notes ?? null]);
      imported++;
    }
    if (imported > 0) {
      await logAudit(trx, 'detection', 'bulk', 'imported', (req as any).actor ?? 'user',
        { count: imported }, (req as any).sourceIp);
    }
  });
  res.json({ imported });
});

export default router;
