import { Router } from 'express';
import cron from 'node-cron';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit, createNotificationsForAllAnalysts } from '../db/database';
import { TaxiiClient } from '../taxii/client';
import { runFetch, applyPendingItem, rejectPendingItem } from '../taxii/ingest';
import { scheduleJob, stopJob, runJob } from '../taxii/scheduler';
import { decryptSecretValue, encryptSecretValue } from '../security';
import { validateBaseUrl } from '../integrations/url-validator';

const router = Router();

// ── Servers ──────────────────────────────────────────────────────────────────

router.get('/servers', async (_req, res) => {
  const db = getKnex();
  const servers = await rawAll(db, 'SELECT id, name, url, api_root, collection_id, auth_type, ssl_verify, auto_merge, notes, last_fetch_status, last_fetch_error, last_fetch_items, last_fetch_skipped, last_fetch_at, created_at, updated_at FROM taxii_servers ORDER BY name', []);
  res.json(servers);
});

router.post('/servers', async (req, res) => {
  const db = getKnex();
  const { name, url, api_root, collection_id, auth_type = 'none', username, password, token, ssl_verify = 1, auto_merge = 0, notes } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  try { await validateBaseUrl(url); } catch (e: any) { return res.status(400).json({ error: e.message }); }

  const id = await rawInsert(db,
    `INSERT INTO taxii_servers (name, url, api_root, collection_id, auth_type, username, password, token, ssl_verify, auto_merge, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [name, url, api_root ?? null, collection_id ?? null, auth_type, username ?? null, encryptSecretValue(password), encryptSecretValue(token), ssl_verify ? 1 : 0, auto_merge ? 1 : 0, notes ?? null],
  );
  await logAudit(db, 'taxii_server', String(id), 'create', (req as any).actor ?? 'user', { name, url }, (req as any).sourceIp);
  const server = await rawGet(db, 'SELECT id, name, url, api_root, collection_id, auth_type, ssl_verify, auto_merge, notes, created_at FROM taxii_servers WHERE id=?', [id]);
  res.status(201).json(server);
});

router.put('/servers/:id', async (req, res) => {
  const db = getKnex();
  const server = await rawGet(db, 'SELECT id FROM taxii_servers WHERE id=?', [req.params.id]);
  if (!server) return res.status(404).json({ error: 'Not found' });

  const { name, url, api_root, collection_id, auth_type, username, password, token, ssl_verify, auto_merge, notes } = req.body;
  if (url !== undefined) {
    try { await validateBaseUrl(url); } catch (e: any) { return res.status(400).json({ error: e.message }); }
  }
  const encryptedPassword = password !== undefined ? encryptSecretValue(password) : null;
  const encryptedToken = token !== undefined ? encryptSecretValue(token) : null;
  await rawRun(db,
    `UPDATE taxii_servers SET
      name=COALESCE(?,name), url=COALESCE(?,url), api_root=?, collection_id=?,
      auth_type=COALESCE(?,auth_type), username=COALESCE(?,username),
      password=CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
      token=CASE WHEN ? IS NOT NULL THEN ? ELSE token END,
      ssl_verify=COALESCE(?,ssl_verify), auto_merge=COALESCE(?,auto_merge), notes=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [name ?? null, url ?? null, api_root ?? null, collection_id ?? null,
     auth_type ?? null, username ?? null,
     encryptedPassword, encryptedPassword,
     encryptedToken, encryptedToken,
     ssl_verify !== undefined ? (ssl_verify ? 1 : 0) : null,
     auto_merge !== undefined ? (auto_merge ? 1 : 0) : null,
     notes ?? null, req.params.id],
  );
  await logAudit(db, 'taxii_server', req.params.id, 'update', (req as any).actor ?? 'user',
    { name, url, api_root, collection_id, auth_type, username, ssl_verify, auto_merge, notes, password_changed: password !== undefined, token_changed: token !== undefined },
    (req as any).sourceIp);
  const updated = await rawGet(db, 'SELECT id, name, url, api_root, collection_id, auth_type, ssl_verify, auto_merge, notes, updated_at FROM taxii_servers WHERE id=?', [req.params.id]);
  res.json(updated);
});

router.delete('/servers/:id', async (req, res) => {
  const db = getKnex();
  const server = await rawGet<any>(db, 'SELECT id FROM taxii_servers WHERE id=?', [req.params.id]);
  if (!server) return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM taxii_servers WHERE id=?', [req.params.id]);
  await logAudit(db, 'taxii_server', req.params.id, 'delete', (req as any).actor ?? 'user', {}, (req as any).sourceIp);
  res.status(204).send();
});

