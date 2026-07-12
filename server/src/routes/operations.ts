import { Router } from 'express';
import { getKnex, rawAll } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  const [reports, taxii, siem, attack] = await Promise.all([
    rawAll<any>(db, 'SELECT id,name,schedule,enabled,last_run_at,last_run_status,last_run_error FROM report_schedules'),
    rawAll<any>(db, `SELECT j.id,j.name,j.schedule,j.enabled,j.last_run,j.last_status,j.last_error,s.name AS source_name
      FROM taxii_ingest_jobs j JOIN taxii_servers s ON s.id=j.server_id`),
    rawAll<any>(db, `SELECT l.id,i.name,l.direction,l.status,l.items_affected,l.detail,l.created_at
      FROM siem_sync_log l JOIN siem_integrations i ON i.id=l.integration_id ORDER BY l.created_at DESC LIMIT 100`),
    rawAll<any>(db, 'SELECT id,batch_id,from_version,to_version,status,added_count,removed_count,renamed_count,created_at,reviewed_at FROM attack_update_batches ORDER BY created_at DESC LIMIT 50'),
  ]);
  const operations = [
    ...reports.map(r => ({ id: `report:${r.id}`, kind: 'report', name: r.name, schedule: r.schedule, enabled: Boolean(r.enabled), status: r.last_run_status ?? 'pending', last_run_at: r.last_run_at, error: r.last_run_error, retry_path: null })),
    ...taxii.map(j => ({ id: `taxii:${j.id}`, kind: 'taxii', name: j.name, source: j.source_name, schedule: j.schedule, enabled: Boolean(j.enabled), status: j.last_status ?? 'pending', last_run_at: j.last_run, error: j.last_error, retry_path: `/api/taxii/jobs/${j.id}/run` })),
    ...siem.map(l => ({ id: `siem:${l.id}`, kind: 'siem', name: `${l.name} ${l.direction}`, status: l.status, last_run_at: l.created_at, items_processed: l.items_affected, detail: l.detail, error: l.status === 'error' ? l.detail : null, retry_path: null })),
    ...attack.map(b => ({ id: `attack:${b.id}`, kind: 'attack_update', name: `ATT&CK ${b.from_version} → ${b.to_version}`, status: b.status, last_run_at: b.reviewed_at ?? b.created_at, items_processed: b.added_count + b.removed_count + b.renamed_count, detail: { batch_id: b.batch_id, added: b.added_count, removed: b.removed_count, renamed: b.renamed_count }, retry_path: null })),
  ].sort((a, b) => String(b.last_run_at ?? '').localeCompare(String(a.last_run_at ?? '')));
  const summary = {
    total: operations.length,
    running: operations.filter(o => o.status === 'running').length,
    failed: operations.filter(o => ['error', 'failed'].includes(o.status)).length,
    needs_review: operations.filter(o => o.status === 'pending' && o.kind === 'attack_update').length,
  };
  res.json({ summary, operations });
});

export default router;
