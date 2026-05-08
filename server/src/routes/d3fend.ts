import { Router } from 'express';
import { getKnex, rawAll, rawGet } from '../db/database';

const router = Router();

router.get('/techniques', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM d3fend_techniques ORDER BY category, subcategory, name'));
});

router.get('/techniques/:id', async (req, res) => {
  const db = getKnex();
  const technique = await rawGet(db, 'SELECT * FROM d3fend_techniques WHERE id = ?', [req.params.id]);
  if (!technique) return res.status(404).json({ error: 'Not found' });

  const [attackTechniques, tools] = await Promise.all([
    rawAll(db, `SELECT t.* FROM attack_techniques t JOIN attack_d3fend ad ON t.id = ad.attack_id WHERE ad.d3fend_id = ?`, [req.params.id]),
    rawAll(db, `SELECT t.* FROM tools t JOIN tool_d3fend td ON t.id = td.tool_id WHERE td.d3fend_id = ?`, [req.params.id]),
  ]);

  res.json({
    ...technique,
    counters_attack: attackTechniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    implemented_by: tools,
  });
});

router.get('/mappings/:attackId', async (req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, `
    SELECT d.* FROM d3fend_techniques d
    JOIN attack_d3fend ad ON d.id = ad.d3fend_id
    WHERE ad.attack_id = ?
    ORDER BY d.category, d.name
  `, [req.params.attackId]));
});

export default router;
