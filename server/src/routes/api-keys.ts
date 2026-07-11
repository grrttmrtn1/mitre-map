import { Router } from 'express';
import crypto from 'crypto';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';
import { invalidateAuthCache } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();

function maskKey(key: string): string {
  return key.slice(0, 8) + '••••••••••••••••••••••••' + key.slice(-4);
}

router.get('/', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT id, name, masked_key, created_at, last_used_at, expires_at, scopes FROM api_keys ORDER BY created_at DESC'));
});

router.post('/', validateBody({
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  scopes: { type: 'array', itemType: 'string' },
  expires_at: { type: 'string', maxLength: 100 },
}, { rejectUnknown: true }), async (req, res) => {
  const db = getKnex();
  const { name, expires_at } = req.body;
  const scopes = (req as any).bootstrap ? ['admin', 'write', 'read'] : (req.body.scopes ?? ['read']);
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!scopes.every((scope: string) => ['read', 'write', 'admin'].includes(scope))) return res.status(400).json({ error: 'Invalid API key scope' });
  const rawKey = 'mm_' + crypto.randomBytes(32).toString('hex');
  const masked = maskKey(rawKey);
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const id = await rawInsert(db, `
    INSERT INTO api_keys (name, key_hash, masked_key, scopes, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING id
  `, [name.trim(), hash, masked, JSON.stringify(scopes), expires_at ?? null]);
  await logAudit(db, 'api_key', String(id), 'create', (req as any).actor ?? 'user', { name, scopes }, (req as any).sourceIp);
  invalidateAuthCache();
  res.status(201).json({
    id, name: name.trim(), key: rawKey, masked_key: masked, scopes,
    created_at: new Date().toISOString(),
    message: 'Store this key securely — it will not be shown again.',
  });
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  const key = await rawGet<{ id: number; name: string }>(db, 'SELECT id, name FROM api_keys WHERE id=?', [req.params.id]);
  if (!key) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM api_keys WHERE id=?', [req.params.id]);
  await logAudit(db, 'api_key', req.params.id, 'delete', (req as any).actor ?? 'user', { name: key.name }, (req as any).sourceIp);
  res.status(204).end();
});

router.patch('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM api_keys WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { name, scopes, expires_at } = req.body;
  await rawRun(db, `
    UPDATE api_keys SET name=COALESCE(?,name), scopes=COALESCE(?,scopes), expires_at=COALESCE(?,expires_at) WHERE id=?
  `, [name ?? null, scopes ? JSON.stringify(scopes) : null, expires_at ?? null, req.params.id]);
  await logAudit(db, 'api_key', req.params.id, 'update', (req as any).actor ?? 'user', req.body, (req as any).sourceIp);
  res.json(await rawGet(db, 'SELECT id, name, masked_key, created_at, last_used_at, expires_at, scopes FROM api_keys WHERE id=?', [req.params.id]));
});

export default router;
