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

import notificationsRouter from '../routes/notifications';
import { createNotification } from '../db/database';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

// createTestApp injects req.user = { id: 1, ... } for all requests
const TEST_USER_ID = 1;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  app = createTestApp(['/api/notifications', notificationsRouter]);
});

beforeEach(async () => {
  await db.raw('DELETE FROM notifications');
});

afterAll(async () => {
  await db.destroy();
});

describe('GET /api/notifications', () => {
  it('returns empty array when no notifications', async () => {
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns unread broadcast notifications (user_id IS NULL)', async () => {
    await createNotification(db, { user_id: null, type: 'taxii_batch_ready', title: 'Batch ready', message: '3 items' });
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Batch ready');
    expect(res.body[0].read).toBe(0);
  });

  it('returns unread user-specific notifications', async () => {
    await createNotification(db, { user_id: TEST_USER_ID, type: 'assignment_due', title: 'Due soon' });
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Due soon');
  });

  it('does not return already-read notifications', async () => {
    await createNotification(db, { user_id: TEST_USER_ID, type: 'assignment_due', title: 'Done' });
    await db.raw('UPDATE notifications SET read = 1');
    const res = await request(app).get('/api/notifications').expect(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks all user-owned notifications as read', async () => {
    await createNotification(db, { user_id: TEST_USER_ID, type: 'assignment_due', title: 'N1' });
    await createNotification(db, { user_id: TEST_USER_ID, type: 'assignment_due', title: 'N2' });
    await request(app).patch('/api/notifications/read-all').expect(204);
    // user-owned rows should now be read=1
    const remaining = await db.raw('SELECT read FROM notifications WHERE user_id = ?', [TEST_USER_ID]);
    expect(remaining.every((r: any) => r.read === 1)).toBe(true);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks a single user-owned notification as read', async () => {
    await createNotification(db, { user_id: TEST_USER_ID, type: 'assignment_due', title: 'Mark me' });
    const rows = await db.raw('SELECT id FROM notifications WHERE user_id = ? LIMIT 1', [TEST_USER_ID]);
    const id = rows[0]?.id;
    expect(id).toBeDefined();
    await request(app).patch(`/api/notifications/${id}/read`).expect(204);
    const after = await db.raw('SELECT read FROM notifications WHERE id = ?', [id]);
    expect(after[0].read).toBe(1);
  });

  it('returns 400 for non-numeric id', async () => {
    await request(app).patch('/api/notifications/abc/read').expect(400);
  });
});