// Test connection — list available collections
router.post('/servers/:id/test', async (req, res) => {
  const db = getKnex();
  const server = await rawGet<any>(db, 'SELECT * FROM taxii_servers WHERE id=?', [req.params.id]);
  if (!server) return res.status(404).json({ error: 'Not found' });
  try { await validateBaseUrl(server.url); } catch (e: any) { return res.status(400).json({ error: e.message }); }

  const client = new TaxiiClient({
    url: server.url, api_root: server.api_root, collection_id: server.collection_id,
    auth_type: server.auth_type, username: server.username, password: decryptSecretValue(server.password),
    token: decryptSecretValue(server.token), ssl_verify: server.ssl_verify === 1,
  });

  try {
    const collections = await client.listCollections();
    res.json({ ok: true, collections });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

// Trigger manual fetch — runs in background, returns immediately
router.post('/servers/:id/fetch', async (req, res) => {
  const db = getKnex();
  const server = await rawGet<any>(db, 'SELECT id, name FROM taxii_servers WHERE id=?', [req.params.id]);
  if (!server) return res.status(404).json({ error: 'Not found' });

  const actor = (req as any).actor ?? 'user';
  const sourceIp = (req as any).sourceIp;
  const serverId = Number(req.params.id);

  await rawRun(db,
    `UPDATE taxii_servers SET last_fetch_status='running', last_fetch_error=NULL, last_fetch_at=CURRENT_TIMESTAMP WHERE id=?`,
    [serverId],
  );

  runFetch(serverId, null)
    .then(async result => {
      console.log(`[taxii] Ad-hoc fetch server ${serverId}: ${result.items_created} staged, ${result.skipped} skipped`);
      await rawRun(db,
        `UPDATE taxii_servers SET last_fetch_status='success', last_fetch_items=?, last_fetch_skipped=?, last_fetch_error=NULL WHERE id=?`,
        [result.items_created, result.skipped, serverId],
      );
      await logAudit(db, 'taxii_server', req.params.id, 'fetch', actor, result as unknown as Record<string, unknown>, sourceIp);
      const pendingCount = result.items_created;
      await createNotificationsForAllAnalysts(db, {
        type: 'taxii_batch_ready',
        title: 'TAXII batch ready for review',
        message: `${pendingCount} item(s) staged from ${server.name}`,
        entity_type: 'taxii_batch',
        entity_id: String(serverId),
      }).catch(() => {}); // non-blocking
    })
    .catch(async err => {
      console.error('[taxii] Ad-hoc fetch failed (server', serverId, '):', err.message);
      await rawRun(db,
        `UPDATE taxii_servers SET last_fetch_status='error', last_fetch_error=? WHERE id=?`,
        [err.message, serverId],
      );
    });

  res.json({ ok: true, message: 'Fetch started — staged items will appear in the Preview tab shortly' });
});

// ── Batches & Pending items ───────────────────────────────────────────────────

router.get('/batches', async (_req, res) => {
  const db = getKnex();
  const batches = await rawAll(db, `
    SELECT p.batch_id, p.server_id, s.name as server_name,
      MIN(p.created_at) as created_at,
      COUNT(*) as total,
      SUM(CASE WHEN p.status='pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN p.status='approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN p.status='rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM taxii_pending_ingests p
    JOIN taxii_servers s ON s.id=p.server_id
    GROUP BY p.batch_id, p.server_id, s.name
    ORDER BY created_at DESC
  `, []);
  res.json(batches);
});

router.get('/batches/:batch_id/items', async (req, res) => {
  const db = getKnex();
  const items = await rawAll(db,
    'SELECT * FROM taxii_pending_ingests WHERE batch_id=? ORDER BY proposed_action, name',
    [req.params.batch_id],
  );
  res.json(items.map((i: any) => ({ ...i, proposed_data: JSON.parse(i.proposed_data) })));
});

router.post('/batches/:batch_id/approve', async (req, res) => {
  const db = getKnex();
  const items = await rawAll<any>(db,
    `SELECT id FROM taxii_pending_ingests WHERE batch_id=? AND status='pending'`,
    [req.params.batch_id],
  );
  const reviewerId = (req as any).actor_id ?? null;
  const errors: string[] = [];
  for (const item of items) {
    try { await applyPendingItem(item.id, reviewerId); }
    catch (err: any) { errors.push(`${item.id}: ${err.message}`); }
  }
  await logAudit(db, 'taxii_batch', req.params.batch_id, 'approve_all', (req as any).actor ?? 'user', { approved: items.length - errors.length, errors }, (req as any).sourceIp);
  res.json({ approved: items.length - errors.length, errors });
});

router.post('/batches/:batch_id/reject', async (req, res) => {
  const db = getKnex();
  const reviewerId = (req as any).actor_id ?? null;
  await rawRun(db,
    `UPDATE taxii_pending_ingests SET status='rejected', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE batch_id=? AND status='pending'`,
    [reviewerId, req.params.batch_id],
  );
  await logAudit(db, 'taxii_batch', req.params.batch_id, 'reject_all', (req as any).actor ?? 'user', {}, (req as any).sourceIp);
  res.json({ ok: true });
});

router.post('/pending/:id/approve', async (req, res) => {
  const reviewerId = (req as any).actor_id ?? null;
  try {
    await applyPendingItem(Number(req.params.id), reviewerId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/pending/:id/reject', async (req, res) => {
  const reviewerId = (req as any).actor_id ?? null;
  try {
    await rejectPendingItem(Number(req.params.id), reviewerId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── Scheduled jobs ────────────────────────────────────────────────────────────

router.get('/jobs', async (_req, res) => {
  const db = getKnex();
  const jobs = await rawAll(db, `
    SELECT j.*, s.name as server_name
    FROM taxii_ingest_jobs j JOIN taxii_servers s ON s.id=j.server_id
    ORDER BY j.name
  `, []);
  res.json(jobs);
});

router.post('/jobs', async (req, res) => {
  const db = getKnex();
  const { server_id, name, schedule, enabled = 1 } = req.body;
  if (!server_id || !name || !schedule) return res.status(400).json({ error: 'server_id, name, and schedule are required' });
  if (!cron.validate(schedule)) return res.status(400).json({ error: 'Invalid cron expression' });

  const server = await rawGet(db, 'SELECT id FROM taxii_servers WHERE id=?', [server_id]);
  if (!server) return res.status(400).json({ error: 'Server not found' });

  const id = await rawInsert(db,
    `INSERT INTO taxii_ingest_jobs (server_id, name, schedule, enabled) VALUES (?, ?, ?, ?) RETURNING id`,
    [server_id, name, schedule, enabled ? 1 : 0],
  );

  const job = await rawGet<any>(db, 'SELECT * FROM taxii_ingest_jobs WHERE id=?', [id]);
  if (job.enabled) scheduleJob({ id: job.id, server_id: job.server_id, schedule: job.schedule, name: job.name });

  await logAudit(db, 'taxii_job', String(id), 'create', (req as any).actor ?? 'user', { name, schedule }, (req as any).sourceIp);
  res.status(201).json(job);
});

router.put('/jobs/:id', async (req, res) => {
  const db = getKnex();
  const existing = await rawGet<any>(db, 'SELECT * FROM taxii_ingest_jobs WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, schedule, enabled } = req.body;
  if (schedule && !cron.validate(schedule)) return res.status(400).json({ error: 'Invalid cron expression' });

  await rawRun(db,
    `UPDATE taxii_ingest_jobs SET
      name=COALESCE(?,name), schedule=COALESCE(?,schedule), enabled=COALESCE(?,enabled), updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [name ?? null, schedule ?? null, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id],
  );

  const updated = await rawGet<any>(db, 'SELECT * FROM taxii_ingest_jobs WHERE id=?', [req.params.id]);
  stopJob(updated.id);
  if (updated.enabled) scheduleJob({ id: updated.id, server_id: updated.server_id, schedule: updated.schedule, name: updated.name });

  res.json(updated);
});

router.delete('/jobs/:id', async (req, res) => {
  const db = getKnex();
  const job = await rawGet(db, 'SELECT id FROM taxii_ingest_jobs WHERE id=?', [req.params.id]);
  if (!job) return res.status(404).json({ error: 'Not found' });
  stopJob(Number(req.params.id));
  await rawRun(db, 'DELETE FROM taxii_ingest_jobs WHERE id=?', [req.params.id]);
  res.status(204).send();
});

// Manually trigger a scheduled job
router.post('/jobs/:id/run', async (req, res) => {
  const db = getKnex();
  const job = await rawGet<any>(db, 'SELECT * FROM taxii_ingest_jobs WHERE id=?', [req.params.id]);
  if (!job) return res.status(404).json({ error: 'Not found' });
  // Run in background, return immediately
  runJob(job.id, job.server_id, job.name).catch(console.error);
  res.json({ ok: true, message: 'Job triggered — check batches for staged items' });
});

export default router;
