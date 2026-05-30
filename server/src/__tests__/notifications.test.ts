import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

import notificationsRouter from '../routes/notifications';
import { createNotification } from '../db/database';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  app = createTestApp(['/api/notifications', notificationsRouter]);
});

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/notifications', () => {
  it('returns empty array when no notifications', async () => {
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns unread notifications for user_id null (global)', async () => {
    await createNotification(db, { user_id: null, type: 'taxii_batch_ready', title: 'Batch ready', message: '3 items' });
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Batch ready');
    expect(res.body[0].read).toBe(0);
  });

  it('does not return already-read notifications', async () => {
    await db.raw('UPDATE notifications SET read = 1');
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks all notifications as read', async () => {
    await db.raw('UPDATE notifications SET read = 0');
    await request(app).patch('/api/notifications/read-all').expect(204);
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks a single notification as read', async () => {
    await db.raw('UPDATE notifications SET read = 0');
    const rows = await db.raw('SELECT id FROM notifications LIMIT 1');
    const id = rows[0]?.id;
    if (!id) return;
    await request(app).patch(`/api/notifications/${id}/read`).expect(204);
    const after = await db.raw('SELECT read FROM notifications WHERE id = ?', [id]);
    expect(after[0].read).toBe(1);
  });
});
