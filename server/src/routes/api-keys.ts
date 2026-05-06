import { Router } from 'express';
import crypto from 'crypto';
import { getDb, logAudit } from '../db/database';

const router = Router();

function maskKey(key: string): string {
  return key.slice(0, 8) + '••••••••••••••••••••••••' + key.slice(-4);
}

router.get('/', (_req, res) => {
  const db = getDb();
  const keys = db.prepare('SELECT id, name, masked_key, created_at, last_used_at, expires_at, scopes FROM api_keys ORDER BY created_at DESC').all();
  res.json(keys);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, scopes = ['read'], expires_at } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const rawKey = 'mm_' + crypto.randomBytes(32).toString('hex');
  const masked = maskKey(rawKey);
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const result = db.prepare(`
    INSERT INTO api_keys (name, key_hash, masked_key, scopes, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), hash, masked, JSON.stringify(scopes), expires_at ?? null) as any;

  logAudit(db, 'api_key', String(result.lastInsertRowid), 'create', 'user', { name, scopes });
  res.status(201).json({
    id: result.lastInsertRowid,
    name: name.trim(),
    key: rawKey,
    masked_key: masked,
    scopes,
    created_at: new Date().toISOString(),
    message: 'Store this key securely — it will not be shown again.',
  });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const key = db.prepare('SELECT id, name FROM api_keys WHERE id = ?').get(req.params.id) as any;
  if (!key) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(req.params.id);
  logAudit(db, 'api_key', req.params.id, 'delete', 'user', { name: key.name });
  res.status(204).end();
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const key = db.prepare('SELECT id FROM api_keys WHERE id = ?').get(req.params.id) as any;
  if (!key) return res.status(404).json({ error: 'Not found' });
  const { name, scopes, expires_at } = req.body;
  db.prepare(`
    UPDATE api_keys SET
      name = COALESCE(?, name),
      scopes = COALESCE(?, scopes),
      expires_at = COALESCE(?, expires_at)
    WHERE id = ?
  `).run(name ?? null, scopes ? JSON.stringify(scopes) : null, expires_at ?? null, req.params.id);
  logAudit(db, 'api_key', req.params.id, 'update', 'user', req.body);
  const updated = db.prepare('SELECT id, name, masked_key, created_at, last_used_at, expires_at, scopes FROM api_keys WHERE id = ?').get(req.params.id);
  res.json(updated);
});

export default router;
