import cron, { ScheduledTask } from 'node-cron';
import { getKnex, rawAll, rawRun } from '../db/database';
import { runFetch } from './ingest';
import { takeSnapshot } from '../routes/snapshots';

const activeTasks = new Map<number, ScheduledTask>();

export async function initScheduler(): Promise<void> {
  const db = getKnex();
  const jobs = await rawAll<any>(db, 'SELECT * FROM taxii_ingest_jobs WHERE enabled=1', []);
  for (const job of jobs) {
    scheduleJob(job);
  }
  console.log(`[taxii] Scheduled ${jobs.length} ingest job(s)`);

  // Nightly coverage snapshot at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[snapshot] Taking nightly auto-snapshot');
    try {
      const snap = await takeSnapshot('Auto-snapshot (nightly)', 'system');
      console.log(`[snapshot] Done — ${snap.coverage_pct}% coverage, ${snap.covered_techniques}/${snap.total_techniques} techniques`);
    } catch (err: any) {
      console.error('[snapshot] Auto-snapshot failed:', err?.message ?? err);
    }
  });
  console.log('[snapshot] Nightly auto-snapshot scheduled (02:00)');
}

export function scheduleJob(job: { id: number; server_id: number; schedule: string; name: string }): void {
  stopJob(job.id);

  if (!cron.validate(job.schedule)) {
    console.warn(`[taxii] Invalid cron expression for job ${job.id}: ${job.schedule}`);
    return;
  }

  const task = cron.schedule(job.schedule, () => runJob(job.id, job.server_id, job.name));
  activeTasks.set(job.id, task);
}

export function stopJob(jobId: number): void {
  const existing = activeTasks.get(jobId);
  if (existing) {
    existing.stop();
    activeTasks.delete(jobId);
  }
}

export async function runJob(jobId: number, serverId: number, name: string): Promise<void> {
  const db = getKnex();
  console.log(`[taxii] Running job ${jobId} (${name})`);
  await rawRun(db, `UPDATE taxii_ingest_jobs SET last_status='running', last_run=CURRENT_TIMESTAMP WHERE id=?`, [jobId]);

  try {
    const result = await runFetch(serverId, jobId);
    await rawRun(db,
      `UPDATE taxii_ingest_jobs SET last_status='success', last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [jobId],
    );
    console.log(`[taxii] Job ${jobId} completed — batch ${result.batch_id}, ${result.items_created} items staged`);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    await rawRun(db,
      `UPDATE taxii_ingest_jobs SET last_status='error', last_error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [msg.slice(0, 500), jobId],
    );
    console.error(`[taxii] Job ${jobId} failed:`, msg);
  }
}
