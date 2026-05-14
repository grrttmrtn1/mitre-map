import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';
import { parseArtYaml, fetchArtFromGithub } from '../data/atomic-tests';
import { checkValidationFailedAlerts } from '../webhooks/service';

const router = Router();

router.get('/tests', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, `
    SELECT at.*,
      COALESCE(
        (SELECT t.name FROM attack_techniques t WHERE t.id = CASE
          WHEN INSTR(at.technique_id, '.') > 0
          THEN SUBSTR(at.technique_id, 1, INSTR(at.technique_id, '.') - 1)
          ELSE at.technique_id END),
        at.technique_id
      ) as technique_name
    FROM art_tests at
    ORDER BY at.technique_id, at.name
  `, []));
});

router.get('/tests/:technique_id', async (req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, `
    SELECT at.*,
      COALESCE(
        (SELECT t.name FROM attack_techniques t WHERE t.id = CASE
          WHEN INSTR(at.technique_id, '.') > 0
          THEN SUBSTR(at.technique_id, 1, INSTR(at.technique_id, '.') - 1)
          ELSE at.technique_id END),
        at.technique_id
      ) as technique_name
    FROM art_tests at
    WHERE at.technique_id=?
    ORDER BY at.name
  `, [req.params.technique_id]));
});

router.get('/coverage', async (_req, res) => {
  const db = getKnex();
  const techniques = await rawAll<any>(db, 'SELECT id, name FROM attack_techniques WHERE is_subtechnique=0', []);
  const result = await Promise.all(techniques.map(async (t: any) => {
    const { c } = await rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM art_tests WHERE technique_id LIKE ?', [`${t.id}%`]) as any;
    return { technique_id: t.id, technique_name: t.name, test_count: c };
  }));
  const covered = result.filter(r => r.test_count > 0).length;
  res.json({ total: techniques.length, covered, pct: techniques.length ? Math.round((covered / techniques.length) * 100) : 0, techniques: result });
});

