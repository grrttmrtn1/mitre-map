import { Router } from 'express';
import { getKnex, rawAll, rawGet } from '../db/database';

const router = Router();

router.get('/tactics', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM attack_tactics ORDER BY id'));
});

router.get('/techniques', async (req, res) => {
  const db = getKnex();
  const { tactic } = req.query;
  const rows = tactic
    ? await rawAll(db, 'SELECT * FROM attack_techniques WHERE tactic_ids LIKE ? ORDER BY id', [`%"${tactic}"%`])
    : await rawAll(db, 'SELECT * FROM attack_techniques WHERE is_subtechnique = 0 ORDER BY id');
  res.json(rows.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })));
});

router.get('/techniques/:id', async (req, res) => {
  const db = getKnex();
  const technique = await rawGet<any>(db, 'SELECT * FROM attack_techniques WHERE id = ?', [req.params.id]);
  if (!technique) return res.status(404).json({ error: 'Not found' });

  const [mitigations, d3fend, detections] = await Promise.all([
    rawAll(db, `SELECT m.* FROM attack_mitigations m JOIN technique_mitigations tm ON m.id = tm.mitigation_id WHERE tm.technique_id = ?`, [req.params.id]),
    rawAll(db, `SELECT d.* FROM d3fend_techniques d JOIN attack_d3fend ad ON d.id = ad.d3fend_id WHERE ad.attack_id = ?`, [req.params.id]),
    rawAll(db, `SELECT * FROM detections WHERE technique_ids LIKE ? AND status != 'deleted'`, [`%"${req.params.id}"%`]),
  ]);

  res.json({
    ...technique,
    tactic_ids: JSON.parse(technique.tactic_ids),
    mitigations,
    d3fend_countermeasures: d3fend,
    detections: detections.map((d: any) => ({ ...d, technique_ids: JSON.parse(d.technique_ids) })),
  });
});

router.get('/mitigations', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM attack_mitigations ORDER BY id'));
});

router.get('/mitigations/:id', async (req, res) => {
  const db = getKnex();
  const mitigation = await rawGet(db, 'SELECT * FROM attack_mitigations WHERE id = ?', [req.params.id]);
  if (!mitigation) return res.status(404).json({ error: 'Not found' });

  const [techniques, tools] = await Promise.all([
    rawAll(db, `SELECT t.* FROM attack_techniques t JOIN technique_mitigations tm ON t.id = tm.technique_id WHERE tm.mitigation_id = ?`, [req.params.id]),
    rawAll(db, `SELECT t.* FROM tools t JOIN tool_mitigations tm ON t.id = tm.tool_id WHERE tm.mitigation_id = ?`, [req.params.id]),
  ]);

  res.json({
    ...mitigation,
    techniques: techniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    covered_by_tools: tools,
  });
});

// ATT&CK version management endpoints
router.get('/version', async (_req, res) => {
  const db = getKnex();
  const version = await rawGet(db, 'SELECT * FROM attack_version_info WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  res.json(version ?? { version: '14.1', name: 'ATT&CK v14.1' });
});

router.get('/deprecated', async (_req, res) => {
  const db = getKnex();
  const deprecated = await rawAll(db, `
    SELECT dt.*, t.name as technique_name, s.name as superseded_by_name
    FROM deprecated_techniques dt
    JOIN attack_techniques t ON dt.technique_id = t.id
    LEFT JOIN attack_techniques s ON dt.superseded_by = s.id
    ORDER BY dt.deprecated_in_version, dt.technique_id
  `);
  res.json(deprecated);
});

router.get('/migration-scan', async (_req, res) => {
  const db = getKnex();
  const deprecated = await rawAll<{ technique_id: string; superseded_by: string | null; reason: string }>(
    db, 'SELECT technique_id, superseded_by, reason FROM deprecated_techniques'
  );
  if (deprecated.length === 0) { return res.json({ detections_affected: [], total: 0 }); }

  const deprecatedIds = new Set(deprecated.map(d => d.technique_id));
  const deprecatedMap = Object.fromEntries(deprecated.map(d => [d.technique_id, d]));

  const allDetections = await rawAll<{ id: number; name: string; technique_ids: string }>(
    db, 'SELECT id, name, technique_ids FROM detections'
  );

  const affected = allDetections.flatMap(det => {
    const ids: string[] = JSON.parse(det.technique_ids);
    const hits = ids.filter(id => deprecatedIds.has(id));
    if (hits.length === 0) return [];
    return hits.map(id => ({
      detection_id: det.id,
      detection_name: det.name,
      deprecated_technique_id: id,
      superseded_by: deprecatedMap[id]?.superseded_by ?? null,
      reason: deprecatedMap[id]?.reason ?? null,
    }));
  });

  res.json({ detections_affected: affected, total: affected.length });
});

export default router;
