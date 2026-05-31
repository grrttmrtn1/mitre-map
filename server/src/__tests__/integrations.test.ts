import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return {
    ...mod,
    getKnex: () => testDbHolder.db!,
  };
});

// Mock the GitHub sync and SIEM connectors so tests don't make real HTTP calls
vi.mock('../integrations/github-sync', () => ({
  runGithubSync: vi.fn().mockResolvedValue({ staged: 3, sha: 'abc123' }),
}));

vi.mock('../integrations/siem/sentinel', () => ({
  createSentinelConnector: () => ({
    testConnection: vi.fn().mockResolvedValue({ ok: true, message: 'Connected' }),
    pushRule: vi.fn().mockResolvedValue({ ok: true, remoteId: 'rule-1', message: 'Rule pushed' }),
    pullStatuses: vi.fn().mockResolvedValue([{ remote_id: 'rule-1', enabled: true }]),
  }),
}));

import integrationsRouter from '../routes/integrations';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  app = createTestApp(['/api/integrations', integrationsRouter]);
});

beforeEach(async () => {
  await db.raw('DELETE FROM siem_sync_log');
  await db.raw('DELETE FROM siem_integrations');
  await db.raw('DELETE FROM github_sync_configs');
  await db.raw('DELETE FROM ticketing_configs');
});

afterAll(async () => {
  await db.destroy();
});

// ── SIEM Integrations ─────────────────────────────────────────────────────────

describe('GET /api/integrations/siem', () => {
  it('returns empty array when none', async () => {
    const res = await request(app).get('/api/integrations/siem').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns created integrations without credentials_enc', async () => {
    await db.raw(`INSERT INTO siem_integrations (name, type, config, credentials_enc, enabled) VALUES ('Splunk Prod', 'splunk', '{}', 'secret', 1)`);
    const res = await request(app).get('/api/integrations/siem').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Splunk Prod');
    expect(res.body[0].credentials_enc).toBeUndefined();
  });
});

describe('POST /api/integrations/siem', () => {
  it('creates a SIEM integration and strips credentials_enc from response', async () => {
    const res = await request(app)
      .post('/api/integrations/siem')
      .send({ name: 'Splunk Dev', type: 'splunk', config: { base_url: 'https://splunk.example.com', app: 'search' }, credentials: { token: 'supersecret' } })
      .expect(201);
    expect(res.body.name).toBe('Splunk Dev');
    expect(res.body.type).toBe('splunk');
    expect(res.body.credentials_enc).toBeUndefined();
    // verify encrypted in DB
    const row = await db.raw('SELECT credentials_enc FROM siem_integrations WHERE id = ?', [res.body.id]);
    expect(row[0].credentials_enc).toBeTruthy();
  });

  it('returns 400 when name is missing', async () => {
    await request(app).post('/api/integrations/siem').send({ type: 'splunk' }).expect(400);
  });

  it('returns 400 for unknown type', async () => {
    await request(app).post('/api/integrations/siem').send({ name: 'X', type: 'unknown' }).expect(400);
  });
});

describe('GET /api/integrations/siem/:id', () => {
  it('returns 404 for missing integration', async () => {
    await request(app).get('/api/integrations/siem/9999').expect(404);
  });

  it('returns the integration', async () => {
    await db.raw(`INSERT INTO siem_integrations (name, type, config, enabled) VALUES ('QR', 'qradar', '{}', 1)`);
    const row = await db.raw('SELECT id FROM siem_integrations LIMIT 1');
    const res = await request(app).get(`/api/integrations/siem/${row[0].id}`).expect(200);
    expect(res.body.name).toBe('QR');
    expect(res.body.credentials_enc).toBeUndefined();
  });
});

