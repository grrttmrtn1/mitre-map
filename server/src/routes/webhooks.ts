import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';
import { fireTestWebhook } from '../webhooks/service';

const router = Router();

const ALERT_TYPES = ['coverage_threshold', 'detection_validation_failed', 'new_uncovered_group_technique'];

// ── Webhook Configs ─────────────────────────────────────────────────────────

router.get('/configs', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, 'SELECT * FROM webhook_configs ORDER BY created_at DESC');
  res.json(rows);
});

router.post('/configs', async (req, res) => {
  const db = getKnex();
  const { name, url, secret, custom_headers, enabled = true } = req.body;
  if (!name?.trim() || !url?.trim()) return res.status(400).json({ error: 'name and url are required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'url must be a valid URL' }); }
  if (custom_headers != null) {
    try { JSON.parse(custom_headers); } catch { return res.status(400).json({ error: 'custom_headers must be valid JSON' }); }
  }
  const id = await rawInsert(db,
    'INSERT INTO webhook_configs (name, url, secret, custom_headers, enabled) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [name.trim(), url.trim(), secret ?? null, custom_headers ?? null, enabled ? 1 : 0]);
  res.status(201).json(await rawGet(db, 'SELECT * FROM webhook_configs WHERE id=?', [id]));
});

router.put('/configs/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM webhook_configs WHERE id=?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { name, url, secret, custom_headers, enabled } = req.body;
  if (url != null) {
    try { new URL(url); } catch { return res.status(400).json({ error: 'url must be a valid URL' }); }
  }
  if (custom_headers != null) {
    try { JSON.parse(custom_headers); } catch { return res.status(400).json({ error: 'custom_headers must be valid JSON' }); }
  }
  await rawRun(db, `UPDATE webhook_configs SET
    name=COALESCE(?,name), url=COALESCE(?,url), secret=COALESCE(?,secret),
    custom_headers=COALESCE(?,custom_headers), enabled=COALESCE(?,enabled),
    updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [name ?? null, url ?? null, secret ?? null, custom_headers ?? null,
      enabled != null ? (enabled ? 1 : 0) : null, req.params.id]);
  res.json(await rawGet(db, 'SELECT * FROM webhook_configs WHERE id=?', [req.params.id]));
});

router.delete('/configs/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM webhook_configs WHERE id=?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  await rawRun(db, 'DELETE FROM webhook_configs WHERE id=?', [req.params.id]);
  res.status(204).end();
});

router.post('/configs/:id/test', async (req, res) => {
  const db = getKnex();
  const config = await rawGet<any>(db, 'SELECT * FROM webhook_configs WHERE id=?', [req.params.id]);
  if (!config) return res.status(404).json({ error: 'Not found' });
  const result = await fireTestWebhook(config.url, config.secret, config.custom_headers);
  res.json(result);
});

// ── Alert Rules ─────────────────────────────────────────────────────────────

router.get('/rules', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, `
    SELECT r.*, w.name as webhook_name, w.url as webhook_url
    FROM alert_rules r JOIN webhook_configs w ON r.webhook_config_id = w.id
    ORDER BY r.created_at DESC
  `);
  res.json(rows);
});

router.post('/rules', async (req, res) => {
  const db = getKnex();
  const { name, type, threshold, webhook_config_id, enabled = true } = req.body;
  if (!name?.trim() || !type || !webhook_config_id) {
    return res.status(400).json({ error: 'name, type, and webhook_config_id are required' });
  }
  if (!ALERT_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${ALERT_TYPES.join(', ')}` });
  if (type === 'coverage_threshold' && (threshold == null || isNaN(Number(threshold)))) {
    return res.status(400).json({ error: 'threshold is required for coverage_threshold rules' });
  }
  if (!await rawGet(db, 'SELECT id FROM webhook_configs WHERE id=?', [webhook_config_id])) {
    return res.status(404).json({ error: 'webhook_config not found' });
  }
  const id = await rawInsert(db,
    'INSERT INTO alert_rules (name, type, threshold, webhook_config_id, enabled) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [name.trim(), type, type === 'coverage_threshold' ? Number(threshold) : null, webhook_config_id, enabled ? 1 : 0]);
  res.status(201).json(await rawGet(db, `
    SELECT r.*, w.name as webhook_name, w.url as webhook_url
    FROM alert_rules r JOIN webhook_configs w ON r.webhook_config_id = w.id WHERE r.id=?`, [id]));
});

router.put('/rules/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM alert_rules WHERE id=?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { name, type, threshold, webhook_config_id, enabled } = req.body;
  if (type != null && !ALERT_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${ALERT_TYPES.join(', ')}` });
  }
  if (webhook_config_id != null && !await rawGet(db, 'SELECT id FROM webhook_configs WHERE id=?', [webhook_config_id])) {
    return res.status(404).json({ error: 'webhook_config not found' });
  }
  await rawRun(db, `UPDATE alert_rules SET
    name=COALESCE(?,name), type=COALESCE(?,type), threshold=COALESCE(?,threshold),
    webhook_config_id=COALESCE(?,webhook_config_id), enabled=COALESCE(?,enabled),
    updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [name ?? null, type ?? null, threshold != null ? Number(threshold) : null,
      webhook_config_id ?? null, enabled != null ? (enabled ? 1 : 0) : null, req.params.id]);
  res.json(await rawGet(db, `
    SELECT r.*, w.name as webhook_name, w.url as webhook_url
    FROM alert_rules r JOIN webhook_configs w ON r.webhook_config_id = w.id WHERE r.id=?`, [req.params.id]));
});

router.delete('/rules/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM alert_rules WHERE id=?', [req.params.id])) {
    return res.status(404).json({ error: 'Not found' });
  }
  await rawRun(db, 'DELETE FROM alert_rules WHERE id=?', [req.params.id]);
  res.status(204).end();
});

export default router;
