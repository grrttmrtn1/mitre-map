import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

// ── List exercises ──────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  const db = getKnex();
  const exercises = await rawAll<any>(db, `
    SELECT e.*,
      tg.name as threat_group_name,
      (SELECT COUNT(*) FROM exercise_techniques et WHERE et.exercise_id=e.id) as technique_count,
      (SELECT COUNT(*) FROM exercise_test_runs etr WHERE etr.exercise_id=e.id) as test_run_count,
      (SELECT COUNT(*) FROM exercise_test_runs etr WHERE etr.exercise_id=e.id AND etr.outcome='detected') as detected_count,
      (SELECT COUNT(*) FROM exercise_findings ef WHERE ef.exercise_id=e.id) as finding_count
    FROM exercises e
    LEFT JOIN threat_groups tg ON tg.id=e.threat_group_id
    ORDER BY e.created_at DESC
  `, []);
  res.json(exercises);
});

// ── Create exercise ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, description, type = 'purple_team', status = 'planning', threat_group_id,
    scope_notes, start_date, end_date, lead } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const validTypes = ['red_team', 'purple_team', 'tabletop'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (threat_group_id && !await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [threat_group_id]))
    return res.status(404).json({ error: 'Threat group not found' });

  const id = await rawInsert(db, `
    INSERT INTO exercises (name, description, type, status, threat_group_id, scope_notes, start_date, end_date, lead, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [name.trim(), description ?? null, type, status, threat_group_id ?? null,
    scope_notes ?? null, start_date ?? null, end_date ?? null, lead ?? null,
    (req as any).actor ?? null]);

  // Auto-populate techniques from threat group
  if (threat_group_id) {
    const techniques = await rawAll<{ technique_id: string }>(db,
      'SELECT technique_id FROM group_techniques WHERE group_id=?', [threat_group_id]);
    for (const { technique_id } of techniques) {
      const exists = await rawGet(db, 'SELECT id FROM attack_techniques WHERE id=?', [technique_id]);
      if (exists) {
        await rawRun(db,
          'INSERT OR IGNORE INTO exercise_techniques (exercise_id, technique_id) VALUES (?, ?)',
          [id, technique_id]);
      }
    }
  }

  await logAudit(db, 'exercise', String(id), 'created', (req as any).actor ?? 'user',
    { name: name.trim(), type }, (req as any).sourceIp);
  res.status(201).json(await rawGet(db, 'SELECT * FROM exercises WHERE id=?', [id]));
});

// ── Get exercise detail ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const db = getKnex();
  const exercise = await rawGet<any>(db, `
    SELECT e.*, tg.name as threat_group_name
    FROM exercises e
    LEFT JOIN threat_groups tg ON tg.id=e.threat_group_id
    WHERE e.id=?
  `, [req.params.id]);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  const [techniques, testRuns, findings] = await Promise.all([
    rawAll<any>(db, `
      SELECT et.technique_id, t.name as technique_name, t.tactic_ids,
        (SELECT COUNT(*) FROM art_tests at2 WHERE at2.technique_id LIKE et.technique_id || '%') as available_tests
      FROM exercise_techniques et
      JOIN attack_techniques t ON t.id=et.technique_id
      WHERE et.exercise_id=?
      ORDER BY et.technique_id
    `, [req.params.id]),
    rawAll<any>(db, `
      SELECT etr.*, at.name as test_name, at.technique_id, at.platform, at.executor_type,
        at.auto_generated_command, at.description as test_description
      FROM exercise_test_runs etr
      JOIN art_tests at ON at.id=etr.art_test_id
      WHERE etr.exercise_id=?
      ORDER BY at.technique_id, etr.created_at
    `, [req.params.id]),
    rawAll<any>(db, `
      SELECT ef.*, t.name as technique_name
      FROM exercise_findings ef
      LEFT JOIN attack_techniques t ON t.id=ef.technique_id
      WHERE ef.exercise_id=?
      ORDER BY CASE ef.severity
        WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3
        WHEN 'low' THEN 4 ELSE 5 END, ef.created_at DESC
    `, [req.params.id]),
  ]);

  const techniquesWithTactics = techniques.map((t: any) => ({
    ...t, tactic_ids: JSON.parse(t.tactic_ids ?? '[]'),
  }));

  res.json({ ...exercise, techniques: techniquesWithTactics, test_runs: testRuns, findings });
});

// ── Update exercise ─────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const db = getKnex();
  const exercise = await rawGet<any>(db, 'SELECT * FROM exercises WHERE id=?', [req.params.id]);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  const { name, description, type, status, threat_group_id, scope_notes, start_date, end_date, lead } = req.body;
  const validTypes = ['red_team', 'purple_team', 'tabletop'];
  const validStatuses = ['planning', 'active', 'completed', 'cancelled'];
  if (type && !validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (name !== undefined && !name?.trim()) return res.status(400).json({ error: 'name cannot be empty' });

  await rawRun(db, `
    UPDATE exercises SET
      name=COALESCE(?,name), description=COALESCE(?,description), type=COALESCE(?,type),
      status=COALESCE(?,status), threat_group_id=COALESCE(?,threat_group_id),
      scope_notes=COALESCE(?,scope_notes), start_date=COALESCE(?,start_date),
      end_date=COALESCE(?,end_date), lead=COALESCE(?,lead), updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [name?.trim() ?? null, description ?? null, type ?? null, status ?? null,
    threat_group_id ?? null, scope_notes ?? null, start_date ?? null,
    end_date ?? null, lead ?? null, req.params.id]);

  await logAudit(db, 'exercise', req.params.id, 'updated', (req as any).actor ?? 'user',
    req.body, (req as any).sourceIp);
  res.json(await rawGet(db, 'SELECT * FROM exercises WHERE id=?', [req.params.id]));
});

