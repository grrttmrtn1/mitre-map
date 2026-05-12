import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await rawAll(getKnex(), 'SELECT * FROM countries ORDER BY name'));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { name, color, flag } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const id = await rawInsert(db, 'INSERT INTO countries (name, color, flag) VALUES (?, ?, ?) RETURNING id',
      [name.trim(), color?.trim() ?? '#6366f1', flag?.trim() ?? null]);
    await logAudit(db, 'country', String(id), 'created', (req as any).actor ?? 'user', { name: name.trim() }, (req as any).sourceIp);
    res.status(201).json(await rawGet(db, 'SELECT * FROM countries WHERE id=?', [id]));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === '23505') return res.status(409).json({ error: 'Country already exists' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM countries WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { name, color, flag } = req.body;
  try {
    await rawRun(db, 'UPDATE countries SET name=COALESCE(?,name), color=COALESCE(?,color), flag=? WHERE id=?',
      [name?.trim() ?? null, color?.trim() ?? null, flag?.trim() ?? null, req.params.id]);
    await logAudit(db, 'country', req.params.id, 'updated', (req as any).actor ?? 'user', { name, color }, (req as any).sourceIp);
    res.json(await rawGet(db, 'SELECT * FROM countries WHERE id=?', [req.params.id]));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === '23505') return res.status(409).json({ error: 'Country already exists' });
    throw e;
  }
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const country = await rawGet<any>(db, 'SELECT id, name FROM countries WHERE id=?', [req.params.id]);
  if (!country) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM countries WHERE id=?', [req.params.id]);
  await logAudit(db, 'country', req.params.id, 'deleted', (req as any).actor ?? 'user', { name: country.name }, (req as any).sourceIp);
  res.status(204).end();
});

export default router;
