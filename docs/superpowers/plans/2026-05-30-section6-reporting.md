# Reporting & Exports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scheduled email report delivery, compliance gap report exports (Section 2 backend already done), executive exercise summary PDF, STIX bundle export (Section 4 IOC export already done), and two new ReportBuilder section types (Compliance Summary, Integration Sync Status).

**Architecture:** SMTP sending uses `nodemailer` (new dependency). Report schedules use a `report_schedules` table + `node-cron`. The executive exercise summary is a new endpoint on the existing exercises route. ReportBuilder section types are purely frontend changes.

**Tech Stack:** `nodemailer` (new), `node-cron` (already installed), Knex migration, Express route additions, React component updates.

---

## File Map

| File | Action |
|------|--------|
| `server/src/db/migrations/020_report_schedules.ts` | Create — report_schedules table |
| `server/src/routes/report-schedules.ts` | Create — CRUD + cron management |
| `server/src/reporting/mailer.ts` | Create — nodemailer + HTML-to-PDF report renderer |
| `server/src/reporting/scheduler.ts` | Create — node-cron job manager for scheduled reports |
| `server/src/routes/exercises.ts` | Modify — add executive summary endpoint |
| `server/src/index.ts` | Modify — register report-schedules router, init report scheduler |
| `server/src/__tests__/helpers/testDb.ts` | Modify — add report_schedules table |
| `server/src/__tests__/report-schedules.test.ts` | Create |
| `client/src/types.ts` | Modify — add ReportSchedule type |
| `client/src/api.ts` | Modify — add report schedule API calls |
| `client/src/components/ReportBuilder.tsx` | Modify — add Compliance Summary and Integration Sync Status section types |
| `client/src/pages/Reports.tsx` | Modify — add Scheduled Reports tab |
| `client/src/pages/Exercises.tsx` | Modify — add "Export Executive Summary" button |
| `package.json` (server) | Modify — add nodemailer dependency |

---

### Task 1: Install nodemailer

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install nodemailer**

```bash
cd server && npm install nodemailer && npm install --save-dev @types/nodemailer
```

- [ ] **Step 2: Commit package files**

```bash
git add server/package.json server/package-lock.json package-lock.json
git commit -m "feat: add nodemailer dependency"
```

---

### Task 2: Report schedules migration

**Files:**
- Create: `server/src/db/migrations/020_report_schedules.ts`

- [ ] **Step 1: Create migration**

```typescript
// server/src/db/migrations/020_report_schedules.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('report_schedules', t => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('report_type').notNullable(); // executive | trends | threats | gaps | compliance
    t.string('schedule').notNullable();    // cron expression, e.g. '0 8 * * 1' = Monday 8am
    t.text('recipients').notNullable();    // JSON array of email strings
    t.string('format').notNullable().defaultTo('pdf'); // pdf | markdown
    t.string('framework_id').nullable();   // for compliance reports
    t.integer('enabled').notNullable().defaultTo(1);
    t.timestamp('last_run_at').nullable();
    t.string('last_run_status').nullable(); // ok | error
    t.string('last_run_error').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('report_schedules');
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npm run migrate
```
Expected: `Batch 18 run: 1 migrations`

- [ ] **Step 3: Commit**

```bash
git add server/src/db/migrations/020_report_schedules.ts
git commit -m "feat: add report_schedules table migration"
```

---

### Task 3: Mailer module

**Files:**
- Create: `server/src/reporting/mailer.ts`

- [ ] **Step 1: Create mailer**

