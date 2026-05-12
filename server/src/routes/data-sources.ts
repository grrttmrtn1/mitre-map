import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  const sources = await rawAll<any>(db, `
    SELECT ds.*, ods.status as org_status, ods.collection_method, ods.notes as org_notes,
           COUNT(tds.technique_id) as technique_count
    FROM data_sources ds
    LEFT JOIN org_data_sources ods ON ds.id = ods.data_source_id
    LEFT JOIN technique_data_sources tds ON ds.id = tds.data_source_id
    GROUP BY ds.id ORDER BY ds.category, ds.name
  `, []);
  res.json(sources);
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, category, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!category?.trim()) return res.status(400).json({ error: 'category is required' });
  try {
    const id = await rawInsert(db, 'INSERT INTO data_sources (name, category, description) VALUES (?, ?, ?) RETURNING id',
      [name.trim(), category.trim(), description?.trim() ?? null]);
    await logAudit(db, 'data_source', String(id), 'created', (req as any).actor ?? 'user',
      { name: name.trim(), category: category.trim() }, (req as any).sourceIp);
    const source = await rawGet<any>(db, `
      SELECT ds.*, ods.status as org_status, ods.collection_method, ods.notes as org_notes,
             0 as technique_count
      FROM data_sources ds
      LEFT JOIN org_data_sources ods ON ds.id = ods.data_source_id
      WHERE ds.id=?
    `, [id]);
    res.status(201).json(source);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'A data source with this name already exists' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const ds = await rawGet<any>(db, 'SELECT id FROM data_sources WHERE id=?', [req.params.id]);
  if (!ds) return res.status(404).json({ error: 'Not found' });
  const { name, category, description } = req.body;
  await rawRun(db, 'UPDATE data_sources SET name=COALESCE(?,name), category=COALESCE(?,category), description=? WHERE id=?',
    [name?.trim() ?? null, category?.trim() ?? null, description !== undefined ? (description?.trim() ?? null) : undefined, req.params.id]);
  await logAudit(db, 'data_source', req.params.id, 'updated', (req as any).actor ?? 'user',
    { name, category }, (req as any).sourceIp);
  const source = await rawGet<any>(db, `
    SELECT ds.*, ods.status as org_status, ods.collection_method, ods.notes as org_notes,
           COUNT(tds.technique_id) as technique_count
    FROM data_sources ds
    LEFT JOIN org_data_sources ods ON ds.id = ods.data_source_id
    LEFT JOIN technique_data_sources tds ON ds.id = tds.data_source_id
    WHERE ds.id=?
    GROUP BY ds.id
  `, [req.params.id]);
  res.json(source);
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const ds = await rawGet<any>(db, 'SELECT id, name FROM data_sources WHERE id=?', [req.params.id]);
  if (!ds) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM org_data_sources WHERE data_source_id=?', [req.params.id]);
  await rawRun(db, 'DELETE FROM technique_data_sources WHERE data_source_id=?', [req.params.id]);
  await rawRun(db, 'DELETE FROM data_sources WHERE id=?', [req.params.id]);
  await logAudit(db, 'data_source', req.params.id, 'deleted', (req as any).actor ?? 'user',
    { name: ds.name }, (req as any).sourceIp);
  res.status(204).end();
});

router.post('/:id/techniques', async (req, res) => {
  const db = getKnex();
  const ds = await rawGet<any>(db, 'SELECT id FROM data_sources WHERE id=?', [req.params.id]);
  if (!ds) return res.status(404).json({ error: 'Not found' });
  const { technique_id } = req.body;
  if (!technique_id) return res.status(400).json({ error: 'technique_id is required' });
  const tech = await rawGet<any>(db, 'SELECT id FROM attack_techniques WHERE id=?', [technique_id]);
  if (!tech) return res.status(404).json({ error: 'Technique not found' });
  await rawRun(db, 'INSERT OR IGNORE INTO technique_data_sources (technique_id, data_source_id) VALUES (?, ?)', [technique_id, req.params.id]);
  await logAudit(db, 'data_source', req.params.id, 'technique_linked', (req as any).actor ?? 'user',
    { technique_id }, (req as any).sourceIp);
  res.json({ ok: true });
});

