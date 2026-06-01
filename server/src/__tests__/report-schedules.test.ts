import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return { ...mod, getKnex: () => testDbHolder.db! };
});

vi.mock('../reporting/scheduler', () => ({
  scheduleReport: vi.fn(),
  stopReport: vi.fn(),
  initReportScheduler: vi.fn(),
}));

import reportSchedulesRouter from '../routes/report-schedules';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  app = createTestApp(['/api/report-schedules', reportSchedulesRouter]);
});

beforeEach(async () => {
  await db.raw('DELETE FROM report_schedules');
});

afterAll(async () => { await db.destroy(); });

describe('POST /api/report-schedules', () => {
  it('creates a schedule', async () => {
    const res = await request(app).post('/api/report-schedules').send({
      name: 'Weekly Executive', report_type: 'executive',
      schedule: '0 8 * * 1', recipients: ['ciso@example.com'], format: 'pdf',
    }).expect(201);
    expect(res.body.name).toBe('Weekly Executive');
    expect(Array.isArray(res.body.recipients)).toBe(true);
  });

  it('rejects invalid cron expression', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'Bad', report_type: 'executive', schedule: 'not-a-cron', recipients: ['a@b.com'],
    }).expect(400);
  });

  it('rejects empty recipients', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'No Recip', report_type: 'gaps', schedule: '0 8 * * *', recipients: [],
    }).expect(400);
  });

  it('rejects invalid report type', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'Bad Type', report_type: 'unknown', schedule: '0 8 * * *', recipients: ['a@b.com'],
    }).expect(400);
  });
});

describe('GET /api/report-schedules', () => {
  it('returns empty array when none', async () => {
    const res = await request(app).get('/api/report-schedules').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns created schedules with parsed recipients', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'Test', report_type: 'executive', schedule: '0 8 * * 1', recipients: ['a@b.com'],
    }).expect(201);
    const res = await request(app).get('/api/report-schedules').expect(200);
    expect(res.body).toHaveLength(1);
    expect(Array.isArray(res.body[0].recipients)).toBe(true);
  });
});

describe('DELETE /api/report-schedules/:id', () => {
  it('deletes a schedule', async () => {
    const created = await request(app).post('/api/report-schedules').send({
      name: 'Del me', report_type: 'gaps', schedule: '0 8 * * *', recipients: ['x@y.com'],
    }).expect(201);
    await request(app).delete(`/api/report-schedules/${created.body.id}`).expect(204);
  });

  it('returns 404 for missing id', async () => {
    await request(app).delete('/api/report-schedules/9999').expect(404);
  });
});
