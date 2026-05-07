import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM countries ORDER BY name').all());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, color, flag } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const result = db.prepare(
      'INSERT INTO countries (name, color, flag) VALUES (?, ?, ?)'
    ).run(name.trim(), color?.trim() ?? '#6366f1', flag?.trim() ?? null);
    res.status(201).json(db.prepare('SELECT * FROM countries WHERE id = ?').get(result.lastInsertRowid));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Country already exists' });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM countries WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { name, color, flag } = req.body;
  try {
    db.prepare(`
      UPDATE countries SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        flag = ?
      WHERE id = ?
    `).run(name?.trim() ?? null, color?.trim() ?? null, flag?.trim() ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM countries WHERE id = ?').get(req.params.id));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Country already exists' });
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const result = getDb().prepare('DELETE FROM countries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
