import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Issuer, generators } from 'openid-client';
import { getKnex, rawGet, rawAll, rawInsert, rawRun, logAudit } from '../db/database';
import { decryptSecretValue, encryptSecretValue, requireJwtSecret } from '../security';
import { validateBaseUrl } from '../integrations/url-validator';
import { validateBody } from '../middleware/validation';

const router = Router();
const JWT_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 30;

function signToken(userId: number, email: string, role: string) {
  return jwt.sign({ sub: userId, email, role }, requireJwtSecret(), { expiresIn: JWT_EXPIRY });
}

router.post('/login', validateBody({
  email: { type: 'string', required: true, minLength: 3, maxLength: 320 },
  password: { type: 'string', required: true, minLength: 1, maxLength: 1024 },
}, { rejectUnknown: true }), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  const db = getKnex();
  const sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
  const user = await rawGet<any>(db, 'SELECT * FROM users WHERE email=? AND is_active=1', [email.toLowerCase()]);
  if (!user || !user.password_hash) {
    await logAudit(db, 'auth', 'login', 'failed', email.toLowerCase(), { reason: 'user not found' }, sourceIp);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logAudit(db, 'auth', 'login', 'failed', email.toLowerCase(), { reason: 'wrong password' }, sourceIp);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user.id, user.email, user.role);
  const refreshRaw = crypto.randomBytes(48).toString('hex');
  const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
  const refreshFamily = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400000).toISOString();
  await rawRun(db, 'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)', [user.id, refreshHash, refreshFamily, expiresAt]);
  await rawRun(db, 'UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
  await logAudit(db, 'auth', 'login', 'success', user.email, { role: user.role }, sourceIp);

  res.cookie('refresh_token', refreshRaw, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: REFRESH_EXPIRY_DAYS * 86400000 });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/refresh', async (req, res) => {
  const rawToken = req.cookies?.refresh_token;
  if (!rawToken) return res.status(401).json({ error: 'No refresh token' });
  const db = getKnex();
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await rawGet<any>(db, 'SELECT rt.*, u.email, u.role, u.is_active FROM refresh_tokens rt JOIN users u ON rt.user_id=u.id WHERE rt.token_hash=?', [hash]);
  if (!record) {
    // A consumed token being presented again indicates theft or a replay race.
    const replay = await rawGet<any>(db, 'SELECT family_id, user_id FROM consumed_refresh_tokens WHERE token_hash=?', [hash]);
    if (replay) {
      await rawRun(db, 'DELETE FROM refresh_tokens WHERE family_id=?', [replay.family_id]);
      await logAudit(db, 'auth', 'refresh', 'token_reuse_detected', String(replay.user_id), { family_revoked: true },
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null);
    }
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  if (!record.is_active) return res.status(401).json({ error: 'Invalid refresh token' });
  if (new Date(record.expires_at) < new Date()) return res.status(401).json({ error: 'Refresh token expired' });
  const token = signToken(record.user_id, record.email, record.role);
  const nextRaw = crypto.randomBytes(48).toString('hex');
  const nextHash = crypto.createHash('sha256').update(nextRaw).digest('hex');
  const familyId = record.family_id ?? crypto.randomUUID();
  await db.transaction(async trx => {
    await rawRun(trx, 'INSERT INTO consumed_refresh_tokens (token_hash, family_id, user_id, expires_at) VALUES (?, ?, ?, ?)',
      [record.token_hash, familyId, record.user_id, record.expires_at]);
    await rawRun(trx, 'DELETE FROM refresh_tokens WHERE id=?', [record.id]);
    await rawRun(trx, 'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)',
      [record.user_id, nextHash, familyId, record.expires_at]);
  });
  res.cookie('refresh_token', nextRaw, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: Math.max(0, new Date(record.expires_at).getTime() - Date.now()) });
  res.json({ token });
});

router.post('/logout', async (req, res) => {
  const rawToken = req.cookies?.refresh_token;
  const db = getKnex();
  if (rawToken) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await rawRun(db, 'DELETE FROM refresh_tokens WHERE token_hash=?', [hash]);
  }
  const actor = (req as any).actor;
  if (actor) {
    const sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
    await logAudit(db, 'auth', 'logout', 'success', actor, undefined, sourceIp);
  }
  res.clearCookie('refresh_token');
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.get('/sessions', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'User session required' });
  const db = getKnex();
  const rows = await rawAll<any>(db, `
    SELECT id, family_id, created_at, expires_at
    FROM refresh_tokens WHERE user_id=? ORDER BY created_at DESC`, [user.id]);
  res.json(rows.map(row => ({
    id: row.family_id ?? `legacy-${row.id}`,
    created_at: row.created_at,
    expires_at: row.expires_at,
  })));
});

