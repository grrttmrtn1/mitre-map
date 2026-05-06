import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Health check is always public
  if (req.path === '/health' && req.method === 'GET') return next();

  const db = getDb();
  const { n } = db.prepare('SELECT COUNT(*) as n FROM api_keys').get() as { n: number };
  // Bootstrap: if no keys have been created yet, allow all traffic through
  if (n === 0) return next();

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key required', hint: 'Authorization: Bearer <key>' });
  }

  const rawKey = auth.slice(7).trim();
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const key = db.prepare(
    'SELECT id, expires_at FROM api_keys WHERE key_hash = ?'
  ).get(hash) as { id: number; expires_at: string | null } | undefined;

  if (!key) return res.status(401).json({ error: 'Invalid API key' });

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }

  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(key.id);
  next();
}
