import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';
import { invalidateAuthCache } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT id, email, name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC', []));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { email, name, password, role = 'analyst' } = req.body;
  if (!email?.trim() || !password) return res.status(400).json({ error: 'email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!['admin', 'analyst', 'readonly'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const id = await rawInsert(db, 'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id',
      [email.toLowerCase().trim(), name?.trim() ?? null, hash, role]);
    await logAudit(db, 'user', String(id), 'create', (req as any).actor ?? 'system', { email, role }, (req as any).sourceIp);
    invalidateAuthCache();
    res.status(201).json(await rawGet(db, 'SELECT id, email, name, role, is_active, created_at FROM users WHERE id=?', [id]));
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM users WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { name, role, is_active } = req.body;
  if (role && !['admin', 'analyst', 'readonly'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  await rawRun(db, 'UPDATE users SET name=COALESCE(?,name), role=COALESCE(?,role), is_active=COALESCE(?,is_active) WHERE id=?',
    [name?.trim() ?? null, role ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id]);
  await logAudit(db, 'user', req.params.id, 'update', (req as any).actor ?? 'system', req.body, (req as any).sourceIp);
  res.json(await rawGet(db, 'SELECT id, email, name, role, is_active, created_at, last_login FROM users WHERE id=?', [req.params.id]));
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const user = await rawGet<any>(db, 'SELECT id, email FROM users WHERE id=?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM refresh_tokens WHERE user_id=?', [req.params.id]);
  await rawRun(db, 'DELETE FROM users WHERE id=?', [req.params.id]);
  await logAudit(db, 'user', req.params.id, 'delete', (req as any).actor ?? 'system', { email: user.email }, (req as any).sourceIp);
  res.status(204).end();
});

router.post('/:id/reset-password', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM users WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const hash = await bcrypt.hash(password, 12);
  await rawRun(db, 'UPDATE users SET password_hash=? WHERE id=?', [hash, req.params.id]);
  await rawRun(db, 'DELETE FROM refresh_tokens WHERE user_id=?', [req.params.id]);
  await logAudit(db, 'user', req.params.id, 'reset_password', (req as any).actor ?? 'system', undefined, (req as any).sourceIp);
  res.json({ message: 'Password reset. All active sessions invalidated.' });
});

export default router;