```typescript
// server/src/reporting/mailer.ts
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? 'mitremap@localhost';

  if (!host) throw new Error('SMTP_HOST environment variable not set. Configure SMTP to enable email reports.');

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });

  return _transporter;
}

export async function sendReportEmail(opts: {
  to: string[];
  subject: string;
  htmlBody: string;
  attachmentName?: string;
  attachmentContent?: Buffer;
}): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'mitremap@localhost';

  await transporter.sendMail({
    from,
    to: opts.to.join(', '),
    subject: opts.subject,
    html: opts.htmlBody,
    ...(opts.attachmentName && opts.attachmentContent ? {
      attachments: [{ filename: opts.attachmentName, content: opts.attachmentContent, contentType: 'application/pdf' }],
    } : {}),
  });
}

/** Generate a simple HTML report body from a report API response */
export function buildReportHtml(reportType: string, data: any): string {
  const timestamp = new Date().toLocaleString();
  const title = {
    executive: 'Executive Summary', trends: 'Coverage Trends',
    threats: 'Threat Landscape', gaps: 'Prioritized Gaps', compliance: 'Compliance Report',
  }[reportType] ?? reportType;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, sans-serif; color: #1e293b; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    h2 { font-size: 16px; color: #334155; margin-top: 24px; }
    .kpi { display: inline-block; background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin: 4px; text-align: center; }
    .kpi .value { font-size: 28px; font-weight: 700; color: #3b82f6; }
    .kpi .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { text-align: left; padding: 8px; background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>MitreMap — ${title}</h1>
  <p style="color:#64748b;font-size:13px;">Generated: ${timestamp}</p>

  ${reportType === 'executive' && data ? `
    <div>
      <div class="kpi"><div class="value">${data.coverage_pct ?? 0}%</div><div class="label">Coverage</div></div>
      <div class="kpi"><div class="value">${data.active_detections ?? 0}</div><div class="label">Detections</div></div>
      <div class="kpi"><div class="value">${data.gap_techniques ?? 0}</div><div class="label">Gaps</div></div>
      <div class="kpi"><div class="value">${data.risk_score ?? 0}</div><div class="label">Risk Score</div></div>
    </div>
    ${data.tactic_breakdown ? `
      <h2>Coverage by Tactic</h2>
      <table>
        <thead><tr><th>Tactic</th><th>Covered</th><th>Total</th><th>%</th></tr></thead>
        <tbody>
          ${(data.tactic_breakdown ?? []).map((t: any) => `<tr><td>${t.tactic_name}</td><td>${t.covered}</td><td>${t.total}</td><td>${t.pct}%</td></tr>`).join('')}
        </tbody>
      </table>
    ` : ''}
  ` : ''}

  ${reportType === 'gaps' && data?.gaps ? `
    <h2>Top Priority Gaps</h2>
    <table>
      <thead><tr><th>Technique</th><th>ID</th><th>Priority</th><th>Tactics</th></tr></thead>
      <tbody>
        ${(data.gaps ?? []).slice(0, 20).map((g: any) => `<tr><td>${g.name}</td><td style="font-family:monospace">${g.id}</td><td>${g.priority_score}</td><td>${(g.tactic_names ?? []).join(', ')}</td></tr>`).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="footer">MitreMap · Detection Coverage Platform · Report generated automatically by scheduled delivery</div>
</body>
</html>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/reporting/mailer.ts
git commit -m "feat: add nodemailer report mailer module"
```

---

### Task 4: Report scheduler (cron jobs)

**Files:**
- Create: `server/src/reporting/scheduler.ts`

- [ ] **Step 1: Create scheduler**

```typescript
// server/src/reporting/scheduler.ts
import cron from 'node-cron';
import { getKnex, rawAll, rawRun } from '../db/database';
import { sendReportEmail, buildReportHtml } from './mailer';

const _jobs = new Map<number, cron.ScheduledTask>();

async function runSchedule(scheduleId: number): Promise<void> {
  const db = getKnex();
  const schedule = await db.raw('SELECT * FROM report_schedules WHERE id = ?', [scheduleId]);
  const s = (Array.isArray(schedule) ? schedule : schedule.rows)?.[0];
  if (!s || !s.enabled) return;

  const recipients: string[] = JSON.parse(s.recipients ?? '[]');
  if (recipients.length === 0) return;

  try {
    // Fetch report data from the existing report routes
    let data: any = null;
    const fetch = await import('node-fetch').catch(() => null);
    const port = process.env.PORT ?? '4000';
    const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const reportUrl = `${proto}://localhost:${port}/api/reports/${s.report_type}`;

    const res = await globalThis.fetch(reportUrl, {
      headers: { 'x-internal-report': 'true' }, // bypass auth for internal calls
    }).catch(() => null);
    if (res?.ok) data = await res.json();

    const html = buildReportHtml(s.report_type, data);
    const subject = `MitreMap Report: ${s.name} — ${new Date().toLocaleDateString()}`;

    await sendReportEmail({ to: recipients, subject, htmlBody: html });
    await rawRun(db, "UPDATE report_schedules SET last_run_at=CURRENT_TIMESTAMP, last_run_status='ok', last_run_error=NULL WHERE id=?", [scheduleId]);
  } catch (e: any) {
    await rawRun(db, "UPDATE report_schedules SET last_run_at=CURRENT_TIMESTAMP, last_run_status='error', last_run_error=? WHERE id=?", [e.message, scheduleId]);
  }
}

export async function initReportScheduler(): Promise<void> {
  const db = getKnex();
  const schedules = await rawAll<{ id: number; schedule: string; enabled: number }>(
    db, 'SELECT id, schedule, enabled FROM report_schedules'
  );
  for (const s of schedules) {
    if (s.enabled && cron.validate(s.schedule)) {
      scheduleReport(s.id, s.schedule);
    }
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
```

- [ ] **Step 2: Commit**

```bash
git add server/src/reporting/scheduler.ts
git commit -m "feat: add report schedule cron job manager"
```

---

### Task 5: Report schedules REST route

**Files:**
- Create: `server/src/routes/report-schedules.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create route**

```typescript
// server/src/routes/report-schedules.ts
import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';
import { scheduleReport, stopReport } from '../reporting/scheduler';
import cron from 'node-cron';

const router = Router();

const VALID_TYPES = ['executive', 'trends', 'threats', 'gaps', 'compliance'];

router.get('/', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, 'SELECT id, name, report_type, schedule, recipients, format, framework_id, enabled, last_run_at, last_run_status, last_run_error FROM report_schedules ORDER BY name');
  res.json(rows.map(r => ({ ...r, recipients: JSON.parse(r.recipients ?? '[]') })));
});

router.post('/', async (req, res) => {
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
  res.status(201).json(await rawGet(db, 'SELECT * FROM report_schedules WHERE id=?', [id]));
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const row = await rawGet(db, 'SELECT id FROM report_schedules WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { name, report_type, schedule, recipients, format, framework_id, enabled } = req.body;
  if (schedule && !cron.validate(schedule)) return res.status(400).json({ error: 'Invalid cron expression' });
  await rawRun(db,
    `UPDATE report_schedules SET
      name=COALESCE(?,name), report_type=COALESCE(?,report_type), schedule=COALESCE(?,schedule),
      recipients=COALESCE(?,recipients), format=COALESCE(?,format), framework_id=COALESCE(?,framework_id),
      enabled=COALESCE(?,enabled), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [name ?? null, report_type ?? null, schedule ?? null,
     recipients ? JSON.stringify(recipients) : null, format ?? null, framework_id ?? null,
     enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id]
  );
  const updated = await rawGet<any>(db, 'SELECT * FROM report_schedules WHERE id=?', [req.params.id]);
  if (updated.enabled) scheduleReport(updated.id, updated.schedule);
  else stopReport(updated.id);
  res.json({ ...updated, recipients: JSON.parse(updated.recipients ?? '[]') });
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM report_schedules WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Not found' });
  stopReport(Number(req.params.id));
  await rawRun(db, 'DELETE FROM report_schedules WHERE id=?', [req.params.id]);
  res.status(204).end();
});