describe('PUT /api/integrations/siem/:id', () => {
  it('updates name and enabled flag', async () => {
    await db.raw(`INSERT INTO siem_integrations (name, type, config, enabled) VALUES ('Old Name', 'splunk', '{}', 1)`);
    const row = await db.raw('SELECT id FROM siem_integrations LIMIT 1');
    const res = await request(app)
      .put(`/api/integrations/siem/${row[0].id}`)
      .send({ name: 'New Name', enabled: false })
      .expect(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.enabled).toBe(0);
  });
});

describe('DELETE /api/integrations/siem/:id', () => {
  it('deletes the integration', async () => {
    await db.raw(`INSERT INTO siem_integrations (name, type, config, enabled) VALUES ('Temp', 'splunk', '{}', 1)`);
    const row = await db.raw('SELECT id FROM siem_integrations LIMIT 1');
    await request(app).delete(`/api/integrations/siem/${row[0].id}`).expect(204);
    const after = await db.raw('SELECT id FROM siem_integrations WHERE id = ?', [row[0].id]);
    expect(after).toHaveLength(0);
  });
});

describe('POST /api/integrations/siem/:id/test', () => {
  it('returns connection test result', async () => {
    await db.raw(`INSERT INTO siem_integrations (name, type, config, enabled) VALUES ('Sentinel', 'sentinel', '{}', 1)`);
    const row = await db.raw('SELECT id FROM siem_integrations LIMIT 1');
    const res = await request(app)
      .post(`/api/integrations/siem/${row[0].id}/test`)
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toBe('Connected');
  });

  it('returns 404 for non-existent integration', async () => {
    const res = await request(app).post('/api/integrations/siem/9999/test').send().expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ── GitHub Sync Configs ───────────────────────────────────────────────────────

describe('GET /api/integrations/github-sync', () => {
  it('returns empty array when none', async () => {
    const res = await request(app).get('/api/integrations/github-sync').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns list after creating a config', async () => {
    await request(app)
      .post('/api/integrations/github-sync')
      .send({ name: 'Sigma Rules', repo_url: 'https://github.com/SigmaHQ/sigma' })
      .expect(201);
    const res = await request(app).get('/api/integrations/github-sync').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Sigma Rules');
  });
});

describe('POST /api/integrations/github-sync', () => {
  it('creates a config without exposing token', async () => {
    const res = await request(app)
      .post('/api/integrations/github-sync')
      .send({ name: 'SigmaHQ', repo_url: 'https://github.com/SigmaHQ/sigma', token: 'ghp_secret' })
      .expect(201);
    expect(res.body.name).toBe('SigmaHQ');
    expect(res.body.token_enc).toBeUndefined();
    const row = await db.raw('SELECT token_enc FROM github_sync_configs WHERE id = ?', [res.body.id]);
    expect(row[0].token_enc).toBeTruthy();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/integrations/github-sync')
      .send({ repo_url: 'https://github.com/example/repo' })
      .expect(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 when repo_url is missing', async () => {
    await request(app).post('/api/integrations/github-sync').send({ name: 'X' }).expect(400);
  });

  it('returns 400 when repo_url uses http instead of https', async () => {
    const res = await request(app)
      .post('/api/integrations/github-sync')
      .send({ name: 'Insecure', repo_url: 'http://github.com/example/repo' })
      .expect(400);
    expect(res.body.error).toMatch(/https/i);
  });
});

describe('DELETE /api/integrations/github-sync/:id', () => {
  it('deletes the config', async () => {
    await db.raw(`INSERT INTO github_sync_configs (name, repo_url, branch, path_glob, enabled) VALUES ('X', 'https://github.com/x/y', 'main', '**/*.yml', 1)`);
    const row = await db.raw('SELECT id FROM github_sync_configs LIMIT 1');
    await request(app).delete(`/api/integrations/github-sync/${row[0].id}`).expect(204);
  });
});

describe('POST /api/integrations/github-sync/:id/run', () => {
  it('runs the sync and returns staged count', async () => {
    await db.raw(`INSERT INTO github_sync_configs (name, repo_url, branch, path_glob, enabled) VALUES ('SHQ', 'https://github.com/SigmaHQ/sigma', 'main', '**/*.yml', 1)`);
    const row = await db.raw('SELECT id FROM github_sync_configs LIMIT 1');
    const res = await request(app).post(`/api/integrations/github-sync/${row[0].id}/run`).expect(200);
    expect(res.body.staged).toBe(3);
    expect(res.body.sha).toBe('abc123');
  });
});

// ── Ticketing Configs ─────────────────────────────────────────────────────────

describe('GET /api/integrations/ticketing', () => {
  it('returns empty array when none', async () => {
    const res = await request(app).get('/api/integrations/ticketing').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns list without credentials_enc', async () => {
    await request(app)
      .post('/api/integrations/ticketing')
      .send({ name: 'Jira Cloud', type: 'jira', base_url: 'https://acme.atlassian.net', credentials: { token: 'secret' } })
      .expect(201);
    const res = await request(app).get('/api/integrations/ticketing').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).not.toHaveProperty('credentials_enc');
  });
});

describe('POST /api/integrations/ticketing', () => {
  it('creates a Jira config without exposing credentials', async () => {
    const res = await request(app)
      .post('/api/integrations/ticketing')
      .send({ name: 'Jira Prod', type: 'jira', base_url: 'https://acme.atlassian.net', credentials: { username: 'user', token: 'tok' }, default_project: 'SEC' })
      .expect(201);
    expect(res.body.name).toBe('Jira Prod');
    expect(res.body.type).toBe('jira');
    expect(res.body.credentials_enc).toBeUndefined();
    const row = await db.raw('SELECT credentials_enc FROM ticketing_configs WHERE id = ?', [res.body.id]);
    expect(row[0].credentials_enc).toBeTruthy();
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/integrations/ticketing')
      .send({ type: 'jira', base_url: 'https://acme.atlassian.net' })
      .expect(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post('/api/integrations/ticketing')
      .send({ name: 'My Jira', base_url: 'https://acme.atlassian.net' })
      .expect(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('returns 400 for unknown type', async () => {
    const res = await request(app)
      .post('/api/integrations/ticketing')
      .send({ name: 'X', type: 'zendesk', base_url: 'https://x.com' })
      .expect(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('returns 400 when base_url is missing', async () => {
    await request(app).post('/api/integrations/ticketing').send({ name: 'X', type: 'jira' }).expect(400);
  });

  it('accepts http base_url (ticketing route does not enforce https)', async () => {
    // The ticketing POST does NOT call validateBaseUrl, so http:// is accepted
    const res = await request(app)
      .post('/api/integrations/ticketing')
      .send({ name: 'Internal Jira', type: 'jira', base_url: 'http://internal.jira.corp' })
      .expect(201);
    expect(res.body.base_url).toBe('http://internal.jira.corp');
  });
});

describe('DELETE /api/integrations/ticketing/:id', () => {
  it('deletes the config', async () => {
    await db.raw(`INSERT INTO ticketing_configs (name, type, base_url, enabled) VALUES ('SN', 'servicenow', 'https://acme.service-now.com', 1)`);
    const row = await db.raw('SELECT id FROM ticketing_configs LIMIT 1');
    await request(app).delete(`/api/integrations/ticketing/${row[0].id}`).expect(204);
    const after = await db.raw('SELECT id FROM ticketing_configs WHERE id = ?', [row[0].id]);
    expect(after).toHaveLength(0);
  });
});

describe('GET /api/integrations/siem/:id/log', () => {
  it('returns empty log for new integration', async () => {
    await db.raw(`INSERT INTO siem_integrations (name, type, config, enabled) VALUES ('X', 'splunk', '{}', 1)`);
    const row = await db.raw('SELECT id FROM siem_integrations LIMIT 1');
    const res = await request(app).get(`/api/integrations/siem/${row[0].id}/log`).expect(200);
    expect(res.body).toEqual([]);
  });
});
