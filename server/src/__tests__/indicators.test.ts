import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return { ...mod, getKnex: () => testDbHolder.db! };
});

import indicatorsRouter from '../routes/indicators';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  app = createTestApp(['/api/indicators', indicatorsRouter]);
});

beforeEach(async () => {
  await db.raw('DELETE FROM indicators');
});

afterAll(async () => { await db.destroy(); });

describe('POST /api/indicators', () => {
  it('creates an IP indicator', async () => {
    const res = await request(app).post('/api/indicators').send({
      type: 'ip', value: '185.220.101.1', confidence: 'high', notes: 'C2 server',
    }).expect(201);
    expect(res.body.type).toBe('ip');
    expect(res.body.value).toBe('185.220.101.1');
    expect(res.body.confidence).toBe('high');
  });

  it('creates a domain indicator', async () => {
    const res = await request(app).post('/api/indicators').send({ type: 'domain', value: 'evil.example.com' }).expect(201);
    expect(res.body.type).toBe('domain');
  });

  it('rejects invalid type', async () => {
    await request(app).post('/api/indicators').send({ type: 'phone', value: '555-1234' }).expect(400);
  });

  it('rejects empty value', async () => {
    await request(app).post('/api/indicators').send({ type: 'ip', value: '   ' }).expect(400);
  });
});

describe('GET /api/indicators', () => {
  it('returns all indicators', async () => {
    await request(app).post('/api/indicators').send({ type: 'ip', value: '1.2.3.4' });
    await request(app).post('/api/indicators').send({ type: 'domain', value: 'bad.com' });
    const res = await request(app).get('/api/indicators').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('PUT /api/indicators/:id', () => {
  it('updates notes', async () => {
    const created = await request(app).post('/api/indicators').send({ type: 'ip', value: '5.6.7.8' }).expect(201);
    const res = await request(app).put(`/api/indicators/${created.body.id}`).send({ notes: 'Updated note' }).expect(200);
    expect(res.body.notes).toBe('Updated note');
  });

  it('returns 404 for unknown indicator', async () => {
    await request(app).put('/api/indicators/9999').send({ notes: 'X' }).expect(404);
  });
});

describe('DELETE /api/indicators/:id', () => {
  it('deletes an indicator', async () => {
    const created = await request(app).post('/api/indicators').send({ type: 'hash', value: 'abc123' }).expect(201);
    await request(app).delete(`/api/indicators/${created.body.id}`).expect(204);
    const rows = await db.raw('SELECT id FROM indicators WHERE id = ?', [created.body.id]);
    expect(rows).toHaveLength(0);
  });
});

describe('GET /api/indicators/export/stix', () => {
  it('returns a valid STIX 2.1 bundle', async () => {
    await request(app).post('/api/indicators').send({ type: 'domain', value: 'evil.example.com' }).expect(201);
    const res = await request(app).get('/api/indicators/export/stix').expect(200);
    expect(res.body.type).toBe('bundle');
    expect(res.body.spec_version).toBe('2.1');
    expect(Array.isArray(res.body.objects)).toBe(true);
    expect(res.body.objects.length).toBeGreaterThan(0);
  });

  it('returns empty bundle when no indicators', async () => {
    const res = await request(app).get('/api/indicators/export/stix').expect(200);
    expect(res.body.objects).toHaveLength(0);
  });
});
