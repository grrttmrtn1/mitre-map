import { Router } from 'express';
import crypto from 'crypto';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit, computeCoverageSummary, type DB } from '../db/database';
import { checkCoverageAlerts } from '../webhooks/service';
import { recordCoverageChangeDirect } from '../coverage/attribution';
import { pageOptions, pageResult } from '../lib/pagination';

const router = Router();

const VERSIONED_FIELDS = ['name', 'description', 'rule_id', 'source', 'technique_ids', 'status', 'severity', 'confidence', 'false_positive_rate', 'notes'];

async function saveVersion(db: DB, detectionId: number | string, snapshot: any, changedBy: string, summary?: string) {
  const last = await rawGet<{ v: number }>(db, 'SELECT MAX(version_number) as v FROM detection_versions WHERE detection_id=?', [detectionId]);
  const versionNumber = (Number(last?.v) || 0) + 1;
  await rawRun(db,
    'INSERT INTO detection_versions (detection_id, version_number, snapshot, changed_by, change_summary) VALUES (?, ?, ?, ?, ?)',
    [detectionId, versionNumber, JSON.stringify(snapshot), changedBy, summary ?? null]);
}

router.get('/', async (req, res) => {
  const db = getKnex();
  const { status, source, severity, technique } = req.query;
  const page = pageOptions(req);
  let sql = 'SELECT * FROM detections WHERE 1=1';
  const params: any[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }
  if (technique) { sql += ' AND technique_ids LIKE ?'; params.push(`%"${technique}"%`); }
  if (page.search) { sql += ' AND (LOWER(name) LIKE ? OR LOWER(COALESCE(rule_id,\'\')) LIKE ? OR LOWER(COALESCE(source,\'\')) LIKE ?)'; params.push(...Array(3).fill(`%${page.search.toLowerCase()}%`)); }
  const count = await rawGet<{ c: number }>(db, `SELECT COUNT(*) AS c FROM (${sql}) filtered`, params);
  sql += ' ORDER BY updated_at DESC';
  if (page.paginated) { sql += ' LIMIT ? OFFSET ?'; params.push(page.limit, page.offset); }
  const rows = await rawAll(db, sql, params);
  const parsed = rows.map((d: any) => ({ ...d, technique_ids: JSON.parse(d.technique_ids) }));
  res.json(page.paginated ? pageResult(parsed, Number(count?.c ?? 0), page.limit, page.offset) : parsed);
});

export const SEVERITY_SCORES: Record<string, number> = { critical: 25, high: 20, medium: 15, low: 10, informational: 5 };
export const CONFIDENCE_SCORES: Record<string, number> = { high: 25, medium: 15, low: 5 };
export const FP_SCORES: Record<string, number> = { low: 15, medium: 8, high: 0 };

export function computeQualityScore(
  severity: string,
  confidence: string,
  falsePositiveRate: string | null,
  techniqueIds: string[],
  validated: number,
  failed: number,
  techCoverage: Map<string, number>,
  truePositiveCount: number = 0,
  falsePositiveCount: number = 0,
): { score: number; grade: string; components: { severity: number; confidence: number; fp_rate: number; tests: number; uniqueness: number } } {
  const severityScore = SEVERITY_SCORES[severity] ?? 15;
  const confidenceScore = CONFIDENCE_SCORES[confidence] ?? 15;
  const totalFires = truePositiveCount + falsePositiveCount;
  let fpScore: number;
  if (totalFires > 0) {
    const empiricalFpRate = falsePositiveCount / totalFires;
    fpScore = empiricalFpRate < 0.1 ? 15 : empiricalFpRate < 0.3 ? 8 : 0;
  } else {
    fpScore = FP_SCORES[falsePositiveRate ?? 'medium'] ?? 8;
  }
  const testScore = Math.max(0, Math.min(30, validated * 10 - failed * 10));
  const uniqueTechs = techniqueIds.filter(t => techCoverage.get(t) === 1).length;
  const uniquenessScore = techniqueIds.length > 0 ? Math.round((uniqueTechs / techniqueIds.length) * 5) : 0;
  const total = severityScore + confidenceScore + fpScore + testScore + uniquenessScore;
  const grade = total >= 80 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : total >= 20 ? 'D' : 'F';
  return { score: total, grade, components: { severity: severityScore, confidence: confidenceScore, fp_rate: fpScore, tests: testScore, uniqueness: uniquenessScore } };
}

