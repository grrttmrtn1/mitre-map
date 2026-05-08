import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getKnex, rawGet, rawAll, rawInsert, rawRun } from '../db/database';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'mitremap-dev-secret-change-in-production';
const JWT_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 30;

function signToken(userId: number, email: string, role: string) {
  return jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const db = getKnex();
  const user = await rawGet<any>(db, 'SELECT * FROM users WHERE email=? AND is_active=1', [email.toLowerCase()]);
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user.id, user.email, user.role);
  const refreshRaw = crypto.randomBytes(48).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400000).toISOString();
  await rawRun(db, 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, refreshHash, expiresAt]);
  await rawRun(db, 'UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);

  res.cookie('refresh_token', refreshRaw, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: REFRESH_EXPIRY_DAYS * 86400000 });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.refresh_token;
  if (!rawToken) return res.status(401).json({ error: 'No refresh token' });
  const db = getKnex();
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await rawGet<any>(db, 'SELECT rt.*, u.email, u.role, u.is_active FROM refresh_tokens rt JOIN users u ON rt.user_id=u.id WHERE rt.token_hash=?', [hash]);
  if (!record || !record.is_active) return res.status(401).json({ error: 'Invalid refresh token' });
  if (new Date(record.expires_at) < new Date()) return res.status(401).json({ error: 'Refresh token expired' });
  const token = signToken(record.user_id, record.email, record.role);
  res.json({ token });
});

router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.refresh_token;
  if (rawToken) {
    const db = getKnex();
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await rawRun(db, 'DELETE FROM refresh_tokens WHERE token_hash=?', [hash]);
  }
  res.clearCookie('refresh_token');
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.get('/oidc/providers', async (_req, res) => {
  const db = getKnex();
  const providers = await rawAll<any>(db, 'SELECT id, name, slug, issuer_url, client_id, enabled FROM oidc_providers ORDER BY name', []);
  res.json(providers);
});

router.post('/oidc/providers', async (req, res) => {
  const { name, slug, issuer_url, client_id, client_secret, enabled } = req.body;
  if (!name || !slug || !issuer_url || !client_id || !client_secret) {
    return res.status(400).json({ error: 'name, slug, issuer_url, client_id, client_secret are required' });
  }
  const db = getKnex();
  try {
    const id = await rawInsert(db,
      'INSERT INTO oidc_providers (name, slug, issuer_url, client_id, client_secret, enabled) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [name.trim(), slug.trim(), issuer_url.trim(), client_id.trim(), client_secret, enabled !== false ? 1 : 0]);
    const provider = await rawGet<any>(db, 'SELECT id, name, slug, issuer_url, client_id, enabled FROM oidc_providers WHERE id=?', [id]);
    res.status(201).json(provider);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'A provider with this name or slug already exists' });
    throw e;
  }
});

router.put('/oidc/providers/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT id FROM oidc_providers WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, slug, issuer_url, client_id, client_secret, enabled } = req.body;
  await rawRun(db, `UPDATE oidc_providers SET
    name=COALESCE(?,name), slug=COALESCE(?,slug), issuer_url=COALESCE(?,issuer_url),
    client_id=COALESCE(?,client_id),
    client_secret=CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE client_secret END,
    enabled=COALESCE(?,enabled)
    WHERE id=?`,
    [name ?? null, slug ?? null, issuer_url ?? null, client_id ?? null,
     client_secret, client_secret, client_secret,
     enabled !== undefined ? (enabled ? 1 : 0) : null,
     req.params.id]);
  const provider = await rawGet<any>(db, 'SELECT id, name, slug, issuer_url, client_id, enabled FROM oidc_providers WHERE id=?', [req.params.id]);
  res.json(provider);
});

router.delete('/oidc/providers/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM oidc_providers WHERE id=?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  await rawRun(db, 'DELETE FROM oidc_providers WHERE id=?', [req.params.id]);
  res.status(204).end();
});

router.get('/oidc/:slug', async (req, res) => {
  const db = getKnex();
  const provider = await rawGet<any>(db, 'SELECT * FROM oidc_providers WHERE slug=? AND enabled=1', [req.params.slug]);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: provider.client_id,
    redirect_uri: `${process.env.APP_URL ?? 'http://localhost:4000'}/api/auth/oidc/${req.params.slug}/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  res.redirect(`${provider.issuer_url}/authorize?${params.toString()}`);
});

router.get('/oidc/:slug/callback', async (req, res) => {
  const { code, state: _state } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });
  const db = getKnex();
  const provider = await rawGet<any>(db, 'SELECT * FROM oidc_providers WHERE slug=? AND enabled=1', [req.params.slug]);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  try {
    const tokenRes = await fetch(`${provider.issuer_url}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: `${process.env.APP_URL ?? 'http://localhost:4000'}/api/auth/oidc/${req.params.slug}/callback`,
        client_id: provider.client_id,
        client_secret: provider.client_secret,
      }),
    });
    const tokens = await tokenRes.json() as any;
    const payload = jwt.decode(tokens.id_token) as any;
    if (!payload?.email) return res.status(400).json({ error: 'No email in OIDC token' });

    let user = await rawGet<any>(db, 'SELECT * FROM users WHERE email=?', [payload.email.toLowerCase()]);
    if (!user) {
      const id = await rawInsert(db, 'INSERT INTO users (email, name, role, oidc_provider, oidc_sub) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [payload.email.toLowerCase(), payload.name ?? payload.email, 'analyst', provider.slug, payload.sub]);
      user = await rawGet<any>(db, 'SELECT * FROM users WHERE id=?', [id]);
    }
    if (!user.is_active) return res.status(403).json({ error: 'Account inactive' });

    await rawRun(db, 'UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    const jwtToken = signToken(user.id, user.email, user.role);
    const refreshRaw = crypto.randomBytes(48).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400000).toISOString();
    await rawRun(db, 'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, refreshHash, expiresAt]);

    res.cookie('refresh_token', refreshRaw, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: REFRESH_EXPIRY_DAYS * 86400000 });
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    res.redirect(`${clientUrl}?token=${jwtToken}`);
  } catch (e) {
    console.error('OIDC callback error:', e);
    res.status(500).json({ error: 'OIDC authentication failed' });
  }
});

export default router;
