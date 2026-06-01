import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';
import { scheduleReport, stopReport } from '../reporting/scheduler';
import cron from 'node-cron';

const router = Router();
const VALID_TYPES = ['executive', 'trends', 'threats', 'gaps', 'compliance'];

router.get('/', async (_req, res) => {
  try {
    const db = getKnex();
    const rows = await rawAll<any>(db, 'SELECT id, name, report_type, schedule, recipients, format, framework_id, enabled, last_run_at, last_run_status, last_run_error FROM report_schedules ORDER BY name', []);
    res.json(rows.map(r => ({ ...r, recipients: JSON.parse(r.recipients ?? '[]') })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const db = getKnex();
    const { name, report_type, schedule, recipients = [], format = 'pdf', framework_id, enabled = true } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    if (!VALID_TYPES.includes(report_type)) return res.status(400).json({ error: `report_type must be one of: ${VALID_TYPES.join(', ')}` });
    if (!cron.validate(schedule)) return res.status(400).json({ error: 'schedule must be a valid cron expression' });
    if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'At least one recipient is required' });
    const id = await rawInsert(db,
      'INSERT INTO report_schedules (name, report_type, schedule, recipients, format, framework_id, enabled) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [name.trim(), report_type, schedule, JSON.stringify(recipients), format, framework_id ?? null, enabled ? 1 : 0]
    );
    if (enabled) scheduleReport(id, schedule);
    const row = await rawGet<any>(db, 'SELECT * FROM report_schedules WHERE id=?', [id]);
    res.status(201).json({ ...row, recipients: JSON.parse(row.recipients ?? '[]') });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await rawGet<any>(db, 'SELECT id FROM report_schedules WHERE id=?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, report_type, schedule, recipients, format, framework_id, enabled } = req.body;
    if (schedule && !cron.validate(schedule)) return res.status(400).json({ error: 'Invalid cron expression' });
    if (report_type !== undefined && !VALID_TYPES.includes(report_type)) return res.status(400).json({ error: `report_type must be one of: ${VALID_TYPES.join(', ')}` });
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (report_type !== undefined) updates.report_type = report_type;
    if (schedule !== undefined) updates.schedule = schedule;
    if (recipients !== undefined) updates.recipients = JSON.stringify(recipients);
    if (format !== undefined) updates.format = format;
    if (framework_id !== undefined) updates.framework_id = framework_id;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await rawRun(db, `UPDATE report_schedules SET ${sets} WHERE id=?`, [...Object.values(updates), id]);
    const updated = await rawGet<any>(db, 'SELECT * FROM report_schedules WHERE id=?', [id]);
    if (updated.enabled) scheduleReport(updated.id, updated.schedule);
    else stopReport(updated.id);
    res.json({ ...updated, recipients: JSON.parse(updated.recipients ?? '[]') });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!await rawGet(db, 'SELECT id FROM report_schedules WHERE id=?', [id])) return res.status(404).json({ error: 'Not found' });
    stopReport(id);
    await rawRun(db, 'DELETE FROM report_schedules WHERE id=?', [id]);
    res.status(204).end();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
