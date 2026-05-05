import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM threat_groups ORDER BY name').all() as any[];
  res.json(groups.map(g => ({ ...g, aliases: JSON.parse(g.aliases) })));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT * FROM threat_groups WHERE id = ?').get(req.params.id) as any;
  if (!group) return res.status(404).json({ error: 'Not found' });

  const techniques = db.prepare(`
    SELECT t.* FROM attack_techniques t
    JOIN group_techniques gt ON t.id = gt.technique_id
    WHERE gt.group_id = ?
    ORDER BY t.id
  `).all(req.params.id) as any[];

  const detectionCoverage = techniques.map(t => {
    const detected = (db.prepare(
      "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?"
    ).get(`%"${t.id}"%`) as any).c > 0;
    return { technique_id: t.id, technique_name: t.name, detected };
  });

  const coveredCount = detectionCoverage.filter(t => t.detected).length;

  res.json({
    ...group,
    aliases: JSON.parse(group.aliases),
    techniques: techniques.map(t => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    coverage: {
      total: techniques.length,
      covered: coveredCount,
      pct: techniques.length ? Math.round((coveredCount / techniques.length) * 100) : 0,
      details: detectionCoverage,
    },
  });
});

router.get('/:id/exposure', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const techniques = db.prepare(`
    SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t
    JOIN group_techniques gt ON t.id = gt.technique_id
    WHERE gt.group_id = ?
  `).all(req.params.id) as any[];

  const result = techniques.map(t => {
    const detected = (db.prepare(
      "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?"
    ).get(`%"${t.id}"%`) as any).c > 0;
    const mitigated = (db.prepare(`
      SELECT COUNT(*) as c FROM technique_mitigations tm
      JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
      JOIN tools tl ON tlm.tool_id = tl.id
      WHERE tm.technique_id = ? AND tl.status = 'active'
    `).get(t.id) as any).c > 0;
    return { ...t, tactic_ids: JSON.parse(t.tactic_ids), detected, mitigated, exposed: !detected && !mitigated };
  });

  const exposed = result.filter(t => t.exposed).length;
  res.json({ group_id: req.params.id, techniques: result, exposed_count: exposed, total: result.length });
});

export default router;
