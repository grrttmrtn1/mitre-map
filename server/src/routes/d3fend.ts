import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/techniques', (_req, res) => {
  const db = getDb();
  const techniques = db.prepare('SELECT * FROM d3fend_techniques ORDER BY category, subcategory, name').all();
  res.json(techniques);
});

router.get('/techniques/:id', (req, res) => {
  const db = getDb();
  const technique = db.prepare('SELECT * FROM d3fend_techniques WHERE id = ?').get(req.params.id);
  if (!technique) return res.status(404).json({ error: 'Not found' });

  const attackTechniques = db.prepare(`
    SELECT t.* FROM attack_techniques t
    JOIN attack_d3fend ad ON t.id = ad.attack_id
    WHERE ad.d3fend_id = ?
  `).all(req.params.id);

  const tools = db.prepare(`
    SELECT t.* FROM tools t
    JOIN tool_d3fend td ON t.id = td.tool_id
    WHERE td.d3fend_id = ?
  `).all(req.params.id);

  res.json({
    ...technique,
    counters_attack: attackTechniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    implemented_by: tools,
  });
});

router.get('/mappings/:attackId', (req, res) => {
  const db = getDb();
  const d3fend = db.prepare(`
    SELECT d.* FROM d3fend_techniques d
    JOIN attack_d3fend ad ON d.id = ad.d3fend_id
    WHERE ad.attack_id = ?
    ORDER BY d.category, d.name
  `).all(req.params.attackId);

  res.json(d3fend);
});

export default router;