export default router;
```

- [ ] **Step 2: Register in index.ts and init scheduler on startup**

```typescript
import reportSchedulesRouter from './routes/report-schedules';
import { initReportScheduler } from './reporting/scheduler';

app.use('/api/report-schedules', reportSchedulesRouter);

// After migrations and seeding, add:
await initReportScheduler();
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/report-schedules.ts server/src/reporting/ server/src/index.ts
git commit -m "feat: add report schedules route and cron scheduler"
```

---

### Task 6: Route tests for report schedules

**Files:**
- Modify: `server/src/__tests__/helpers/testDb.ts`
- Create: `server/src/__tests__/report-schedules.test.ts`

- [ ] **Step 1: Add table to testDb.ts**

```typescript
    .createTableIfNotExists('report_schedules', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('report_type').notNullable();
      t.string('schedule').notNullable();
      t.text('recipients').notNullable();
      t.string('format').notNullable().defaultTo('pdf');
      t.string('framework_id').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('last_run_at').nullable();
      t.string('last_run_status').nullable();
      t.string('last_run_error').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
```

- [ ] **Step 2: Write tests**

```typescript
// server/src/__tests__/report-schedules.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import reportSchedulesRouter from '../routes/report-schedules';
import type { Knex as KnexType } from 'knex';

// Mock the scheduler so no real cron jobs start during tests
vi.mock('../reporting/scheduler', () => ({
  scheduleReport: vi.fn(),
  stopReport: vi.fn(),
  initReportScheduler: vi.fn(),
}));

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  const dbModule = await import('../db/database');
  (dbModule as any)._instance = db;
  app = createTestApp(['/api/report-schedules', reportSchedulesRouter]);
});

