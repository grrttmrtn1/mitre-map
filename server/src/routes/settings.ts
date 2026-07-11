import { Router } from 'express';
import { getKnex, rawGet, rawRun } from '../db/database';
import { decryptSecretValue, encryptSecretValue } from '../security';

const router = Router();

// Keys that store sensitive values — GET returns only whether they're configured
const SENSITIVE = new Set(['github_token']);

router.get('/:key', async (req, res) => {
  const { key } = req.params;
  const db = getKnex();
  const row = await rawGet<{ value: string | null }>(db, 'SELECT value FROM settings WHERE key=?', [key]);
  if (SENSITIVE.has(key)) {
    res.json({ key, configured: !!(row?.value) });
  } else {
    res.json({ key, value: row?.value ?? null });
  }
});

router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  const db = getKnex();
  const storedValue = SENSITIVE.has(key) ? encryptSecretValue(value) : value ?? null;
  await rawRun(db,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
    [key, storedValue]
  );
  res.json({ key, configured: !!(value) });
});

export async function getSettingValue(key: string): Promise<string | null> {
  const db = getKnex();
  const row = await rawGet<{ value: string | null }>(db, 'SELECT value FROM settings WHERE key=?', [key]);
  if (!row?.value) return null;
  return SENSITIVE.has(key) ? decryptSecretValue(row.value) : row.value;
}

router.delete('/:key', async (req, res) => {
  const { key } = req.params;
  const db = getKnex();
  await rawRun(db, 'DELETE FROM settings WHERE key=?', [key]);
  res.json({ key, configured: false });
});

export default router;