router.delete('/:id/techniques/:technique_id', async (req, res) => {
  const db = getKnex();
  await rawRun(db, 'DELETE FROM technique_data_sources WHERE data_source_id=? AND technique_id=?', [req.params.id, req.params.technique_id]);
  await logAudit(db, 'data_source', req.params.id, 'technique_unlinked', (req as any).actor ?? 'user',
    { technique_id: req.params.technique_id }, (req as any).sourceIp);
  res.status(204).end();
});

router.get('/:id/techniques', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM data_sources WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const techniques = await rawAll<any>(db, `
    SELECT t.id, t.name, t.tactic_ids, t.is_subtechnique, t.parent_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%'
      ) THEN 1 ELSE 0 END as has_detection
    FROM attack_techniques t
    JOIN technique_data_sources tds ON t.id = tds.technique_id
    WHERE tds.data_source_id=?
    ORDER BY t.id
  `, [req.params.id]);
  res.json(techniques.map(t => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })));
});

router.put('/:id/status', async (req, res) => {
  const db = getKnex();
  const ds = await rawGet<any>(db, 'SELECT id FROM data_sources WHERE id=?', [req.params.id]);
  if (!ds) return res.status(404).json({ error: 'Not found' });
  const { status, collection_method, notes } = req.body;
  const validStatuses = ['collecting', 'partial', 'not_collecting'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = await rawGet<any>(db, 'SELECT id, collection_method, notes FROM org_data_sources WHERE data_source_id=?', [req.params.id]);
  if (existing) {
    await rawRun(db, `UPDATE org_data_sources SET status=COALESCE(?,status), collection_method=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE data_source_id=?`,
      [status ?? null, collection_method !== undefined ? collection_method : existing.collection_method, notes !== undefined ? notes : existing.notes, req.params.id]);
  } else {
    await rawRun(db, 'INSERT INTO org_data_sources (data_source_id, status, collection_method, notes) VALUES (?, ?, ?, ?)',
      [req.params.id, status ?? 'not_collecting', collection_method ?? null, notes ?? null]);
  }
  await logAudit(db, 'data_source', req.params.id, 'status_updated', (req as any).actor ?? 'user',
    { status, collection_method }, (req as any).sourceIp);
  res.json(await rawGet(db, `SELECT ds.*, ods.status as org_status, ods.collection_method, ods.notes as org_notes FROM data_sources ds LEFT JOIN org_data_sources ods ON ds.id=ods.data_source_id WHERE ds.id=?`, [req.params.id]));
});

router.get('/technique/:technique_id', async (req, res) => {
  const db = getKnex();
  const sources = await rawAll<any>(db, `
    SELECT ds.*, ods.status as org_status, ods.collection_method
    FROM data_sources ds
    JOIN technique_data_sources tds ON ds.id=tds.data_source_id
    LEFT JOIN org_data_sources ods ON ds.id=ods.data_source_id
    WHERE tds.technique_id=? ORDER BY ds.category, ds.name
  `, [req.params.technique_id]);
  res.json(sources);
});

router.get('/analysis', async (_req, res) => {
  const db = getKnex();

  const gaps = await rawAll<any>(db, `
    SELECT DISTINCT t.id, t.name, t.tactic_ids FROM attack_techniques t
    WHERE t.is_subtechnique=0
    AND NOT EXISTS (
      SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM attack_techniques sub
      JOIN detections d ON d.status='active' AND d.technique_ids LIKE '%"' || sub.id || '"%'
      WHERE sub.parent_id=t.id AND sub.is_subtechnique=1
    )
  `, []);

  const result = await Promise.all(gaps.map(async (t: any) => {
    const sources = await rawAll<any>(db, `
      SELECT ds.name, ds.category, COALESCE(ods.status, 'not_collecting') as org_status
      FROM data_sources ds
      JOIN technique_data_sources tds ON ds.id=tds.data_source_id
      LEFT JOIN org_data_sources ods ON ds.id=ods.data_source_id
      WHERE tds.technique_id=?
    `, [t.id]);

    let gap_reason: string;
    if (sources.length === 0) {
      gap_reason = 'unknown';
    } else if (sources.some((s: any) => s.org_status !== 'not_collecting')) {
      gap_reason = 'has_data_no_rule';
    } else {
      gap_reason = 'no_data_source';
    }

    return { ...t, tactic_ids: JSON.parse(t.tactic_ids), sources, gap_reason };
  }));

  res.json({ total_gaps: result.length, gaps: result });
});

export default router;