afterAll(async () => { await db.destroy(); });

describe('POST /api/report-schedules', () => {
  it('creates a schedule', async () => {
    const res = await request(app).post('/api/report-schedules').send({
      name: 'Weekly Executive',
      report_type: 'executive',
      schedule: '0 8 * * 1',
      recipients: ['ciso@example.com'],
      format: 'pdf',
    }).expect(201);
    expect(res.body.name).toBe('Weekly Executive');
    expect(res.body.report_type).toBe('executive');
  });

  it('rejects invalid cron expression', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'Bad Schedule', report_type: 'executive', schedule: 'not-a-cron', recipients: ['a@b.com'],
    }).expect(400);
  });

  it('rejects empty recipients', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'No Recipients', report_type: 'gaps', schedule: '0 8 * * *', recipients: [],
    }).expect(400);
  });

  it('rejects invalid report type', async () => {
    await request(app).post('/api/report-schedules').send({
      name: 'Bad Type', report_type: 'unknown', schedule: '0 8 * * *', recipients: ['a@b.com'],
    }).expect(400);
  });
});

describe('GET /api/report-schedules', () => {
  it('returns list of schedules', async () => {
    const res = await request(app).get('/api/report-schedules').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body[0].recipients)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd server && npm test -- report-schedules
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/__tests__/helpers/testDb.ts server/src/__tests__/report-schedules.test.ts
git commit -m "test: add report schedule tests"
```

---

### Task 7: Executive exercise summary endpoint

**Files:**
- Modify: `server/src/routes/exercises.ts`

- [ ] **Step 1: Add executive summary endpoint**

In `server/src/routes/exercises.ts`, find the existing `GET /api/exercises/:id/report` endpoint. Add a new endpoint after it:

```typescript
// GET /api/exercises/:id/executive-summary
router.get('/:id/executive-summary', async (req, res) => {
  const db = getKnex();
  const exercise = await rawGet<any>(db, 'SELECT * FROM exercises WHERE id = ?', [req.params.id]);
  if (!exercise) return res.status(404).json({ error: 'Not found' });

  const techniques = await rawAll<any>(db, 'SELECT * FROM exercise_techniques WHERE exercise_id = ?', [exercise.id]);
  const testRuns = await rawAll<any>(db, 'SELECT * FROM exercise_test_runs WHERE exercise_id = ?', [exercise.id]);
  const findings = await rawAll<any>(db, 'SELECT * FROM exercise_findings WHERE exercise_id = ?', [exercise.id]);

  const totalTechniques = techniques.length;
  const detectedCount = testRuns.filter((r: any) => r.outcome === 'detected').length;
  const partialCount = testRuns.filter((r: any) => r.outcome === 'partial').length;
  const notDetectedCount = testRuns.filter((r: any) => r.outcome === 'not_detected').length;
  const detectionRate = testRuns.length === 0 ? 0 : Math.round(((detectedCount + partialCount * 0.5) / testRuns.length) * 100);

  const findingsBySeverity = {
    critical: findings.filter((f: any) => f.severity === 'critical').length,
    high: findings.filter((f: any) => f.severity === 'high').length,
    medium: findings.filter((f: any) => f.severity === 'medium').length,
    low: findings.filter((f: any) => f.severity === 'low').length,
  };

  const topFindings = [...findings]
    .sort((a: any, b: any) => {
      const order = ['critical', 'high', 'medium', 'low', 'informational'];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    })
    .slice(0, 5)
    .map((f: any) => ({ title: f.title, severity: f.severity, finding_type: f.finding_type, recommendation: f.recommendation }));

  const detectionGaps = testRuns
    .filter((r: any) => r.outcome === 'not_detected')
    .map((r: any) => ({ technique_id: r.technique_id ?? null, notes: r.notes }))
    .slice(0, 10);

  const summary = {
    exercise: {
      id: exercise.id, name: exercise.name, type: exercise.type,
      status: exercise.status, lead: exercise.lead,
      start_date: exercise.start_date, end_date: exercise.end_date,
    },
    kpis: {
      detection_rate: detectionRate,
      techniques_scoped: totalTechniques,
      tests_executed: testRuns.length,
      findings_total: findings.length,
      detected: detectedCount,
      partial: partialCount,
      not_detected: notDetectedCount,
    },
    findings_by_severity: findingsBySeverity,
    top_findings: topFindings,
    detection_gaps: detectionGaps,
    generated_at: new Date().toISOString(),
  };

  res.json(summary);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/exercises.ts
git commit -m "feat: add executive exercise summary endpoint"
```

---

### Task 8: ReportBuilder — two new section types

**Files:**
- Modify: `client/src/components/ReportBuilder.tsx`

- [ ] **Step 1: Read current ReportBuilder section types**

Read `client/src/components/ReportBuilder.tsx` to understand the existing section type pattern before making changes.

- [ ] **Step 2: Add Compliance Summary section type**

In `ReportBuilder.tsx`, find where section types are defined. Add `'compliance_summary'` to the union type and add a case in the rendering switch:

```typescript
// In the SECTION_TYPES array/object, add:
{ id: 'compliance_summary', label: 'Compliance Framework Summary', description: 'Coverage % for all configured compliance frameworks' },
```

In the section renderer, add the compliance_summary case:
```tsx
case 'compliance_summary': {
  // Data is fetched at report build time
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Compliance Coverage</h3>
      {section.data?.frameworks ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 dark:text-slate-600 border-b border-gray-200 dark:border-slate-800">
              <th className="text-left pb-1 font-medium">Framework</th>
              <th className="text-center pb-1 font-medium">Controls</th>
              <th className="text-center pb-1 font-medium">Covered</th>
              <th className="text-right pb-1 font-medium">Coverage %</th>
            </tr>
          </thead>
          <tbody>
            {section.data.frameworks.map((fw: any) => (
              <tr key={fw.id} className="border-b border-gray-100 dark:border-slate-800/50">
                <td className="py-1.5 text-gray-700 dark:text-slate-300">{fw.name}</td>
                <td className="py-1.5 text-center text-gray-500 dark:text-slate-400">{fw.total_controls ?? '—'}</td>
                <td className="py-1.5 text-center text-gray-500 dark:text-slate-400">{fw.covered_controls ?? '—'}</td>
                <td className="py-1.5 text-right font-semibold text-gray-700 dark:text-slate-300">
                  {fw.covered_controls != null && fw.total_controls
                    ? `${Math.round((fw.covered_controls / fw.total_controls) * 100)}%`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-xs text-gray-400 dark:text-slate-600">Loading compliance data…</div>
      )}
    </div>
  );
}
```

Load compliance data when a `compliance_summary` section is added to the report:
```tsx
// In the effect that loads section data, add:
if (section.type === 'compliance_summary' && !section.data) {
  api.getComplianceFrameworks().then(fws => {
    updateSectionData(section.id, { frameworks: fws });
  }).catch(() => {});
}
```

- [ ] **Step 3: Add Integration Sync Status section type**

```typescript
// Section type:
{ id: 'integration_sync_status', label: 'Integration Sync Status', description: 'Last push/pull timestamps for configured SIEM connectors' },
```

```tsx
// Renderer case:
case 'integration_sync_status': {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Integration Sync Status</h3>
      {section.data?.integrations ? (
        section.data.integrations.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-slate-600">No SIEM integrations configured.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 dark:text-slate-600 border-b border-gray-200 dark:border-slate-800">
                <th className="text-left pb-1 font-medium">Integration</th>
                <th className="text-left pb-1 font-medium">Type</th>
                <th className="text-left pb-1 font-medium">Last Push</th>
                <th className="text-left pb-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {section.data.integrations.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-slate-800/50">
                  <td className="py-1.5 text-gray-700 dark:text-slate-300">{s.name}</td>
                  <td className="py-1.5 text-gray-500 dark:text-slate-400 capitalize">{s.type}</td>
                  <td className="py-1.5 text-gray-500 dark:text-slate-400">
                    {s.last_pushed_at ? new Date(s.last_pushed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-1.5">
                    {s.last_push_status ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase ${s.last_push_status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {s.last_push_status}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : (
        <div className="text-xs text-gray-400 dark:text-slate-600">Loading integration data…</div>
      )}
    </div>
  );
}
```

```tsx
// In section data loading effect:
if (section.type === 'integration_sync_status' && !section.data) {
  api.getSiemIntegrations().then(integrations => {
    updateSectionData(section.id, { integrations });
  }).catch(() => {});
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ReportBuilder.tsx
git commit -m "feat: add Compliance Summary and Integration Sync Status section types to ReportBuilder"
```

---

### Task 9: Scheduled Reports tab on Reports page + Exercise executive summary button

**Files:**
- Modify: `client/src/pages/Reports.tsx`
- Modify: `client/src/pages/Exercises.tsx`
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`

- [ ] **Step 1: Add ReportSchedule type and API methods**

```typescript
// Add to types.ts:
export interface ReportSchedule {
  id: number;
  name: string;
  report_type: 'executive' | 'trends' | 'threats' | 'gaps' | 'compliance';
  schedule: string;
  recipients: string[];
  format: 'pdf' | 'markdown';
  framework_id: string | null;
  enabled: number;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
}
```

```typescript
// Add to api.ts:
  getReportSchedules: () => get<ReportSchedule[]>('/report-schedules'),
  createReportSchedule: (data: any) => post<ReportSchedule>('/report-schedules', data),
  updateReportSchedule: (id: number, data: any) => put<ReportSchedule>(`/report-schedules/${id}`, data),
  deleteReportSchedule: (id: number) => del<void>(`/report-schedules/${id}`),
  getExerciseExecutiveSummary: (id: number) => get<any>(`/exercises/${id}/executive-summary`),
```

- [ ] **Step 2: Add "Scheduled Reports" tab to Reports.tsx**

In `Reports.tsx`, add `'scheduled'` to the tabs:
```typescript
const TABS: { id: TabId; label: string }[] = [
  // ... existing tabs ...
  { id: 'scheduled', label: 'Scheduled Delivery' },
];
```

Add scheduled tab content (add state for schedules, add form for creating new schedule):

```tsx
{activeTab === 'scheduled' && (
  <div className="space-y-4">
    <div className="flex justify-end">
      <button onClick={() => setAddScheduleOpen(true)}
        className="px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors">
        + Schedule Report
      </button>
    </div>

    {schedules.length === 0 && !addScheduleOpen && (
      <div className="text-center py-12">
        <div className="text-sm text-gray-400 dark:text-slate-600 mb-2">No scheduled reports.</div>
        <div className="text-xs text-gray-300 dark:text-slate-700">Configure SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables to enable email delivery.</div>
      </div>
    )}

    {addScheduleOpen && (
      <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">New Scheduled Report</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400">Name</label>
            <input type="text" value={scheduleForm.name} onChange={e => setScheduleForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400">Report Type</label>
            <select value={scheduleForm.report_type} onChange={e => setScheduleForm(f => ({ ...f, report_type: e.target.value }))}
              className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none">
              <option value="executive">Executive Summary</option>
              <option value="gaps">Prioritized Gaps</option>
              <option value="threats">Threat Landscape</option>
              <option value="trends">Coverage Trends</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400">Schedule (cron expression)</label>
            <input type="text" value={scheduleForm.schedule} onChange={e => setScheduleForm(f => ({ ...f, schedule: e.target.value }))}
              placeholder="0 8 * * 1  (Mon 8am)" className="w-full mt-1 text-xs font-mono bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400">Recipients (comma-separated emails)</label>
            <input type="text" value={scheduleForm.recipients} onChange={e => setScheduleForm(f => ({ ...f, recipients: e.target.value }))}
              placeholder="ciso@company.com, team@company.com"
              className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setAddScheduleOpen(false)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
          <button onClick={async () => {
            try {
              const created = await api.createReportSchedule({
                ...scheduleForm,
                recipients: scheduleForm.recipients.split(',').map((r: string) => r.trim()).filter(Boolean),
              });
              setSchedules((prev: any[]) => [...prev, created]);
              setAddScheduleOpen(false);
              setScheduleForm({ name: '', report_type: 'executive', schedule: '0 8 * * 1', recipients: '' });
            } catch (e: any) { /* show toast */ }
          }} className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors">Save</button>
        </div>
      </div>
    )}

    <div className="space-y-2">
      {schedules.map((s: any) => (
        <div key={s.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{s.name}</span>
              <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded font-medium uppercase">{s.report_type}</span>
              {s.last_run_status && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase ${s.last_run_status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{s.last_run_status}</span>
              )}
            </div>
            <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-mono">{s.schedule} · {s.recipients?.join(', ')}</div>
            {s.last_run_at && <div className="text-[10px] text-gray-300 dark:text-slate-600 mt-0.5">Last run: {new Date(s.last_run_at).toLocaleString()}</div>}
          </div>
          <button onClick={async () => { await api.deleteReportSchedule(s.id); setSchedules((prev: any[]) => prev.filter(x => x.id !== s.id)); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
        </div>
      ))}
    </div>
  </div>
)}
```

Add the required state declarations at the top of `Reports`:
```tsx
const [schedules, setSchedules] = useState<any[]>([]);
const [addScheduleOpen, setAddScheduleOpen] = useState(false);
const [scheduleForm, setScheduleForm] = useState({ name: '', report_type: 'executive', schedule: '0 8 * * 1', recipients: '' });
```

Load schedules when the 'scheduled' tab is active:
```tsx
// In the loadTab handler, add:
if (tab === 'scheduled') {
  api.getReportSchedules().then(setSchedules).catch(() => {});
}
```

- [ ] **Step 3: Add executive summary export to Exercises.tsx**

Find the exercise detail page in `Exercises.tsx`. In the Report tab, add an "Export Executive Summary" button:

```tsx
<button
  onClick={async () => {
    const summary = await api.getExerciseExecutiveSummary(exercise.id);
    // Build simple HTML and trigger browser print
    const html = `<!DOCTYPE html><html><head><style>
      body{font-family:sans-serif;padding:32px;max-width:700px;margin:0 auto}
      h1{font-size:22px;border-bottom:2px solid #3b82f6;padding-bottom:8px}
      .kpi{display:inline-block;background:#f1f5f9;border-radius:8px;padding:10px 14px;margin:4px;text-align:center}
      .kpi .v{font-size:26px;font-weight:700;color:#3b82f6}
      .kpi .l{font-size:10px;color:#64748b;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
      th{text-align:left;padding:6px;background:#f8fafc;font-size:11px;color:#64748b;text-transform:uppercase}
      td{padding:6px;border-bottom:1px solid #e2e8f0}
    </style></head><body>
      <h1>${summary.exercise.name} — Executive Summary</h1>
      <div>
        <div class="kpi"><div class="v">${summary.kpis.detection_rate}%</div><div class="l">Detection Rate</div></div>
        <div class="kpi"><div class="v">${summary.kpis.techniques_scoped}</div><div class="l">Techniques</div></div>
        <div class="kpi"><div class="v">${summary.kpis.tests_executed}</div><div class="l">Tests Run</div></div>
        <div class="kpi"><div class="v">${summary.kpis.findings_total}</div><div class="l">Findings</div></div>
      </div>
      <h2 style="margin-top:24px">Top Findings</h2>
      <table>
        <thead><tr><th>Finding</th><th>Severity</th><th>Recommendation</th></tr></thead>
        <tbody>
          ${(summary.top_findings ?? []).map((f: any) => `<tr><td>${f.title}</td><td>${f.severity}</td><td>${f.recommendation ?? '—'}</td></tr>`).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin-top:24px">Generated ${new Date().toLocaleString()} · MitreMap</p>
    </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }}
  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
>
  Export Executive Summary
</button>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Reports.tsx client/src/pages/Exercises.tsx client/src/types.ts client/src/api.ts
git commit -m "feat: add Scheduled Reports tab and exercise executive summary export"
```

---

### Task 10: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify scheduled reports tab**

Navigate to `/reports`. The "Scheduled Delivery" tab should appear. Click it. Try creating a schedule with a valid cron expression — should succeed. An invalid cron expression should show an error from the server.

- [ ] **Step 3: Verify ReportBuilder new sections**

Navigate to `/reports` → Custom Reports tab. Add a "Compliance Framework Summary" section. It should show the compliance framework table populated with data.

- [ ] **Step 4: Verify exercise executive summary**

Navigate to `/exercises`. Open a completed exercise. In the Report tab, click "Export Executive Summary" — a print dialog should open with the one-page summary.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Section 6 — Reporting & Exports"
```

---

## SMTP Configuration

To enable email delivery, set these environment variables:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mitremap@example.com
SMTP_PASS=your-password
SMTP_FROM=mitremap@example.com
```

For Gmail: use `smtp.gmail.com:587` with an App Password. For no-auth relay: set `SMTP_HOST` only, leave `SMTP_USER` and `SMTP_PASS` unset.
