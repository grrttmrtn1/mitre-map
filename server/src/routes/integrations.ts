import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawInsert, rawRun, logAudit } from '../db/database';
import { encryptJson, decryptJson } from '../integrations/crypto';
import { createSentinelConnector } from '../integrations/siem/sentinel';
import { createSplunkConnector } from '../integrations/siem/splunk';
import { createElasticConnector } from '../integrations/siem/elastic';
import { createCrowdStrikeConnector } from '../integrations/siem/crowdstrike';
import { createQRadarConnector } from '../integrations/siem/qradar';
import { createChronicleConnector } from '../integrations/siem/chronicle';
import { runGithubSync } from '../integrations/github-sync';
import { createJiraTicket, createServiceNowTicket, type TicketInput } from '../integrations/ticketing';
import type { SiemConnector } from '../integrations/siem/types';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function safe<T>(row: T & { credentials_enc?: string | null; token_enc?: string | null }): Omit<T, 'credentials_enc' | 'token_enc'> {
  const { credentials_enc: _c, token_enc: _t, ...rest } = row as any;
  return rest;
}

function buildSiemConnector(type: string, config: Record<string, any>, creds: Record<string, any>): SiemConnector {
  const merged = { ...config, ...creds };
  switch (type) {
    case 'sentinel':   return createSentinelConnector(merged as any);
    case 'splunk':     return createSplunkConnector(merged as any);
    case 'elastic':    return createElasticConnector(merged as any);
    case 'crowdstrike':return createCrowdStrikeConnector(merged as any);
    case 'qradar':     return createQRadarConnector(merged as any);
    case 'chronicle':  return createChronicleConnector(merged as any);
    default: throw new Error(`Unknown SIEM type: ${type}`);
  }
}

// ── SIEM Integrations ─────────────────────────────────────────────────────────

