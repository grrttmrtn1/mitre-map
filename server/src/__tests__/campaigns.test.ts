import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return { ...mod, getKnex: () => testDbHolder.db! };
});

import campaignsRouter from '../routes/campaigns';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  await db.raw("INSERT INTO threat_groups (id, name, aliases) VALUES ('APT29', 'Cozy Bear', '[]')");
  app = createTestApp(['/api/campaigns', campaignsRouter]);
});

beforeEach(async () => {
  await db.raw('DELETE FROM campaign_techniques');
  await db.raw('DELETE FROM group_campaigns');
});

afterAll(async () => { await db.destroy(); });

describe('GET /api/campaigns', () => {
  it('requires group_id', async () => {
    await request(app).get('/api/campaigns').expect(400);
  });

  it('returns empty array for group with no campaigns', async () => {
    const res = await request(app).get('/api/campaigns?group_id=APT29').expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/campaigns', () => {
  it('creates a campaign with technique_ids', async () => {
    const res = await request(app).post('/api/campaigns').send({
      group_id: 'APT29',
      name: 'SolarWinds 2020',
      start_date: '2020-03-01',
      end_date: '2020-12-31',
      technique_ids: ['T1195', 'T1027'],
    }).expect(201);
    expect(res.body.name).toBe('SolarWinds 2020');
    expect(res.body.technique_ids).toEqual(expect.arrayContaining(['T1195', 'T1027']));
  });

  it('returns 400 when name is missing', async () => {
    await request(app).post('/api/campaigns').send({ group_id: 'APT29' }).expect(400);
  });

  it('returns 404 for nonexistent group', async () => {
    await request(app).post('/api/campaigns').send({ group_id: 'NONEXISTENT', name: 'Test' }).expect(404);
  });
});

describe('PUT /api/campaigns/:id', () => {
  it('updates a campaign', async () => {
    const created = await request(app).post('/api/campaigns').send({ group_id: 'APT29', name: 'Old Name' }).expect(201);
    const res = await request(app).put(`/api/campaigns/${created.body.id}`).send({ name: 'New Name', technique_ids: ['T1059'] }).expect(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.technique_ids).toContain('T1059');
  });

  it('returns 404 for unknown campaign', async () => {
    await request(app).put('/api/campaigns/9999').send({ name: 'X' }).expect(404);
  });
});

describe('DELETE /api/campaigns/:id', () => {
  it('deletes a campaign', async () => {
    const created = await request(app).post('/api/campaigns').send({ group_id: 'APT29', name: 'To Delete' }).expect(201);
    await request(app).delete(`/api/campaigns/${created.body.id}`).expect(204);
    const rows = await db.raw('SELECT id FROM group_campaigns WHERE id = ?', [created.body.id]);
    expect(rows).toHaveLength(0);
  });

  it('returns 404 for unknown id', async () => {
    await request(app).delete('/api/campaigns/9999').expect(404);
  });
});