router.delete('/sessions/:id', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'User session required' });
  const db = getKnex();
  if (req.params.id.startsWith('legacy-')) {
    const id = Number(req.params.id.slice(7));
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid session id' });
    await rawRun(db, 'DELETE FROM refresh_tokens WHERE id=? AND user_id=?', [id, user.id]);
  } else {
    await rawRun(db, 'DELETE FROM refresh_tokens WHERE family_id=? AND user_id=?', [req.params.id, user.id]);
  }
  await logAudit(db, 'auth', 'session', 'revoked', user.email, { session_id: req.params.id }, (req as any).sourceIp);
  res.status(204).end();
});

router.delete('/sessions', async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'User session required' });
  const db = getKnex();
  const currentRaw = req.cookies?.refresh_token;
  const currentHash = currentRaw ? crypto.createHash('sha256').update(currentRaw).digest('hex') : null;
  if (currentHash) await rawRun(db, 'DELETE FROM refresh_tokens WHERE user_id=? AND token_hash<>?', [user.id, currentHash]);
  else await rawRun(db, 'DELETE FROM refresh_tokens WHERE user_id=?', [user.id]);
  await logAudit(db, 'auth', 'sessions', 'revoked_others', user.email, undefined, (req as any).sourceIp);
  res.status(204).end();
});

router.get('/oidc/providers', async (_req, res) => {
  const db = getKnex();
  const providers = await rawAll<any>(db, 'SELECT id, name, slug, issuer_url, client_id, enabled FROM oidc_providers ORDER BY name', []);
  res.json(providers);
});

router.get('/oidc/providers/public', async (_req, res) => {
  const db = getKnex();
  const providers = await rawAll<any>(db, 'SELECT id, name, slug FROM oidc_providers WHERE enabled=1 ORDER BY name', []);
  res.json(providers);
});

