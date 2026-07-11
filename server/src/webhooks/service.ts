import { Knex } from 'knex';
import crypto from 'crypto';
import { rawAll, rawGet, rawRun, buildTechniqueGraph, resolveToParent } from '../db/database';
import { decryptSecretValue } from '../security';
import { safeHttpsRequest, validateBaseUrl } from '../integrations/url-validator';

export type AlertEventType =
  | 'coverage.threshold_breached'
  | 'detection.validation_failed'
  | 'threat_group.new_uncovered_technique'
  | 'webhook.test';

export interface WebhookPayload {
  event: AlertEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

async function sendWebhook(
  url: string,
  secret: string | null,
  customHeaders: string | null,
  payload: WebhookPayload,
): Promise<void> {
  await validateBaseUrl(url);
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'MitreMap-Webhook/1.0',
  };
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-MitreMap-Signature'] = `sha256=${sig}`;
  }
  if (customHeaders) {
    try {
      const extra = JSON.parse(customHeaders) as Record<string, string>;
      Object.assign(headers, extra);
    } catch { /* ignore malformed headers */ }
  }
  await safeHttpsRequest(url, { method: 'POST', headers, body, timeoutMs: 10_000 });
}

async function getCoveragePct(db: Knex): Promise<number> {
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);
  const totalTechniques = parentTechIds.size;
  if (totalTechniques === 0) return 0;

  const coveredIds = new Set<string>();

  const detections = await rawAll<{ technique_ids: string }>(
    db, "SELECT technique_ids FROM detections WHERE status='active'",
  );
  for (const d of detections) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) coveredIds.add(p);
    }
  }

  const mitigated = await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `);
  for (const r of mitigated) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent);
    if (p) coveredIds.add(p);
  }

  return Math.round((coveredIds.size / totalTechniques) * 100);
}

export async function checkCoverageAlerts(db: Knex): Promise<void> {
  const rules = await rawAll<any>(db, `
    SELECT r.*, w.url, w.secret, w.custom_headers
    FROM alert_rules r JOIN webhook_configs w ON r.webhook_config_id = w.id
    WHERE r.type='coverage_threshold' AND r.enabled=1 AND w.enabled=1
  `);
  if (rules.length === 0) return;

  const coveragePct = await getCoveragePct(db);

  for (const rule of rules) {
    if (coveragePct < rule.threshold) {
      sendWebhook(rule.url, decryptSecretValue(rule.secret), decryptSecretValue(rule.custom_headers), {
        event: 'coverage.threshold_breached',
        timestamp: new Date().toISOString(),
        data: { coverage_pct: coveragePct, threshold: rule.threshold },
      }).catch(() => {});
      await rawRun(db, 'UPDATE alert_rules SET last_notified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?', [rule.id]);
    }
  }
}

export async function checkValidationFailedAlerts(
  db: Knex,
  detectionId: number,
  detectionName: string,
  testName: string,
): Promise<void> {
  const rules = await rawAll<any>(db, `
    SELECT r.*, w.url, w.secret, w.custom_headers
    FROM alert_rules r JOIN webhook_configs w ON r.webhook_config_id = w.id
    WHERE r.type='detection_validation_failed' AND r.enabled=1 AND w.enabled=1
  `);
  for (const rule of rules) {
    sendWebhook(rule.url, decryptSecretValue(rule.secret), decryptSecretValue(rule.custom_headers), {
      event: 'detection.validation_failed',
      timestamp: new Date().toISOString(),
      data: { detection_id: detectionId, detection_name: detectionName, test_name: testName },
    }).catch(() => {});
    await rawRun(db, 'UPDATE alert_rules SET last_notified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?', [rule.id]);
  }
}

export async function checkUncoveredGroupTechniqueAlerts(db: Knex): Promise<void> {
  const rules = await rawAll<any>(db, `
    SELECT r.*, w.url, w.secret, w.custom_headers
    FROM alert_rules r JOIN webhook_configs w ON r.webhook_config_id = w.id
    WHERE r.type='new_uncovered_group_technique' AND r.enabled=1 AND w.enabled=1
  `);
  if (rules.length === 0) return;

  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);
  const detections = await rawAll<{ technique_ids: string }>(
    db, "SELECT technique_ids FROM detections WHERE status='active'",
  );
  const coveredIds = new Set<string>();
  for (const d of detections) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) coveredIds.add(p);
    }
  }

  for (const rule of rules) {
    const since = rule.last_notified_at ?? '1970-01-01';
    const newTechs = await rawAll<any>(db, `
      SELECT gt.technique_id, gt.group_id, tg.name as group_name,
             at.name as technique_name
      FROM group_techniques gt
      JOIN threat_groups tg ON gt.group_id = tg.id
      JOIN attack_techniques at ON gt.technique_id = at.id
      WHERE gt.created_at > ?
    `, [since]);

    const uncovered = newTechs.filter((t: any) => {
      const parent = resolveToParent(t.technique_id, parentTechIds, subtechToParent) ?? t.technique_id;
      return !coveredIds.has(parent);
    });

    for (const t of uncovered) {
      sendWebhook(rule.url, decryptSecretValue(rule.secret), decryptSecretValue(rule.custom_headers), {
        event: 'threat_group.new_uncovered_technique',
        timestamp: new Date().toISOString(),
        data: {
          group_id: t.group_id,
          group_name: t.group_name,
          technique_id: t.technique_id,
          technique_name: t.technique_name,
        },
      }).catch(() => {});
    }
    await rawRun(db, 'UPDATE alert_rules SET last_notified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?', [rule.id]);
  }
}

export async function fireTestWebhook(url: string, secret: string | null, customHeaders: string | null): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    await validateBaseUrl(url);
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
  const body = JSON.stringify({ event: 'webhook.test', timestamp: new Date().toISOString(), data: { message: 'MitreMap webhook test' } });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'MitreMap-Webhook/1.0',
  };
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-MitreMap-Signature'] = `sha256=${sig}`;
  }
  if (customHeaders) {
    try { Object.assign(headers, JSON.parse(customHeaders)); } catch { /* ignore */ }
  }
  try {
    const res = await safeHttpsRequest(url, { method: 'POST', headers, body, timeoutMs: 10_000 });
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Request failed' };
  }
}
