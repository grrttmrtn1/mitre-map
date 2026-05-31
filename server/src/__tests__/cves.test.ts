import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return { ...mod, getKnex: () => testDbHolder.db! };
});

import cvesRouter from '../routes/cves';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  app = createTestApp(['/api/cves', cvesRouter]);
});

beforeEach(async () => {
  await db.raw('DELETE FROM cve_techniques');
  await db.raw('DELETE FROM cves');
});

afterAll(async () => { await db.destroy(); });

describe('POST /api/cves', () => {
  it('creates a CVE record', async () => {
    const res = await request(app).post('/api/cves').send({
      id: 'CVE-2021-44228',
      description: 'Log4Shell RCE',
      cvss_score: 10.0,
      cvss_severity: 'CRITICAL',
      technique_ids: ['T1190'],
    }).expect(201);
    expect(res.body.id).toBe('CVE-2021-44228');
    expect(res.body.cvss_score).toBe(10.0);
  });

  it('rejects invalid CVE ID format', async () => {
    await request(app).post('/api/cves').send({ id: 'NOT-A-CVE', description: 'Bad' }).expect(400);
  });

  it('upserts on duplicate id', async () => {
    await request(app).post('/api/cves').send({ id: 'CVE-2021-44228', cvss_score: 9.0 }).expect(201);
    await request(app).post('/api/cves').send({ id: 'CVE-2021-44228', cvss_score: 10.0 }).expect(201);
    const res = await request(app).get('/api/cves').expect(200);
    const cves = res.body.filter((c: any) => c.id === 'CVE-2021-44228');
    expect(cves).toHaveLength(1);
    expect(cves[0].cvss_score).toBe(10.0);
  });
});

describe('GET /api/cves', () => {
  it('returns all CVEs when no filter', async () => {
    await request(app).post('/api/cves').send({ id: 'CVE-2021-44228', cvss_score: 10.0 });
    await request(app).post('/api/cves').send({ id: 'CVE-2022-00001', cvss_score: 5.0 });
    const res = await request(app).get('/api/cves').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by technique_id', async () => {
    await request(app).post('/api/cves').send({ id: 'CVE-2021-44228', cvss_score: 10.0, technique_ids: ['T1190'] });
    await request(app).post('/api/cves').send({ id: 'CVE-2022-99999', cvss_score: 5.0, technique_ids: ['T1059'] });
    const res = await request(app).get('/api/cves?technique_id=T1190').expect(200);
    expect(res.body.some((c: any) => c.id === 'CVE-2021-44228')).toBe(true);
    expect(res.body.some((c: any) => c.id === 'CVE-2022-99999')).toBe(false);
  });
});

describe('GET /api/cves/gap-summary', () => {
  it('returns technique-level CVE summary', async () => {
    await request(app).post('/api/cves').send({ id: 'CVE-2021-44228', cvss_score: 10.0, technique_ids: ['T1190'] });
    const res = await request(app).get('/api/cves/gap-summary').expect(200);
    const row = res.body.find((r: any) => r.technique_id === 'T1190');
    expect(row).toBeDefined();
    expect(row.cve_count).toBe(1);
    expect(Number(row.max_cvss)).toBe(10.0);
  });
});

describe('POST /api/cves/:id/techniques', () => {
  it('links a technique to an existing CVE', async () => {
    await request(app).post('/api/cves').send({ id: 'CVE-2021-44228', cvss_score: 10.0 }).expect(201);
    const res = await request(app).post('/api/cves/CVE-2021-44228/techniques').send({ technique_id: 'T1059' }).expect(201);
    expect(res.body.technique_id).toBe('T1059');
  });

  it('returns 404 for unknown CVE', async () => {
    await request(app).post('/api/cves/CVE-9999-99999/techniques').send({ technique_id: 'T1190' }).expect(404);
  });
});