router.post('/oidc/providers', validateBody({
  name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
  slug: { type: 'string', required: true, minLength: 1, maxLength: 100 },
  issuer_url: { type: 'string', required: true, maxLength: 2048 },
  client_id: { type: 'string', required: true, maxLength: 500 },
  client_secret: { type: 'string', required: true, maxLength: 4096 },
  enabled: { type: 'boolean' },
}, { rejectUnknown: true }), async (req, res) => {
  const { name, slug, issuer_url, client_id, client_secret, enabled } = req.body;
  if (!name || !slug || !issuer_url || !client_id || !client_secret) {
    return res.status(400).json({ error: 'name, slug, issuer_url, client_id, client_secret are required' });
  }
  try { await validateBaseUrl(issuer_url.trim()); } catch (e: any) { return res.status(400).json({ error: e.message }); }
  const db = getKnex();
  try {
    const id = await rawInsert(db,
      'INSERT INTO oidc_providers (name, slug, issuer_url, client_id, client_secret, enabled) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [name.trim(), slug.trim(), issuer_url.trim(), client_id.trim(), encryptSecretValue(client_secret), enabled !== false ? 1 : 0]);
    const provider = await rawGet<any>(db, 'SELECT id, name, slug, issuer_url, client_id, enabled FROM oidc_providers WHERE id=?', [id]);
    await logAudit(db, 'oidc_provider', String(id), 'create', (req as any).actor ?? 'user', { name, slug, issuer_url }, (req as any).sourceIp);
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
  if (issuer_url !== undefined) {
    try { await validateBaseUrl(issuer_url.trim()); } catch (e: any) { return res.status(400).json({ error: e.message }); }
  }
  await rawRun(db, `UPDATE oidc_providers SET
    name=COALESCE(?,name), slug=COALESCE(?,slug), issuer_url=COALESCE(?,issuer_url),
    client_id=COALESCE(?,client_id),
    client_secret=CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE client_secret END,
    enabled=COALESCE(?,enabled)
    WHERE id=?`,
    [name ?? null, slug ?? null, issuer_url ?? null, client_id ?? null,
     client_secret, client_secret, client_secret ? encryptSecretValue(client_secret) : null,
     enabled !== undefined ? (enabled ? 1 : 0) : null,
     req.params.id]);
  const provider = await rawGet<any>(db, 'SELECT id, name, slug, issuer_url, client_id, enabled FROM oidc_providers WHERE id=?', [req.params.id]);
  await logAudit(db, 'oidc_provider', req.params.id, 'update', (req as any).actor ?? 'user',
    { name, slug, issuer_url, client_id, enabled }, (req as any).sourceIp);
  res.json(provider);
});

router.delete('/oidc/providers/:id', async (req, res) => {
  const db = getKnex();
  const provider = await rawGet<any>(db, 'SELECT id, name, slug FROM oidc_providers WHERE id=?', [req.params.id]);
  if (!provider) {
    return res.status(404).json({ error: 'Not found' });
  }
  await rawRun(db, 'DELETE FROM oidc_providers WHERE id=?', [req.params.id]);
  await logAudit(db, 'oidc_provider', req.params.id, 'delete', (req as any).actor ?? 'user',
    { name: provider.name, slug: provider.slug }, (req as any).sourceIp);
  res.status(204).end();
});

router.post('/oidc/:slug/link', async (req, res) => {
  const currentUser = (req as any).user;
  if (!currentUser) return res.status(401).json({ error: 'Sign in before linking an identity provider' });
  const db = getKnex();
  const provider = await rawGet<any>(db, 'SELECT * FROM oidc_providers WHERE slug=? AND enabled=1', [req.params.slug]);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  try { await validateBaseUrl(provider.issuer_url); } catch (e: any) { return res.status(400).json({ error: e.message }); }

  const state = crypto.randomBytes(16).toString('hex');
  const nonce = generators.nonce();
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 10 * 60 * 1000 };
  res.cookie('oidc_state', state, cookieOptions);
  res.cookie('oidc_nonce', nonce, cookieOptions);
  res.cookie('oidc_link', jwt.sign({ sub: currentUser.id, provider: provider.slug, purpose: 'oidc-link' }, requireJwtSecret(), { expiresIn: '10m' }), cookieOptions);
  const params = new URLSearchParams({
    client_id: provider.client_id,
    redirect_uri: `${process.env.APP_URL ?? 'http://localhost:4000'}/api/auth/oidc/${req.params.slug}/callback`,
    response_type: 'code', scope: 'openid email profile', state, nonce,
  });
  res.json({ authorization_url: `${provider.issuer_url}/authorize?${params.toString()}` });
});

router.get('/oidc/:slug', async (req, res) => {
  const db = getKnex();
  const provider = await rawGet<any>(db, 'SELECT * FROM oidc_providers WHERE slug=? AND enabled=1', [req.params.slug]);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  try { await validateBaseUrl(provider.issuer_url); } catch (e: any) { return res.status(400).json({ error: e.message }); }
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = generators.nonce();
  // Store state in short-lived httpOnly cookie for CSRF validation in the callback
  res.cookie('oidc_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });
  res.cookie('oidc_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });
  const params = new URLSearchParams({
    client_id: provider.client_id,
    redirect_uri: `${process.env.APP_URL ?? 'http://localhost:4000'}/api/auth/oidc/${req.params.slug}/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
  });
  res.redirect(`${provider.issuer_url}/authorize?${params.toString()}`);
});

router.get('/oidc/:slug/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });

  // Validate OIDC state to prevent CSRF
  const expectedState = req.cookies?.oidc_state;
  if (!state || !expectedState || state !== expectedState) {
    return res.status(400).json({ error: 'Invalid or missing state parameter' });
  }
  res.clearCookie('oidc_state');
  const expectedNonce = req.cookies?.oidc_nonce;
  res.clearCookie('oidc_nonce');
  const linkToken = req.cookies?.oidc_link;
  res.clearCookie('oidc_link');
  if (!expectedNonce) return res.status(400).json({ error: 'Invalid or missing nonce parameter' });

  const db = getKnex();
  const provider = await rawGet<any>(db, 'SELECT * FROM oidc_providers WHERE slug=? AND enabled=1', [req.params.slug]);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  try { await validateBaseUrl(provider.issuer_url); } catch (e: any) { return res.status(400).json({ error: e.message }); }

  try {
    const issuer = await Issuer.discover(provider.issuer_url);
    const client = new issuer.Client({
      client_id: provider.client_id,
      client_secret: decryptSecretValue(provider.client_secret) ?? provider.client_secret,
    });
    const redirectUri = `${process.env.APP_URL ?? 'http://localhost:4000'}/api/auth/oidc/${req.params.slug}/callback`;
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(redirectUri, params, { state: String(state), nonce: expectedNonce });
    const payload = tokenSet.claims() as any;
    if (!payload?.email) return res.status(400).json({ error: 'No email in OIDC token' });

    const sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
    if (linkToken) {
      let link: any;
      try { link = jwt.verify(linkToken, requireJwtSecret()); } catch { return res.status(400).json({ error: 'Account-link request expired or invalid' }); }
      if (link.purpose !== 'oidc-link' || link.provider !== provider.slug) return res.status(400).json({ error: 'Account-link provider mismatch' });
      const owner = await rawGet<any>(db, 'SELECT id FROM users WHERE oidc_provider=? AND oidc_sub=?', [provider.slug, String(payload.sub)]);
      if (owner && Number(owner.id) !== Number(link.sub)) return res.status(409).json({ error: 'This external identity is already linked to another account' });
      const target = await rawGet<any>(db, 'SELECT id, email FROM users WHERE id=? AND is_active=1', [link.sub]);
      if (!target) return res.status(404).json({ error: 'Account no longer exists or is inactive' });
      await rawRun(db, 'UPDATE users SET oidc_provider=?, oidc_sub=? WHERE id=?', [provider.slug, String(payload.sub), target.id]);
      await logAudit(db, 'user', String(target.id), 'oidc_linked', target.email,
        { provider: provider.slug, external_email: payload.email.toLowerCase() }, sourceIp);
      const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
      return res.redirect(`${clientUrl}/settings#identity-linked`);
    }

    // External identities are authoritative by provider + subject, never email.
    // Email-only matching lets a second IdP claim an existing privileged account.
    let user = await rawGet<any>(db, 'SELECT * FROM users WHERE oidc_provider=? AND oidc_sub=?',
      [provider.slug, String(payload.sub)]);
    if (!user) {
      const existingEmail = await rawGet<any>(db, 'SELECT id FROM users WHERE email=?', [payload.email.toLowerCase()]);
      if (existingEmail) {
        await logAudit(db, 'auth', 'login', 'failed', payload.email.toLowerCase(),
          { reason: 'explicit account linking required', via: 'oidc', provider: provider.slug }, sourceIp);
        return res.status(409).json({ error: 'An account with this email already exists. Sign in to that account and link this identity first.' });
      }
      const id = await rawInsert(db, 'INSERT INTO users (email, name, role, oidc_provider, oidc_sub) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [payload.email.toLowerCase(), payload.name ?? payload.email, 'analyst', provider.slug, String(payload.sub)]);
      user = await rawGet<any>(db, 'SELECT * FROM users WHERE id=?', [id]);
      await logAudit(db, 'user', String(id), 'create', payload.email.toLowerCase(),
        { email: payload.email.toLowerCase(), role: 'analyst', via: 'oidc', provider: provider.slug }, sourceIp);
    }
    if (!user.is_active) {
      await logAudit(db, 'auth', 'login', 'failed', payload.email.toLowerCase(),
        { reason: 'account inactive', via: 'oidc', provider: provider.slug }, sourceIp);
      return res.status(403).json({ error: 'Account inactive' });
    }

    await rawRun(db, 'UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    await logAudit(db, 'auth', 'login', 'success', user.email,
      { role: user.role, via: 'oidc', provider: provider.slug }, sourceIp);
    const jwtToken = signToken(user.id, user.email, user.role);
    const refreshRaw = crypto.randomBytes(48).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshRaw).digest('hex');
    const refreshFamily = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400000).toISOString();
    await rawRun(db, 'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)', [user.id, refreshHash, refreshFamily, expiresAt]);

    res.cookie('refresh_token', refreshRaw, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: REFRESH_EXPIRY_DAYS * 86400000 });
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    // Use URL fragment so the token is never sent to the server in logs/referer headers
    res.redirect(`${clientUrl}#token=${jwtToken}`);
  } catch (e) {
    console.error('OIDC callback error:', e);
    res.status(500).json({ error: 'OIDC authentication failed' });
  }
});

export default router;