router.post('/results', async (req, res) => {
  const db = getKnex();
  const { detection_id, art_test_id, status = 'untested', notes, run_by } = req.body;
  if (!detection_id || !art_test_id) return res.status(400).json({ error: 'detection_id and art_test_id are required' });
  const validStatuses = ['untested', 'tested', 'validated', 'failed'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (!await rawGet(db, 'SELECT id FROM detections WHERE id=?', [detection_id])) return res.status(404).json({ error: 'Detection not found' });
  if (!await rawGet(db, 'SELECT id FROM art_tests WHERE id=?', [art_test_id])) return res.status(404).json({ error: 'ART test not found' });
  const id = await rawInsert(db, 'INSERT INTO detection_art_results (detection_id, art_test_id, status, notes, run_by, run_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id',
    [detection_id, art_test_id, status, notes ?? null, run_by ?? (req as any).actor ?? null]);
  await logAudit(db, 'detection', String(detection_id), 'test_result_added',
    (req as any).actor ?? 'user', { art_test_id, status }, (req as any).sourceIp);
  if (status === 'failed') {
    const [det, test] = await Promise.all([
      rawGet<any>(db, 'SELECT name FROM detections WHERE id=?', [detection_id]),
      rawGet<any>(db, 'SELECT name FROM art_tests WHERE id=?', [art_test_id]),
    ]);
    checkValidationFailedAlerts(db, detection_id, det?.name ?? String(detection_id), test?.name ?? String(art_test_id)).catch(() => {});
  }
  res.status(201).json(await rawGet(db, 'SELECT * FROM detection_art_results WHERE id=?', [id]));
});

router.put('/results/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM detection_art_results WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { status, notes, run_by } = req.body;
  const validStatuses = ['untested', 'tested', 'validated', 'failed'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await rawRun(db, 'UPDATE detection_art_results SET status=COALESCE(?,status), notes=COALESCE(?,notes), run_by=COALESCE(?,run_by), updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [status ?? null, notes ?? null, run_by ?? null, req.params.id]);
  const result = await rawGet<any>(db, 'SELECT * FROM detection_art_results WHERE id=?', [req.params.id]);
  await logAudit(db, 'detection', String(result.detection_id), 'test_result_updated',
    (req as any).actor ?? 'user', { art_result_id: req.params.id, status }, (req as any).sourceIp);
  res.json(result);
});

router.delete('/results/:id', async (req, res) => {
  const db = getKnex();
  const result = await rawGet<any>(db, 'SELECT * FROM detection_art_results WHERE id=?', [req.params.id]);
  if (!result) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM detection_art_results WHERE id=?', [req.params.id]);
  await logAudit(db, 'detection', String(result.detection_id), 'test_result_deleted',
    (req as any).actor ?? 'user', { art_result_id: req.params.id }, (req as any).sourceIp);
  res.status(204).end();
});

router.post('/custom', async (req, res) => {
  const db = getKnex();
  const { technique_id, name, description, platform, executor_type, command } = req.body;
  if (!technique_id || !name?.trim()) return res.status(400).json({ error: 'technique_id and name are required' });
  if (!await rawGet(db, 'SELECT id FROM attack_techniques WHERE id=?', [technique_id])) return res.status(404).json({ error: 'Technique not found' });
  const id = await rawInsert(db,
    'INSERT INTO art_tests (technique_id, test_guid, name, description, platform, executor_type, auto_generated_command, source) VALUES (?, NULL, ?, ?, ?, ?, ?, \'custom\') RETURNING id',
    [technique_id, name.trim(), description ?? null, platform ?? '', executor_type ?? '', command ?? null]);
  await logAudit(db, 'art_test', String(id), 'created', (req as any).actor ?? 'user',
    { technique_id, name: name.trim() }, (req as any).sourceIp);
  res.status(201).json(await rawGet(db, 'SELECT * FROM art_tests WHERE id=?', [id]));
});

router.put('/custom/:id', async (req, res) => {
  const db = getKnex();
  const test = await rawGet<any>(db, 'SELECT * FROM art_tests WHERE id=? AND source=\'custom\'', [req.params.id]);
  if (!test) return res.status(404).json({ error: 'Custom test not found' });
  const { name, description, platform, executor_type, command } = req.body;
  if (name !== undefined && !name?.trim()) return res.status(400).json({ error: 'name cannot be empty' });
  await rawRun(db,
    'UPDATE art_tests SET name=COALESCE(?,name), description=COALESCE(?,description), platform=COALESCE(?,platform), executor_type=COALESCE(?,executor_type), auto_generated_command=COALESCE(?,auto_generated_command) WHERE id=?',
    [name?.trim() ?? null, description ?? null, platform ?? null, executor_type ?? null, command ?? null, req.params.id]);
  await logAudit(db, 'art_test', req.params.id, 'updated', (req as any).actor ?? 'user',
    { technique_id: test.technique_id, name: name?.trim() ?? test.name }, (req as any).sourceIp);
  res.json(await rawGet(db, 'SELECT * FROM art_tests WHERE id=?', [req.params.id]));
});

router.delete('/custom/:id', async (req, res) => {
  const db = getKnex();
  const test = await rawGet<any>(db, 'SELECT * FROM art_tests WHERE id=? AND source=\'custom\'', [req.params.id]);
  if (!test) return res.status(404).json({ error: 'Custom test not found' });
  await rawRun(db, 'DELETE FROM art_tests WHERE id=?', [req.params.id]);
  await logAudit(db, 'art_test', req.params.id, 'deleted', (req as any).actor ?? 'user',
    { technique_id: test.technique_id, name: test.name }, (req as any).sourceIp);
  res.status(204).end();
});

router.post('/import', async (req, res) => {
  const db = getKnex();
  const { yaml } = req.body;
  if (!yaml?.trim()) return res.status(400).json({ error: 'yaml is required' });

  const tests = parseArtYaml(yaml);
  let imported = 0;
  let skipped = 0;
  for (const t of tests) {
    if (!t.test_guid || !t.technique_id) { skipped++; continue; }
    const exists = await rawGet(db, 'SELECT id FROM art_tests WHERE test_guid=?', [t.test_guid]);
    if (exists) { skipped++; continue; }
    await rawRun(db, 'INSERT INTO art_tests (technique_id, test_guid, name, description, platform, executor_type, auto_generated_command) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [t.technique_id, t.test_guid, t.name || 'Unnamed', t.description || '', t.platform || '', t.executor_type || '', t.auto_generated_command || '']);
    imported++;
  }
  if (imported > 0) {
    await logAudit(db, 'art_test', 'bulk', 'imported', (req as any).actor ?? 'user',
      { imported, skipped }, (req as any).sourceIp);
  }
  res.json({ imported, skipped, total: tests.length });
});

router.post('/sync', async (req, res) => {
  const db = getKnex();
  const tests = await fetchArtFromGithub();
  if (!tests) return res.status(502).json({ error: 'Failed to fetch ART index from GitHub' });

  let imported = 0;
  let skipped = 0;
  for (const t of tests) {
    if (!t.test_guid || !t.technique_id) { skipped++; continue; }
    const techExists = await rawGet(db, 'SELECT id FROM attack_techniques WHERE id=?', [t.technique_id]);
    if (!techExists) { skipped++; continue; }
    const exists = await rawGet(db, 'SELECT id FROM art_tests WHERE test_guid=?', [t.test_guid]);
    if (exists) { skipped++; continue; }
    await rawRun(db, 'INSERT INTO art_tests (technique_id, test_guid, name, description, platform, executor_type, auto_generated_command) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [t.technique_id, t.test_guid, t.name || 'Unnamed', t.description || '', t.platform || '', t.executor_type || '', t.auto_generated_command || '']);
    imported++;
  }
  if (imported > 0) {
    await logAudit(db, 'art_test', 'bulk', 'synced', (req as any).actor ?? 'user',
      { imported, skipped, source: 'github' }, (req as any).sourceIp);
  }
  res.json({ imported, skipped, total: tests.length });
});

export default router;