router.get('/quality-scores', async (_req, res) => {
  const db = getKnex();

  const detections = await rawAll<any>(db,
    'SELECT id, technique_ids, severity, confidence, false_positive_rate, true_positive_count, false_positive_count FROM detections', []);

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
    const result = computeQualityScore(d.severity, d.confidence, d.false_positive_rate, techs,
      Number(tests.validated), Number(tests.failed), techCoverage,
      Number(d.true_positive_count ?? 0), Number(d.false_positive_count ?? 0));
    return { detection_id: d.id, ...result };
  });

  res.json(scores);
});

router.get('/:id/history', async (req, res) => {
  const db = getKnex();
  const detection = await rawGet(db, 'SELECT id FROM detections WHERE id=?', [req.params.id]);
  if (!detection) return res.status(404).json({ error: 'Not found' });
  const versions = await rawAll<any>(db,
    'SELECT * FROM detection_versions WHERE detection_id=? ORDER BY version_number ASC', [req.params.id]);
  const result = versions.map((v, i) => {
    const snapshot = JSON.parse(v.snapshot);
    const diff: { field: string; from: unknown; to: unknown }[] = [];
    if (i > 0) {
      const prev = JSON.parse(versions[i - 1].snapshot);
      for (const field of VERSIONED_FIELDS) {
        if (JSON.stringify(prev[field]) !== JSON.stringify(snapshot[field])) {
          diff.push({ field, from: prev[field], to: snapshot[field] });
        }
      }
    }
    return { id: v.id, version_number: v.version_number, changed_by: v.changed_by, changed_at: v.changed_at, change_summary: v.change_summary, snapshot, diff };
  });
  res.json({ detection_id: Number(req.params.id), versions: result.reverse() });
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
  const coverageBefore = await computeCoverageSummary(db);
  const id = await rawInsert(db, `
    INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [name, description ?? null, rule_id ?? null, source ?? null, JSON.stringify(technique_ids),
    status ?? 'active', severity ?? 'medium', confidence ?? 'medium', false_positive_rate ?? null, notes ?? null]);
  const created = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [id]);
  const actor = (req as any).actor ?? 'user';
  await saveVersion(db, id, { ...created, technique_ids: JSON.parse(created.technique_ids) }, actor, 'created');
  await logAudit(db, 'detection', String(id), 'created', actor, { name }, (req as any).sourceIp);
  checkCoverageAlerts(db).catch(() => {});
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'detection', String(id), name, 'created', actor, coverageBefore, after)
  ).catch(() => {});
  res.status(201).json({ ...created, technique_ids: JSON.parse(created.technique_ids) });
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes } = req.body;
  const coverageBefore = await computeCoverageSummary(db);
  await rawRun(db, `
    UPDATE detections SET name=?, description=?, rule_id=?, source=?, technique_ids=?,
      status=?, severity=?, confidence=?, false_positive_rate=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [name, description ?? null, rule_id ?? null, source ?? null, JSON.stringify(technique_ids ?? []),
    status ?? 'active', severity ?? 'medium', confidence ?? 'medium',
    false_positive_rate ?? null, notes ?? null, req.params.id]);
  const updated = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  const actor = (req as any).actor ?? 'user';
  const prevSnap = { ...existing, technique_ids: JSON.parse((existing as any).technique_ids) };
  const newSnap = { ...updated, technique_ids: JSON.parse(updated.technique_ids) };
  const changedFields = VERSIONED_FIELDS.filter(f => JSON.stringify(prevSnap[f]) !== JSON.stringify(newSnap[f]));
  if (changedFields.length > 0) {
    await saveVersion(db, req.params.id, newSnap, actor, changedFields.join(', ') + ' changed');
  }
  await logAudit(db, 'detection', req.params.id, 'updated', actor, { status, severity }, (req as any).sourceIp);
  checkCoverageAlerts(db).catch(() => {});
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'detection', req.params.id, (updated as any).name ?? name, 'updated', actor, coverageBefore, after)
  ).catch(() => {});
  res.json({ ...updated, technique_ids: JSON.parse(updated.technique_ids) });
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  await logAudit(db, 'detection', req.params.id, 'deleted', actor, { name: existing.name }, (req as any).sourceIp);
  await rawRun(db, 'DELETE FROM detections WHERE id = ?', [req.params.id]);
  checkCoverageAlerts(db).catch(() => {});
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'detection', req.params.id, existing.name, 'deleted', actor, coverageBefore, after)
  ).catch(() => {});
  res.status(204).send();
});

