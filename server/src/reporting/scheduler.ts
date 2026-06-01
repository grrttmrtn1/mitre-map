import cron, { type ScheduledTask } from 'node-cron';
import { getKnex, rawAll, rawRun } from '../db/database';
import { sendReportEmail, buildReportHtml } from './mailer';

const _jobs = new Map<number, ScheduledTask>();

async function runSchedule(scheduleId: number): Promise<void> {
  const db = getKnex();
  const rows = await rawAll<any>(db, 'SELECT * FROM report_schedules WHERE id = ?', [scheduleId]);
  const s = rows[0];
  if (!s || !s.enabled) return;
  const recipients: string[] = JSON.parse(s.recipients ?? '[]');
  if (recipients.length === 0) return;
  try {
    const port = process.env.PORT ?? '4000';
    const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const res = await fetch(`${proto}://localhost:${port}/api/reports/${s.report_type}`, {
      headers: { 'x-internal-report': 'true' },
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    const html = buildReportHtml(s.report_type, data);
    await sendReportEmail({ to: recipients, subject: `MitreMap Report: ${s.name} — ${new Date().toLocaleDateString()}`, htmlBody: html });
    await rawRun(db, "UPDATE report_schedules SET last_run_at=CURRENT_TIMESTAMP, last_run_status='ok', last_run_error=NULL WHERE id=?", [scheduleId]);
  } catch (e: any) {
    await rawRun(db, "UPDATE report_schedules SET last_run_at=CURRENT_TIMESTAMP, last_run_status='error', last_run_error=? WHERE id=?", [e.message, scheduleId]);
  }
}

export async function initReportScheduler(): Promise<void> {
  const db = getKnex();
  const schedules = await rawAll<{ id: number; schedule: string; enabled: number }>(db, 'SELECT id, schedule, enabled FROM report_schedules', []);
  for (const s of schedules) {
    if (s.enabled && cron.validate(s.schedule)) scheduleReport(s.id, s.schedule);
  }
}

export function scheduleReport(id: number, cronExpr: string): void {
  stopReport(id);
  if (!cron.validate(cronExpr)) return;
  const task = cron.schedule(cronExpr, () => runSchedule(id), { timezone: 'UTC' });
  _jobs.set(id, task);
}

export function stopReport(id: number): void {
  _jobs.get(id)?.stop();
  _jobs.delete(id);
}
