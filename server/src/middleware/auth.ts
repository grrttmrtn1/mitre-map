import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getKnex, rawGet } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET ?? 'mitremap-dev-secret-change-in-production';

export function requiredScope(method: string, path: string): 'read' | 'write' | 'admin' {
  const m = method.toUpperCase();
  if (m !== 'GET' && (path.startsWith('/api-keys') || path.startsWith('/admin'))) return 'admin';
  if (m !== 'GET' && path.startsWith('/users')) return 'admin';
  if (m !== 'GET') return 'write';
  return 'read';
}

export function scopeGranted(scopes: string[], needed: 'read' | 'write' | 'admin'): boolean {
  if (scopes.includes('admin')) return true;
  if (needed === 'write') return scopes.includes('write');
  if (needed === 'read') return scopes.includes('read') || scopes.includes('write');
  return false;
}

const PUBLIC_PATHS = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/refresh' },
  { method: 'GET', path: '/auth/oidc/providers' },
];

// Cache auth entity count to avoid hitting DB on every request
let _authCache: { total: number; ts: number } | null = null;
const AUTH_CACHE_TTL = 15_000; // 15 seconds

export function invalidateAuthCache() {
  _authCache = null;
}

async function getAuthEntityTotal(): Promise<number> {
  const now = Date.now();
  if (_authCache && now - _authCache.ts < AUTH_CACHE_TTL) return _authCache.total;
  const db = getKnex();
  const [keyCount, userCount] = await Promise.all([
    rawGet<{ n: number }>(db, 'SELECT COUNT(*) as n FROM api_keys', []),
    rawGet<{ n: number }>(db, 'SELECT COUNT(*) as n FROM users', []),
  ]);
  const total = ((keyCount as any)?.n ?? 0) + ((userCount as any)?.n ?? 0);
  _authCache = { total, ts: now };
  return total;
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const reqPath = req.path;
  const method = req.method.toUpperCase();

  for (const p of PUBLIC_PATHS) {
    if (method === p.method && reqPath === p.path) return next();
  }
  if (reqPath.startsWith('/auth/oidc/') && method === 'GET') return next();

  try {
    const totalAuthEntities = await getAuthEntityTotal();
    if (totalAuthEntities === 0) return next();

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required', hint: 'Authorization: Bearer <token>' });
    }

    const token = auth.slice(7).trim();
    const db = getKnex();

    // Try JWT first
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      const user = await rawGet<any>(db, 'SELECT id, email, name, role, is_active FROM users WHERE id=?', [payload.sub]);
      if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid or inactive user' });

      const roleToScopes: Record<string, string[]> = {
        admin: ['admin', 'write', 'read'],
        analyst: ['write', 'read'],
        readonly: ['read'],
      };
      const scopes = roleToScopes[user.role] ?? ['read'];
      const needed = requiredScope(method, reqPath);
      if (!scopeGranted(scopes, needed)) return res.status(403).json({ error: 'Insufficient permissions', required: needed, role: user.role });

      (req as any).actor = user.email;
      (req as any).user = user;
      (req as any).sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
      return next();
    } catch {
      // Not a valid JWT — fall through to API key check
    }

    // Try API key
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = await rawGet<any>(db, 'SELECT id, name, scopes, expires_at FROM api_keys WHERE key_hash=?', [hash]);
    if (!key) return res.status(401).json({ error: 'Invalid credential' });
    if (key.expires_at && new Date(key.expires_at) < new Date()) return res.status(401).json({ error: 'API key expired' });

    const scopes: string[] = (() => { try { return JSON.parse(key.scopes); } catch { return []; } })();
    const needed = requiredScope(method, reqPath);
    if (!scopeGranted(scopes, needed)) return res.status(403).json({ error: 'Insufficient scope', required: needed, granted: scopes });

    await db.raw('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [key.id]);

    (req as any).actor = `key:${key.name}`;
    (req as any).sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
