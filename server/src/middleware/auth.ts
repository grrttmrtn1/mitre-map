import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database';

// Determine the minimum scope required for a given request.
// admin  → key management and destructive admin operations
// write  → any mutation on data resources (POST/PUT/PATCH/DELETE)
// read   → GET requests on data resources
function requiredScope(method: string, path: string): 'read' | 'write' | 'admin' {
  const m = method.toUpperCase();
  // Mutations to API keys and admin purge ops require admin; GETs only need read
  if (m !== 'GET' && (path.startsWith('/api-keys') || path.startsWith('/admin'))) return 'admin';
  // All other mutations require write
  if (m !== 'GET') return 'write';
  return 'read';
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // Health check is always public
  if (req.path === '/health' && req.method === 'GET') return next();
  // Key creation is public so the first key can always be bootstrapped
  if (req.path === '/api-keys' && req.method === 'POST') return next();

  const db = getDb();
  const { n } = db.prepare('SELECT COUNT(*) as n FROM api_keys').get() as { n: number };
  // Bootstrap mode: no keys exist yet — allow all traffic
  if (n === 0) return next();

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key required', hint: 'Authorization: Bearer <key>' });
  }

  const rawKey = auth.slice(7).trim();
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const key = db.prepare(
    'SELECT id, name, scopes, expires_at FROM api_keys WHERE key_hash = ?'
  ).get(hash) as { id: number; name: string; scopes: string; expires_at: string | null } | undefined;

  if (!key) return res.status(401).json({ error: 'Invalid API key' });

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }

  // Enforce scopes
  const scopes: string[] = (() => {
    try { return JSON.parse(key.scopes); } catch { return []; }
  })();

  const needed = requiredScope(req.method, req.path);
  // admin scope implies write and read; write implies read
  const granted =
    scopes.includes('admin') ||
    (needed === 'write' && scopes.includes('write')) ||
    (needed === 'read'  && (scopes.includes('read') || scopes.includes('write')));

  if (!granted) {
    return res.status(403).json({
      error: 'Insufficient scope',
      required: needed,
      granted: scopes,
    });
  }

  db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(key.id);

  // Attach audit context for use in route handlers
  (req as any).actor = `key:${key.name}`;
  (req as any).sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;

  next();
}