router.get('/siem', async (_req, res) => {
  try {
    const db = getKnex();
    const rows = await rawAll<any>(db, 'SELECT * FROM siem_integrations ORDER BY created_at DESC', []);
    res.json(rows.map(safe));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/siem', async (req, res) => {
  try {
    const db = getKnex();
    const { name, type, config = {}, credentials = {}, enabled = 1 } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    const validTypes = ['sentinel', 'splunk', 'elastic', 'crowdstrike', 'qradar', 'chronicle'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    const credentials_enc = Object.keys(credentials).length ? encryptJson(credentials) : null;
    const id = await rawInsert(db, `INSERT INTO siem_integrations (name, type, config, credentials_enc, enabled) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [name, type, JSON.stringify(config), credentials_enc, enabled ? 1 : 0]);
    const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    res.status(201).json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/siem/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/siem/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, config, credentials, enabled } = req.body;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (config !== undefined) updates.config = JSON.stringify(config);
    if (credentials !== undefined) updates.credentials_enc = Object.keys(credentials).length ? encryptJson(credentials) : null;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await rawRun(db, `UPDATE siem_integrations SET ${sets} WHERE id = ?`, [...Object.values(updates), id]);
    const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    res.json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/siem/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await rawRun(db, 'DELETE FROM siem_integrations WHERE id = ?', [id]);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/siem/:id/test', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const config = JSON.parse(row.config ?? '{}');
    const creds = row.credentials_enc ? decryptJson(row.credentials_enc) : {};
    const connector = buildSiemConnector(row.type, config, creds);
    const result = await connector.testConnection();
    const status = result.ok ? 'ok' : 'error';
    await rawRun(db, 'UPDATE siem_integrations SET last_push_status = ?, last_push_error = ?, updated_at = ? WHERE id = ?',
      [status, result.ok ? null : result.message, new Date().toISOString(), id]);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/siem/:id/push', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    // Accepts { detection_id, sigma_yaml } or { detections: [{ id, name, sigma_yaml }] }
    const { detection_id, sigma_yaml, detections: detectionList } = req.body;
    const config = JSON.parse(row.config ?? '{}');
    const creds = row.credentials_enc ? decryptJson(row.credentials_enc) : {};
    const connector = buildSiemConnector(row.type, config, creds);
    let items: Array<{ id: number; name: string; sigmaYaml: string }> = [];
    if (detectionList && Array.isArray(detectionList)) {
      items = detectionList.filter((d: any) => d.id && d.name && d.sigma_yaml)
        .map((d: any) => ({ id: d.id, name: d.name, sigmaYaml: d.sigma_yaml }));
    } else if (detection_id && sigma_yaml) {
      const det = await rawGet<any>(db, 'SELECT id, name FROM detections WHERE id = ?', [detection_id]);
      if (!det) return res.status(404).json({ error: 'Detection not found' });
      items = [{ id: det.id, name: det.name, sigmaYaml: sigma_yaml }];
    }
    if (items.length === 0) return res.status(400).json({ error: 'No detections with sigma_yaml provided' });
    const results = await Promise.all(items.map(d => connector.pushRule(d)));
    const ok = results.filter(r => r.ok).length;
    await rawRun(db, 'UPDATE siem_integrations SET last_push_status = ?, last_push_error = ?, last_pushed_at = ?, updated_at = ? WHERE id = ?',
      [ok === items.length ? 'ok' : 'partial', null, new Date().toISOString(), new Date().toISOString(), id]);
    await rawRun(db, 'INSERT INTO siem_sync_log (integration_id, direction, status, items_affected, detail) VALUES (?, ?, ?, ?, ?)',
      [id, 'push', ok === items.length ? 'ok' : 'partial', ok, JSON.stringify(results)]);
    res.json({ pushed: ok, total: items.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/siem/:id/pull', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const config = JSON.parse(row.config ?? '{}');
    const creds = row.credentials_enc ? decryptJson(row.credentials_enc) : {};
    const connector = buildSiemConnector(row.type, config, creds);
    const statuses = await connector.pullStatuses();
    await rawRun(db, 'UPDATE siem_integrations SET last_pull_status = ?, last_pull_error = ?, last_pulled_at = ?, updated_at = ? WHERE id = ?',
      ['ok', null, new Date().toISOString(), new Date().toISOString(), id]);
    await rawRun(db, 'INSERT INTO siem_sync_log (integration_id, direction, status, items_affected) VALUES (?, ?, ?, ?)',
      [id, 'pull', 'ok', statuses.length]);
    res.json({ count: statuses.length, statuses });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/siem/:id/log', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const rows = await rawAll<any>(db, 'SELECT * FROM siem_sync_log WHERE integration_id = ? ORDER BY created_at DESC LIMIT 50', [id]);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GitHub Sync Configs ───────────────────────────────────────────────────────

router.get('/github-sync', async (_req, res) => {
  try {
    const db = getKnex();
    const rows = await rawAll<any>(db, 'SELECT * FROM github_sync_configs ORDER BY created_at DESC', []);
    res.json(rows.map(safe));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/github-sync', async (req, res) => {
  try {
    const db = getKnex();
    const { name, repo_url, branch = 'main', path_glob = '**/*.yml', token, enabled = 1 } = req.body;
    if (!name || !repo_url) return res.status(400).json({ error: 'name and repo_url required' });
    const token_enc = token ? encryptJson({ token }) : null;
    const id = await rawInsert(db, `INSERT INTO github_sync_configs (name, repo_url, branch, path_glob, token_enc, enabled) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [name, repo_url, branch, path_glob, token_enc, enabled ? 1 : 0]);
    const row = await rawGet<any>(db, 'SELECT * FROM github_sync_configs WHERE id = ?', [id]);
    res.status(201).json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/github-sync/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM github_sync_configs WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/github-sync/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await rawGet<any>(db, 'SELECT id FROM github_sync_configs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, repo_url, branch, path_glob, token, enabled } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (repo_url !== undefined) updates.repo_url = repo_url;
    if (branch !== undefined) updates.branch = branch;
    if (path_glob !== undefined) updates.path_glob = path_glob;
    if (token !== undefined) updates.token_enc = token ? encryptJson({ token }) : null;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await rawRun(db, `UPDATE github_sync_configs SET ${sets} WHERE id = ?`, [...Object.values(updates), id]);
    const row = await rawGet<any>(db, 'SELECT * FROM github_sync_configs WHERE id = ?', [id]);
    res.json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/github-sync/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await rawRun(db, 'DELETE FROM github_sync_configs WHERE id = ?', [id]);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/github-sync/:id/run', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await runGithubSync(id);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Ticketing Configs ─────────────────────────────────────────────────────────

router.get('/ticketing', async (_req, res) => {
  try {
    const db = getKnex();
    const rows = await rawAll<any>(db, 'SELECT * FROM ticketing_configs ORDER BY created_at DESC', []);
    res.json(rows.map(safe));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/ticketing', async (req, res) => {
  try {
    const db = getKnex();
    const { name, type, base_url, credentials = {}, default_project, enabled = 1 } = req.body;
    if (!name || !type || !base_url) return res.status(400).json({ error: 'name, type, and base_url required' });
    if (!['jira', 'servicenow'].includes(type)) return res.status(400).json({ error: 'type must be jira or servicenow' });
    const credentials_enc = Object.keys(credentials).length ? encryptJson(credentials) : null;
    const id = await rawInsert(db, `INSERT INTO ticketing_configs (name, type, base_url, credentials_enc, default_project, enabled) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [name, type, base_url, credentials_enc, default_project ?? null, enabled ? 1 : 0]);
    const row = await rawGet<any>(db, 'SELECT * FROM ticketing_configs WHERE id = ?', [id]);
    res.status(201).json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/ticketing/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM ticketing_configs WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/ticketing/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await rawGet<any>(db, 'SELECT id FROM ticketing_configs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, base_url, credentials, default_project, enabled } = req.body;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (base_url !== undefined) updates.base_url = base_url;
    if (credentials !== undefined) updates.credentials_enc = Object.keys(credentials).length ? encryptJson(credentials) : null;
    if (default_project !== undefined) updates.default_project = default_project;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await rawRun(db, `UPDATE ticketing_configs SET ${sets} WHERE id = ?`, [...Object.values(updates), id]);
    const row = await rawGet<any>(db, 'SELECT * FROM ticketing_configs WHERE id = ?', [id]);
    res.json(safe(row));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/ticketing/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await rawRun(db, 'DELETE FROM ticketing_configs WHERE id = ?', [id]);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/ticketing/:id/create-ticket', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const row = await rawGet<any>(db, 'SELECT * FROM ticketing_configs WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const { summary, description, priority } = req.body;
    if (!summary || !description) return res.status(400).json({ error: 'summary and description required' });
    const creds = row.credentials_enc ? decryptJson(row.credentials_enc) : {};
    const input: TicketInput = { summary, description, priority };
    let result;
    if (row.type === 'jira') {
      result = await createJiraTicket({ base_url: row.base_url, project_key: row.default_project, ...creds } as any, input);
    } else if (row.type === 'servicenow') {
      result = await createServiceNowTicket({ base_url: row.base_url, ...creds } as any, input);
    } else {
      return res.status(400).json({ error: `Unknown ticketing type: ${row.type}` });
    }
    await logAudit(db, 'ticketing', String(id), 'create_ticket', (req as any).actor ?? 'user', { ticket_id: result.ticket_id });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