// ── Delete exercise ─────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercises WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Exercise not found' });
  await rawRun(db, 'DELETE FROM exercises WHERE id=?', [req.params.id]);
  await logAudit(db, 'exercise', req.params.id, 'deleted', (req as any).actor ?? 'user',
    {}, (req as any).sourceIp);
  res.status(204).end();
});

// ── Techniques ──────────────────────────────────────────────────────────────
router.post('/:id/techniques', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercises WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Exercise not found' });
  const { technique_ids } = req.body;
  if (!Array.isArray(technique_ids) || !technique_ids.length)
    return res.status(400).json({ error: 'technique_ids array required' });
  let added = 0;
  for (const tid of technique_ids) {
    if (!await rawGet(db, 'SELECT id FROM attack_techniques WHERE id=?', [tid])) continue;
    await rawRun(db, 'INSERT OR IGNORE INTO exercise_techniques (exercise_id, technique_id) VALUES (?, ?)',
      [req.params.id, tid]);
    added++;
  }
  res.json({ added });
});

router.delete('/:id/techniques/:technique_id', async (req, res) => {
  const db = getKnex();
  await rawRun(db,
    'DELETE FROM exercise_techniques WHERE exercise_id=? AND technique_id=?',
    [req.params.id, req.params.technique_id]);
  res.status(204).end();
});

// ── Test Runs ───────────────────────────────────────────────────────────────
router.post('/:id/tests', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercises WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Exercise not found' });
  const { art_test_id, outcome = 'pending', blocked = false, notes, ran_by } = req.body;
  if (!art_test_id) return res.status(400).json({ error: 'art_test_id is required' });
  const validOutcomes = ['pending', 'detected', 'not_detected', 'partial', 'n_a'];
  if (!validOutcomes.includes(outcome)) return res.status(400).json({ error: 'Invalid outcome' });
  if (!await rawGet(db, 'SELECT id FROM art_tests WHERE id=?', [art_test_id]))
    return res.status(404).json({ error: 'ART test not found' });

  const rid = await rawInsert(db, `
    INSERT INTO exercise_test_runs (exercise_id, art_test_id, outcome, blocked, notes, ran_by, ran_at)
    VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? != 'pending' THEN CURRENT_TIMESTAMP ELSE NULL END) RETURNING id
  `, [req.params.id, art_test_id, outcome, blocked ? 1 : 0, notes ?? null, ran_by ?? null, outcome]);

  await logAudit(db, 'exercise', req.params.id, 'test_run_added', (req as any).actor ?? 'user',
    { art_test_id, outcome }, (req as any).sourceIp);
  res.status(201).json(await rawGet(db, 'SELECT * FROM exercise_test_runs WHERE id=?', [rid]));
});

