import { Router } from 'express';
import { getKnex, rawAll, rawRun } from '../db/database';

const router = Router();

// GET /api/notifications — unread notifications for current user
router.get('/', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).userId ?? null;
  const rows = await rawAll(
    db,
    `SELECT * FROM notifications
     WHERE (user_id IS NULL OR user_id = ?) AND read = 0
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  res.json(rows);
});

// PATCH /api/notifications/read-all — must be before /:id route
router.patch('/read-all', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).userId ?? null;
  await rawRun(
    db,
    'UPDATE notifications SET read = 1 WHERE user_id = ? OR user_id IS NULL',
    [userId]
  );
  res.status(204).end();
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const db = getKnex();
  await rawRun(db, 'UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

export default router;
