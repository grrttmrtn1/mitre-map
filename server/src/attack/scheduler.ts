import cron, { ScheduledTask } from 'node-cron';
import { getKnex, rawRun } from '../db/database';
import { getSettings, stageUpdate, stageAndAutoApply } from './updater';

let activeTask: ScheduledTask | null = null;

export async function initAttackScheduler(): Promise<void> {
  const settings = await getSettings();
  if (settings.enabled) {
    scheduleCheck(settings.schedule, settings.auto_apply === 1);
    console.log(`[attack-update] Scheduler enabled: ${settings.schedule} (auto_apply=${settings.auto_apply})`);
  } else {
    console.log('[attack-update] Scheduler disabled');
  }
}

export function scheduleCheck(cronExpr: string, autoApply: boolean): void {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }

  if (!cron.validate(cronExpr)) {
    console.warn(`[attack-update] Invalid cron expression: ${cronExpr}`);
    return;
  }

  activeTask = cron.schedule(cronExpr, () => runCheck(autoApply));
}

export function stopCheck(): void {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }
}

export async function runCheck(autoApply: boolean): Promise<void> {
  const db = getKnex();
  console.log(`[attack-update] Running scheduled check (auto_apply=${autoApply})`);
  try {
    if (autoApply) {
      await stageAndAutoApply('scheduler');
    } else {
      await stageUpdate(undefined, 'scheduler');
    }
    console.log('[attack-update] Check complete');
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('[attack-update] Check failed:', msg);
    await rawRun(db,
      `UPDATE attack_update_settings SET last_checked_at=CURRENT_TIMESTAMP, last_check_status='error', last_check_error=? WHERE id=1`,
      [msg.slice(0, 500)],
    );
  }
}
