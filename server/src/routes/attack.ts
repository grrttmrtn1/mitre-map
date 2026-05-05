import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/tactics', (_req, res) => {
  const db = getDb();
  const tactics = db.prepare('SELECT * FROM attack_tactics ORDER BY id').all();
  res.json(tactics);
});

router.get('/techniques', (req, res) => {
  const db = getDb();
  const { tactic } = req.query;
  let techniques;
  if (tactic) {
    techniques = db.prepare(
      "SELECT * FROM attack_techniques WHERE tactic_ids LIKE ? ORDER BY id"
    ).all(`%"${tactic}"%`);
  } else {
    techniques = db.prepare('SELECT * FROM attack_techniques WHERE is_subtechnique = 0 ORDER BY id').all();
  }
  res.json(techniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })));
});

router.get('/techniques/:id', (req, res) => {
  const db = getDb();
  const technique = db.prepare('SELECT * FROM attack_techniques WHERE id = ?').get(req.params.id) as any;
  if (!technique) return res.status(404).json({ error: 'Not found' });

  const mitigations = db.prepare(`
    SELECT m.* FROM attack_mitigations m
    JOIN technique_mitigations tm ON m.id = tm.mitigation_id
    WHERE tm.technique_id = ?
  `).all(req.params.id);

  const d3fend = db.prepare(`
    SELECT d.* FROM d3fend_techniques d
    JOIN attack_d3fend ad ON d.id = ad.d3fend_id
    WHERE ad.attack_id = ?
  `).all(req.params.id);

  const detections = db.prepare(
    "SELECT * FROM detections WHERE technique_ids LIKE ? AND status != 'deleted'"
  ).all(`%"${req.params.id}"%`);

  res.json({
    ...technique,
    tactic_ids: JSON.parse(technique.tactic_ids),
    mitigations,
    d3fend_countermeasures: d3fend,
    detections: detections.map((d: any) => ({ ...d, technique_ids: JSON.parse(d.technique_ids) })),
  });
});

router.get('/mitigations', (_req, res) => {
  const db = getDb();
  const mitigations = db.prepare('SELECT * FROM attack_mitigations ORDER BY id').all();
  res.json(mitigations);
});

router.get('/mitigations/:id', (req, res) => {
  const db = getDb();
  const mitigation = db.prepare('SELECT * FROM attack_mitigations WHERE id = ?').get(req.params.id);
  if (!mitigation) return res.status(404).json({ error: 'Not found' });

  const techniques = db.prepare(`
    SELECT t.* FROM attack_techniques t
    JOIN technique_mitigations tm ON t.id = tm.technique_id
    WHERE tm.mitigation_id = ?
  `).all(req.params.id);

  const tools = db.prepare(`
    SELECT t.* FROM tools t
    JOIN tool_mitigations tm ON t.id = tm.tool_id
    WHERE tm.mitigation_id = ?
  `).all(req.params.id);

  res.json({
    ...mitigation,
    techniques: techniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    covered_by_tools: tools,
  });
});

export default router;
