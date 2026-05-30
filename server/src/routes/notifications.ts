import { Router } from 'express';
import { getKnex, rawAll, rawRun } from '../db/database';

const router = Router();

// GET /api/notifications — unread notifications for current user
router.get('/', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).user?.id ?? null;
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
// Only marks user-owned rows; broadcast rows (user_id IS NULL) require a
// per-user read-tracking table before they can be safely dismissed per-user.
router.patch('/read-all', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  await rawRun(db, 'UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
  res.status(204).end();
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const db = getKnex();
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid notification id' });
  // Scope to caller's own rows only — broadcast rows (user_id IS NULL) cannot
  // be marked read per-user without a join table; skip them silently.
  await rawRun(db, 'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
  res.status(204).end();
});

export default router;