router.put('/:id/tests/:run_id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercise_test_runs WHERE id=? AND exercise_id=?',
    [req.params.run_id, req.params.id]))
    return res.status(404).json({ error: 'Test run not found' });
  const { outcome, blocked, notes, ran_by } = req.body;
  const validOutcomes = ['pending', 'detected', 'not_detected', 'partial', 'n_a'];
  if (outcome && !validOutcomes.includes(outcome)) return res.status(400).json({ error: 'Invalid outcome' });

  await rawRun(db, `
    UPDATE exercise_test_runs SET
      outcome=COALESCE(?,outcome),
      blocked=CASE WHEN ? IS NOT NULL THEN ? ELSE blocked END,
      notes=COALESCE(?,notes), ran_by=COALESCE(?,ran_by),
      ran_at=CASE WHEN ? IS NOT NULL AND ? != 'pending' THEN CURRENT_TIMESTAMP ELSE ran_at END,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [outcome ?? null, blocked !== undefined ? 1 : null, blocked ? 1 : 0,
    notes ?? null, ran_by ?? null, outcome ?? null, outcome ?? 'pending', req.params.run_id]);

  res.json(await rawGet(db, 'SELECT * FROM exercise_test_runs WHERE id=?', [req.params.run_id]));
});

router.delete('/:id/tests/:run_id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercise_test_runs WHERE id=? AND exercise_id=?',
    [req.params.run_id, req.params.id]))
    return res.status(404).json({ error: 'Test run not found' });
  await rawRun(db, 'DELETE FROM exercise_test_runs WHERE id=?', [req.params.run_id]);
  res.status(204).end();
});

// ── Findings ────────────────────────────────────────────────────────────────
router.post('/:id/findings', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercises WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Exercise not found' });
  const { title, technique_id, finding_type = 'gap', severity = 'medium', description, recommendation } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const validTypes = ['gap', 'detection_validated', 'detection_failed', 'control_weakness', 'new_ttp'];
  const validSeverities = ['critical', 'high', 'medium', 'low', 'informational'];
  if (!validTypes.includes(finding_type)) return res.status(400).json({ error: 'Invalid finding_type' });
  if (!validSeverities.includes(severity)) return res.status(400).json({ error: 'Invalid severity' });

  const fid = await rawInsert(db, `
    INSERT INTO exercise_findings (exercise_id, technique_id, title, finding_type, severity, description, recommendation)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
  `, [req.params.id, technique_id ?? null, title.trim(), finding_type, severity,
    description ?? null, recommendation ?? null]);

  await logAudit(db, 'exercise', req.params.id, 'finding_added', (req as any).actor ?? 'user',
    { title: title.trim(), finding_type, severity }, (req as any).sourceIp);
  res.status(201).json(await rawGet(db, 'SELECT * FROM exercise_findings WHERE id=?', [fid]));
});

router.put('/:id/findings/:finding_id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercise_findings WHERE id=? AND exercise_id=?',
    [req.params.finding_id, req.params.id]))
    return res.status(404).json({ error: 'Finding not found' });
  const { title, technique_id, finding_type, severity, description, recommendation } = req.body;
  const validTypes = ['gap', 'detection_validated', 'detection_failed', 'control_weakness', 'new_ttp'];
  const validSeverities = ['critical', 'high', 'medium', 'low', 'informational'];
  if (finding_type && !validTypes.includes(finding_type)) return res.status(400).json({ error: 'Invalid finding_type' });
  if (severity && !validSeverities.includes(severity)) return res.status(400).json({ error: 'Invalid severity' });

  await rawRun(db, `
    UPDATE exercise_findings SET
      title=COALESCE(?,title), technique_id=COALESCE(?,technique_id),
      finding_type=COALESCE(?,finding_type), severity=COALESCE(?,severity),
      description=COALESCE(?,description), recommendation=COALESCE(?,recommendation),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [title?.trim() ?? null, technique_id ?? null, finding_type ?? null, severity ?? null,
    description ?? null, recommendation ?? null, req.params.finding_id]);

  res.json(await rawGet(db, 'SELECT * FROM exercise_findings WHERE id=?', [req.params.finding_id]));
});

