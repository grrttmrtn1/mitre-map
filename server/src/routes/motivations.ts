import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await rawAll(getKnex(), 'SELECT * FROM motivations ORDER BY name'));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, color, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const id = await rawInsert(db, 'INSERT INTO motivations (name, color, description) VALUES (?, ?, ?) RETURNING id',
      [name.trim(), color?.trim() ?? '#6366f1', description?.trim() ?? null]);
    res.status(201).json(await rawGet(db, 'SELECT * FROM motivations WHERE id=?', [id]));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === '23505') return res.status(409).json({ error: 'Motivation already exists' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM motivations WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { name, color, description } = req.body;
  try {
    await rawRun(db, `UPDATE motivations SET name=COALESCE(?,name), color=COALESCE(?,color), description=? WHERE id=?`,
      [name?.trim() ?? null, color?.trim() ?? null, description?.trim() ?? null, req.params.id]);
    res.json(await rawGet(db, 'SELECT * FROM motivations WHERE id=?', [req.params.id]));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === '23505') return res.status(409).json({ error: 'Motivation already exists' });
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM motivations WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM motivations WHERE id=?', [req.params.id]);
  res.status(204).end();
});

export default router;