router.patch('/:id/fire', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { outcome } = req.body;
  const outcomeColumns: Record<string, string> = {
    true_positive: 'true_positive_count',
    false_positive: 'false_positive_count',
    suppressed: 'suppressed_count',
  };
  const col = outcomeColumns[outcome];
  if (!col) return res.status(400).json({ error: 'outcome must be true_positive, false_positive, or suppressed' });
  await rawRun(db,
    `UPDATE detections SET ${col} = ${col} + 1, last_fired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [req.params.id]);
  const updated = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  await logAudit(db, 'detection', req.params.id, 'fire_logged', (req as any).actor ?? 'user', { outcome }, (req as any).sourceIp);
  res.json({ ...updated, technique_ids: JSON.parse(updated.technique_ids) });
});

router.patch('/:id/review', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await rawRun(db,
    'UPDATE detections SET last_reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id]);
  const updated = await rawGet<any>(db, 'SELECT * FROM detections WHERE id = ?', [req.params.id]);
  res.json({ ...updated, technique_ids: JSON.parse(updated.technique_ids) });
});

router.patch('/bulk', async (req, res) => {
  const db = getKnex();
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: 'ids array and status are required' });
  }
  const validStatuses = ['active', 'tuning', 'planned', 'disabled', 'archived'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  const placeholders = ids.map(() => '?').join(',');
  await db.transaction(async trx => {
    await trx.raw(`UPDATE detections SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, [status, ...ids]);
    for (const id of ids) await logAudit(trx, 'detection', String(id), 'bulk_status_update', actor, { status }, (req as any).sourceIp);
  });
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'detection', 'bulk', `${ids.length} detections`, 'bulk_updated', actor, coverageBefore, after)
  ).catch(() => {});
  res.json({ updated: ids.length });
});

router.delete('/bulk', async (req, res) => {
  const db = getKnex();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array is required' });
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  const placeholders = ids.map(() => '?').join(',');
  await db.transaction(async trx => {
    for (const id of ids) await logAudit(trx, 'detection', String(id), 'deleted', actor, undefined, (req as any).sourceIp);
    await trx.raw(`DELETE FROM detections WHERE id IN (${placeholders})`, ids);
  });
  computeCoverageSummary(db).then(after =>
    recordCoverageChangeDirect(db, 'detection', 'bulk', `${ids.length} detections`, 'bulk_deleted', actor, coverageBefore, after)
  ).catch(() => {});
  res.json({ deleted: ids.length });
});