router.delete('/:id/findings/:finding_id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM exercise_findings WHERE id=? AND exercise_id=?',
    [req.params.finding_id, req.params.id]))
    return res.status(404).json({ error: 'Finding not found' });
  await rawRun(db, 'DELETE FROM exercise_findings WHERE id=?', [req.params.finding_id]);
  res.status(204).end();
});

// ── Purple Team Report ──────────────────────────────────────────────────────
router.get('/:id/report', async (req, res) => {
  const db = getKnex();
  const exercise = await rawGet<any>(db, `
    SELECT e.*, tg.name as threat_group_name
    FROM exercises e
    LEFT JOIN threat_groups tg ON tg.id=e.threat_group_id
    WHERE e.id=?
  `, [req.params.id]);
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  const [techniques, testRuns, findings] = await Promise.all([
    rawAll<any>(db, `
      SELECT et.technique_id, t.name as technique_name, t.tactic_ids
      FROM exercise_techniques et
      JOIN attack_techniques t ON t.id=et.technique_id
      WHERE et.exercise_id=?
    `, [req.params.id]),
    rawAll<any>(db, `
      SELECT etr.*, at.technique_id, at.name as test_name
      FROM exercise_test_runs etr
      JOIN art_tests at ON at.id=etr.art_test_id
      WHERE etr.exercise_id=?
    `, [req.params.id]),
    rawAll<any>(db, `
      SELECT ef.*, t.name as technique_name
      FROM exercise_findings ef
      LEFT JOIN attack_techniques t ON t.id=ef.technique_id
      WHERE ef.exercise_id=?
      ORDER BY CASE ef.severity
        WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3
        WHEN 'low' THEN 4 ELSE 5 END
    `, [req.params.id]),
  ]);

  const totalRuns = testRuns.length;
  const byOutcome = testRuns.reduce<Record<string, number>>((acc, r: any) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});

  const detectedCount = byOutcome['detected'] ?? 0;
  const notDetectedCount = byOutcome['not_detected'] ?? 0;
  const partialCount = byOutcome['partial'] ?? 0;
  const detectionRate = totalRuns > 0
    ? Math.round(((detectedCount + partialCount * 0.5) / totalRuns) * 100) : 0;

  // Techniques with no detected tests
  const detectedTechIds = new Set(
    testRuns.filter((r: any) => r.outcome === 'detected').map((r: any) => r.technique_id.split('.')[0])
  );
  const gaps = techniques
    .map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids ?? '[]') }))
    .filter((t: any) => !detectedTechIds.has(t.technique_id.split('.')[0]));

  const findingsBySeverity = ['critical', 'high', 'medium', 'low', 'informational'].map(sev => ({
    severity: sev,
    count: findings.filter((f: any) => f.severity === sev).length,
  }));

  const techniqueBreakdown = techniques.map((t: any) => {
    const techRuns = testRuns.filter((r: any) => r.technique_id.split('.')[0] === t.technique_id.split('.')[0]);
    const detected = techRuns.filter((r: any) => r.outcome === 'detected').length;
    const notDetected = techRuns.filter((r: any) => r.outcome === 'not_detected').length;
    const partial = techRuns.filter((r: any) => r.outcome === 'partial').length;
    return {
      technique_id: t.technique_id, technique_name: t.technique_name,
      tactic_ids: JSON.parse(t.tactic_ids ?? '[]'),
      total_runs: techRuns.length, detected, not_detected: notDetected, partial,
      status: techRuns.length === 0 ? 'untested'
        : detected > 0 ? 'detected'
        : partial > 0 ? 'partial'
        : 'not_detected',
    };
  });

  res.json({
    generated_at: new Date().toISOString(),
    exercise: {
      id: exercise.id, name: exercise.name, type: exercise.type, status: exercise.status,
      threat_group_name: exercise.threat_group_name, start_date: exercise.start_date,
      end_date: exercise.end_date, lead: exercise.lead, scope_notes: exercise.scope_notes,
    },
    summary: {
      total_techniques: techniques.length, total_runs: totalRuns,
      detected: detectedCount, not_detected: notDetectedCount,
      partial: partialCount, blocked: testRuns.filter((r: any) => r.blocked).length,
      detection_rate: detectionRate, total_findings: findings.length,
      critical_findings: findings.filter((f: any) => f.severity === 'critical').length,
    },
    technique_breakdown: techniqueBreakdown,
    gaps,
    findings,
    findings_by_severity: findingsBySeverity,
  });
});

