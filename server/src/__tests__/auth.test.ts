import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createTestDb, setupTestDb } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

// ─── Pure function tests ───────────────────────────────────────────────────────

import { requiredScope, scopeGranted } from '../middleware/auth';

describe('requiredScope', () => {
  it('returns "read" for all GET requests regardless of path', () => {
    expect(requiredScope('GET', '/detections')).toBe('read');
    expect(requiredScope('GET', '/api-keys')).toBe('read');
    expect(requiredScope('GET', '/admin/purge')).toBe('read');
    expect(requiredScope('GET', '/users')).toBe('read');
  });

  it('returns "admin" for non-GET requests to /api-keys', () => {
    expect(requiredScope('POST', '/api-keys')).toBe('admin');
    expect(requiredScope('DELETE', '/api-keys')).toBe('admin');
    expect(requiredScope('PUT', '/api-keys/1')).toBe('admin');
  });

  it('returns "admin" for non-GET requests to /admin', () => {
    expect(requiredScope('POST', '/admin/purge')).toBe('admin');
    expect(requiredScope('DELETE', '/admin/something')).toBe('admin');
  });

  it('returns "admin" for non-GET requests to /users', () => {
    expect(requiredScope('POST', '/users')).toBe('admin');
    expect(requiredScope('PUT', '/users/1')).toBe('admin');
    expect(requiredScope('PATCH', '/users/1')).toBe('admin');
    expect(requiredScope('DELETE', '/users/1')).toBe('admin');
  });

  it('returns "write" for non-GET requests to regular routes', () => {
    expect(requiredScope('POST', '/detections')).toBe('write');
    expect(requiredScope('PUT', '/detections/1')).toBe('write');
    expect(requiredScope('DELETE', '/tools/5')).toBe('write');
    expect(requiredScope('PATCH', '/coverage/stats')).toBe('write');
  });
});

describe('scopeGranted', () => {
  it('admin scope grants all permission levels', () => {
    expect(scopeGranted(['admin'], 'admin')).toBe(true);
    expect(scopeGranted(['admin'], 'write')).toBe(true);
    expect(scopeGranted(['admin'], 'read')).toBe(true);
  });

  it('write scope grants write and read but not admin', () => {
    expect(scopeGranted(['write'], 'write')).toBe(true);
    expect(scopeGranted(['write'], 'read')).toBe(true);
    expect(scopeGranted(['write'], 'admin')).toBe(false);
  });

  it('read scope grants only read', () => {
    expect(scopeGranted(['read'], 'read')).toBe(true);
    expect(scopeGranted(['read'], 'write')).toBe(false);
    expect(scopeGranted(['read'], 'admin')).toBe(false);
  });

  it('empty scopes grant nothing', () => {
    expect(scopeGranted([], 'read')).toBe(false);
    expect(scopeGranted([], 'write')).toBe(false);
    expect(scopeGranted([], 'admin')).toBe(false);
  });

  it('multiple scopes including write still grant read', () => {
    expect(scopeGranted(['write', 'read'], 'read')).toBe(true);
    expect(scopeGranted(['write', 'read'], 'write')).toBe(true);
    expect(scopeGranted(['write', 'read'], 'admin')).toBe(false);
  });
});

// ─── requireApiKey middleware integration tests ────────────────────────────────

const JWT_SECRET = 'mitremap-dev-secret-change-in-production';

let db: KnexType;

// Mock getKnex and rawGet to return our test DB
const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return {
    ...mod,
    getKnex: () => testDbHolder.db!,
  };
});

import { invalidateAuthCache } from '../middleware/auth';
import { requireApiKey } from '../middleware/auth';

// Simple test app with the auth middleware
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', requireApiKey);
  app.get('/api/test', (_req, res) => res.json({ ok: true }));
  app.post('/api/detections', (_req, res) => res.json({ ok: true }));
  app.post('/api/users', (_req, res) => res.json({ ok: true }));
  return app;
}

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(() => {
  invalidateAuthCache();
});

describe('requireApiKey middleware', () => {
  it('allows all requests in bootstrap mode (no users or keys)', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  describe('with auth entities present', () => {
    let userId: number;

    beforeAll(async () => {
      // Insert a user so bootstrap mode is disabled
      await db.raw(`INSERT INTO users (email, name, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)`,
        ['test@example.com', 'Test User', '$2a$10$placeholder', 'analyst', 1]);
      const row = await db.raw(`SELECT id FROM users WHERE email='test@example.com'`);
      userId = (Array.isArray(row) ? row : row.rows)[0].id;
      invalidateAuthCache();
    });

    afterAll(async () => {
      await db.raw(`DELETE FROM users WHERE email='test@example.com'`);
      await db.raw(`DELETE FROM api_keys WHERE name='test-key'`);
      invalidateAuthCache();
    });

    it('rejects requests with no Authorization header', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects requests with malformed Authorization header', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/test').set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
    });

    it('accepts a valid JWT and passes the request through', async () => {
      const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '15m' });
      const app = makeApp();
      const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('rejects a JWT signed with the wrong secret', async () => {
      const token = jwt.sign({ sub: userId }, 'wrong-secret', { expiresIn: '15m' });
      const app = makeApp();
      const res = await request(app).get('/api/test').set('Authorization', `Bearer ${token}`);
      // Not a valid JWT → falls through to API key check → invalid credential
      expect(res.status).toBe(401);
    });

    it('enforces scope: analyst cannot POST to /api/users', async () => {
      const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '15m' });
      const app = makeApp();
      const res = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).toBe(403);
      expect(res.body.required).toBe('admin');
    });

    it('allows analyst to POST to a write-scoped route', async () => {
      const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '15m' });
      const app = makeApp();
      const res = await request(app).post('/api/detections').set('Authorization', `Bearer ${token}`).send({});
      expect(res.status).toBe(200);
    });

    it('accepts a valid API key with sufficient scope', async () => {
      const rawKey = 'test-api-key-value-' + Date.now();
      const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
      await db.raw(
        `INSERT INTO api_keys (name, key_hash, masked_key, scopes) VALUES (?, ?, ?, ?)`,
        ['test-key', hash, rawKey.slice(0, 8) + '...', JSON.stringify(['read', 'write'])],
      );
      invalidateAuthCache();

      const app = makeApp();
      const res = await request(app).get('/api/test').set('Authorization', `Bearer ${rawKey}`);
      expect(res.status).toBe(200);
    });

    it('rejects an expired API key', async () => {
      const rawKey = 'expired-key-' + Date.now();
      const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const pastDate = new Date(Date.now() - 1000).toISOString();
      await db.raw(
        `INSERT INTO api_keys (name, key_hash, masked_key, scopes, expires_at) VALUES (?, ?, ?, ?, ?)`,
        ['expired-key', hash, rawKey.slice(0, 8) + '...', JSON.stringify(['read']), pastDate],
      );
      invalidateAuthCache();

      const app = makeApp();
      const res = await request(app).get('/api/test').set('Authorization', `Bearer ${rawKey}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('expired');
    });

    it('rejects a completely unknown token', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/test').set('Authorization', 'Bearer totally-unknown-garbage');
      expect(res.status).toBe(401);
    });
  });
});