router.post('/import', async (req, res) => {
  const db = getKnex();
  const { detections } = req.body;
  if (!Array.isArray(detections)) return res.status(400).json({ error: 'detections array required' });
  if (detections.length > 5000) return res.status(413).json({ error: 'A single import is limited to 5,000 detections' });
  const existing = await rawAll<{ name: string; source: string | null; rule_id: string | null }>(db, 'SELECT name, source, rule_id FROM detections');
  const duplicateKeys = new Set(existing.flatMap(d => [d.rule_id ? `rule:${d.rule_id}` : '', `name:${d.name}|${d.source ?? ''}`]).filter(Boolean));
  const preview = detections.map((d: any, index: number) => {
    const errors: string[] = [];
    if (!d?.name || typeof d.name !== 'string') errors.push('name is required');
    if (!Array.isArray(d?.technique_ids) || d.technique_ids.length === 0) errors.push('technique_ids must be a non-empty array');
    const duplicate = Boolean((d?.rule_id && duplicateKeys.has(`rule:${d.rule_id}`)) || duplicateKeys.has(`name:${d?.name}|${d?.source ?? ''}`));
    return { index, action: errors.length ? 'invalid' : duplicate ? 'duplicate' : 'create', errors };
  });
  const summary = {
    total: preview.length,
    create: preview.filter(p => p.action === 'create').length,
    duplicate: preview.filter(p => p.action === 'duplicate').length,
    invalid: preview.filter(p => p.action === 'invalid').length,
  };
  if (req.query.preview === 'true' || req.body.preview === true) return res.json({ summary, rows: preview });
  const actor = (req as any).actor ?? 'user';
  const coverageBefore = await computeCoverageSummary(db);
  let imported = 0;
  const importedIds: number[] = [];
  await db.transaction(async trx => {
    for (const item of preview) {
      if (item.action !== 'create') continue;
      const d = detections[item.index];
      const id = await rawInsert(trx, `
        INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
      `, [d.name, d.description ?? null, d.rule_id ?? null, d.source ?? null,
        JSON.stringify(d.technique_ids),
        d.status ?? 'active', d.severity ?? 'medium', d.confidence ?? 'medium', d.notes ?? null]);
      importedIds.push(id);
      imported++;
    }
    if (imported > 0) {
      await logAudit(trx, 'detection_import', crypto.randomUUID(), 'applied', actor, { count: imported, detection_ids: importedIds }, (req as any).sourceIp);
    }
  });
  if (imported > 0) {
    computeCoverageSummary(db).then(after =>
      recordCoverageChangeDirect(db, 'detection', 'bulk', `${imported} detections`, 'imported', actor, coverageBefore, after)
    ).catch(() => {});
  }
  const audit = await rawGet<any>(db, "SELECT id,entity_id,created_at FROM audit_log WHERE entity_type='detection_import' AND actor=? ORDER BY id DESC", [actor]);
  res.json({ imported, skipped: summary.duplicate, invalid: summary.invalid, import_id: audit?.id, batch_id: audit?.entity_id });
});

router.delete('/imports/:id/rollback', async (req, res) => {
  const db = getKnex();
  const audit = await rawGet<any>(db, "SELECT * FROM audit_log WHERE id=? AND entity_type='detection_import' AND action='applied'", [req.params.id]);
  if (!audit) return res.status(404).json({ error: 'Import batch not found or already rolled back' });
  const changes = JSON.parse(audit.changes ?? '{}');
  const ids = Array.isArray(changes.detection_ids) ? changes.detection_ids.filter(Number.isInteger) : [];
  if (!ids.length) return res.status(409).json({ error: 'This import has no rollback manifest' });
  const placeholders = ids.map(() => '?').join(',');
  let deleted = 0;
  await db.transaction(async trx => {
    const count = await rawGet<{ c: number }>(trx, `SELECT COUNT(*) AS c FROM detections WHERE id IN (${placeholders})`, ids);
    deleted = Number(count?.c ?? 0);
    await rawRun(trx, `DELETE FROM detections WHERE id IN (${placeholders})`, ids);
    await rawRun(trx, "UPDATE audit_log SET action='rolled_back' WHERE id=?", [audit.id]);
    await logAudit(trx, 'detection_import', audit.entity_id, 'rollback', (req as any).actor ?? 'user', { deleted }, (req as any).sourceIp);
  });
  res.json({ rolled_back: deleted });
});

export default router;