// ── Executive Summary ───────────────────────────────────────────────────────
router.get('/:id/executive-summary', async (req, res) => {
  try {
    const db = getKnex();
    const exercise = await rawGet<any>(db, 'SELECT * FROM exercises WHERE id = ?', [req.params.id]);
    if (!exercise) return res.status(404).json({ error: 'Not found' });
    const techniques = await rawAll<any>(db, 'SELECT * FROM exercise_techniques WHERE exercise_id = ?', [exercise.id]);
    const testRuns = await rawAll<any>(db, 'SELECT * FROM exercise_test_runs WHERE exercise_id = ?', [exercise.id]);
    const findings = await rawAll<any>(db, 'SELECT * FROM exercise_findings WHERE exercise_id = ?', [exercise.id]);
    const detectedCount = testRuns.filter((r: any) => r.outcome === 'detected').length;
    const partialCount = testRuns.filter((r: any) => r.outcome === 'partial').length;
    const notDetectedCount = testRuns.filter((r: any) => r.outcome === 'not_detected').length;
    const detectionRate = testRuns.length === 0 ? 0 : Math.round(((detectedCount + partialCount * 0.5) / testRuns.length) * 100);
    const findingsBySeverity = {
      critical: findings.filter((f: any) => f.severity === 'critical').length,
      high: findings.filter((f: any) => f.severity === 'high').length,
      medium: findings.filter((f: any) => f.severity === 'medium').length,
      low: findings.filter((f: any) => f.severity === 'low').length,
    };
    const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
    const topFindings = [...findings]
      .sort((a: any, b: any) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
      .slice(0, 5)
      .map((f: any) => ({ title: f.title, severity: f.severity, finding_type: f.finding_type, recommendation: f.recommendation }));
    const detectionGaps = testRuns
      .filter((r: any) => r.outcome === 'not_detected')
      .map((r: any) => ({ technique_id: r.technique_id ?? null, notes: r.notes }))
      .slice(0, 10);
    res.json({
      exercise: { id: exercise.id, name: exercise.name, type: exercise.type, status: exercise.status, lead: exercise.lead, start_date: exercise.start_date, end_date: exercise.end_date },
      kpis: { detection_rate: detectionRate, techniques_scoped: techniques.length, tests_executed: testRuns.length, findings_total: findings.length, detected: detectedCount, partial: partialCount, not_detected: notDetectedCount },
      findings_by_severity: findingsBySeverity,
      top_findings: topFindings,
      detection_gaps: detectionGaps,
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
