# Intelligence Depth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add campaign timelines to threat groups, CVE/NVD mapping to ATT&CK techniques, an IOC library, and a one-click import of the full MITRE ATT&CK threat group catalogue (130+ groups).

**Architecture:** Four new database tables: `group_campaigns`, `campaign_techniques`, `cves`, `cve_techniques`, `indicators`, `indicator_groups`. The NVD CVE API is public (no auth required). Campaign and IOC data surfaces inline in the existing ThreatGroups page. CVE data surfaces as an additional column in the Gap Analysis table.

**Tech Stack:** Knex migration, Express routes, NVD REST API v2 (https://services.nvd.nist.gov/rest/json/cves/2.0), React components added to existing pages.

---

## File Map

| File | Action |
|------|--------|
| `server/src/db/migrations/019_intelligence.ts` | Create — 4 new tables |
| `server/src/routes/campaigns.ts` | Create — CRUD for group campaigns + campaign techniques |
| `server/src/routes/cves.ts` | Create — CVE CRUD + NVD sync endpoint |
| `server/src/routes/indicators.ts` | Create — IOC CRUD |
| `server/src/index.ts` | Modify — register 3 new routers |
| `server/src/__tests__/helpers/testDb.ts` | Modify — add 4 new tables |
| `server/src/__tests__/campaigns.test.ts` | Create |
| `server/src/__tests__/cves.test.ts` | Create |
| `server/src/__tests__/indicators.test.ts` | Create |
| `client/src/types.ts` | Modify — add Campaign, CVE, Indicator types |
| `client/src/api.ts` | Modify — add campaign, CVE, indicator API calls |
| `client/src/pages/ThreatGroups.tsx` | Modify — add campaigns tab and IOC panel in group detail |
| `client/src/pages/GapAnalysis.tsx` | Modify — add CVE column and filter |

---

### Task 1: DB migration

**Files:**
- Create: `server/src/db/migrations/019_intelligence.ts`

- [ ] **Step 1: Create migration**

```typescript
// server/src/db/migrations/019_intelligence.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTableIfNotExists('group_campaigns', t => {
      t.increments('id').primary();
      t.string('group_id').notNullable()
        .references('id').inTable('threat_groups').onDelete('CASCADE');
      t.string('name').notNullable();
      t.text('description').nullable();
      t.string('start_date').nullable(); // ISO date string
      t.string('end_date').nullable();
      t.string('source_url').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('campaign_techniques', t => {
      t.integer('campaign_id').notNullable()
        .references('id').inTable('group_campaigns').onDelete('CASCADE');
      t.string('technique_id').notNullable();
      t.primary(['campaign_id', 'technique_id']);
    })
    .createTableIfNotExists('cves', t => {
      t.string('id').primary(); // CVE-YYYY-NNNNN
      t.text('description').nullable();
      t.float('cvss_score').nullable();
      t.string('cvss_severity').nullable(); // CRITICAL | HIGH | MEDIUM | LOW | NONE
      t.text('affected_products').nullable(); // JSON array of CPE strings
      t.string('published_at').nullable();
      t.string('modified_at').nullable();
      t.integer('patch_available').notNullable().defaultTo(0);
      t.timestamp('synced_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('cve_techniques', t => {
      t.string('cve_id').notNullable()
        .references('id').inTable('cves').onDelete('CASCADE');
      t.string('technique_id').notNullable();
      t.primary(['cve_id', 'technique_id']);
    })
    .createTableIfNotExists('indicators', t => {
      t.increments('id').primary();
      t.string('type').notNullable(); // ip | domain | hash | url | email
      t.string('value').notNullable();
      t.string('group_id').nullable()
        .references('id').inTable('threat_groups').onDelete('SET NULL');
      t.string('technique_id').nullable();
      t.string('confidence').notNullable().defaultTo('medium'); // high | medium | low
      t.text('notes').nullable();
      t.string('first_seen').nullable();
      t.string('last_seen').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_cve_techniques_tech ON cve_techniques(technique_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_indicators_group ON indicators(group_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists('campaign_techniques')
    .dropTableIfExists('group_campaigns')
    .dropTableIfExists('cve_techniques')
    .dropTableIfExists('cves')
    .dropTableIfExists('indicators');
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npm run migrate
```
Expected: `Batch 17 run: 1 migrations`

- [ ] **Step 3: Commit**

```bash
git add server/src/db/migrations/019_intelligence.ts
git commit -m "feat: add intelligence tables (campaigns, cves, indicators)"
```

---

### Task 2: Campaigns route

**Files:**
- Create: `server/src/routes/campaigns.ts`

- [ ] **Step 1: Create route**

```typescript
// server/src/routes/campaigns.ts
import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

// GET /api/campaigns?group_id=APT29
router.get('/', async (req, res) => {
  const db = getKnex();
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });
  const campaigns = await rawAll(db,
    'SELECT * FROM group_campaigns WHERE group_id = ? ORDER BY start_date DESC NULLS LAST',
    [group_id]
  );
  // Attach technique IDs to each campaign
  for (const c of campaigns as any[]) {
    const techs = await rawAll(db, 'SELECT technique_id FROM campaign_techniques WHERE campaign_id = ?', [c.id]);
    c.technique_ids = techs.map((t: any) => t.technique_id);
  }
  res.json(campaigns);
});

// POST /api/campaigns
router.post('/', async (req, res) => {
  const db = getKnex();
  const { group_id, name, description, start_date, end_date, source_url, technique_ids = [] } = req.body;
  if (!group_id || !name?.trim()) return res.status(400).json({ error: 'group_id and name required' });
  const group = await rawGet(db, 'SELECT id FROM threat_groups WHERE id = ?', [group_id]);
  if (!group) return res.status(404).json({ error: 'Threat group not found' });

  const id = await rawInsert(db,
    'INSERT INTO group_campaigns (group_id, name, description, start_date, end_date, source_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [group_id, name.trim(), description ?? null, start_date ?? null, end_date ?? null, source_url ?? null]
  );
  for (const tid of technique_ids) {
    await rawRun(db, 'INSERT OR IGNORE INTO campaign_techniques (campaign_id, technique_id) VALUES (?, ?)', [id, tid]);
  }
  await logAudit(db, 'campaign', String(id), 'create', (req as any).actor ?? 'user', { group_id, name });
  const campaign = await rawGet(db, 'SELECT * FROM group_campaigns WHERE id = ?', [id]);
  (campaign as any).technique_ids = technique_ids;
  res.status(201).json(campaign);
});

// PUT /api/campaigns/:id
router.put('/:id', async (req, res) => {
  const db = getKnex();
  const campaign = await rawGet(db, 'SELECT id FROM group_campaigns WHERE id = ?', [req.params.id]);
  if (!campaign) return res.status(404).json({ error: 'Not found' });
  const { name, description, start_date, end_date, source_url, technique_ids } = req.body;
  await rawRun(db,
    `UPDATE group_campaigns SET
      name=COALESCE(?,name), description=COALESCE(?,description),
      start_date=COALESCE(?,start_date), end_date=COALESCE(?,end_date),
      source_url=COALESCE(?,source_url), updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [name ?? null, description ?? null, start_date ?? null, end_date ?? null, source_url ?? null, req.params.id]
  );
  if (Array.isArray(technique_ids)) {
    await rawRun(db, 'DELETE FROM campaign_techniques WHERE campaign_id = ?', [req.params.id]);
    for (const tid of technique_ids) {
      await rawRun(db, 'INSERT OR IGNORE INTO campaign_techniques (campaign_id, technique_id) VALUES (?, ?)', [req.params.id, tid]);
    }
  }
  const updated = await rawGet(db, 'SELECT * FROM group_campaigns WHERE id = ?', [req.params.id]);
  const techs = await rawAll(db, 'SELECT technique_id FROM campaign_techniques WHERE campaign_id = ?', [req.params.id]);
  (updated as any).technique_ids = techs.map((t: any) => t.technique_id);
  res.json(updated);
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM group_campaigns WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM group_campaigns WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

export default router;
```

- [ ] **Step 2: Register in index.ts**

```typescript
import campaignsRouter from './routes/campaigns';
app.use('/api/campaigns', campaignsRouter);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/campaigns.ts server/src/index.ts
git commit -m "feat: add campaigns route"
```

---

### Task 3: CVE route with NVD sync

**Files:**
- Create: `server/src/routes/cves.ts`

- [ ] **Step 1: Create route**

```typescript
// server/src/routes/cves.ts
import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';

const router = Router();

// GET /api/cves?technique_id=T1190
router.get('/', async (req, res) => {
  const db = getKnex();
  const { technique_id } = req.query;
  if (!technique_id) {
    const rows = await rawAll(db, 'SELECT * FROM cves ORDER BY cvss_score DESC NULLS LAST LIMIT 200');
    return res.json(rows);
  }
  const rows = await rawAll(db, `
    SELECT c.* FROM cves c
    JOIN cve_techniques ct ON ct.cve_id = c.id
    WHERE ct.technique_id = ?
    ORDER BY c.cvss_score DESC NULLS LAST
  `, [technique_id]);
  res.json(rows);
});

// POST /api/cves — create a CVE record manually
router.post('/', async (req, res) => {
  const db = getKnex();
  const { id, description, cvss_score, cvss_severity, affected_products, published_at, technique_ids = [] } = req.body;
  if (!id?.match(/^CVE-\d{4}-\d+$/)) return res.status(400).json({ error: 'id must be a valid CVE ID (CVE-YYYY-NNNNN)' });
  await rawRun(db,
    `INSERT OR REPLACE INTO cves (id, description, cvss_score, cvss_severity, affected_products, published_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, description ?? null, cvss_score ?? null, cvss_severity ?? null,
     affected_products ? JSON.stringify(affected_products) : null, published_at ?? null]
  );
  for (const tid of technique_ids) {
    await rawRun(db, 'INSERT OR IGNORE INTO cve_techniques (cve_id, technique_id) VALUES (?, ?)', [id, tid]);
  }
  res.status(201).json(await rawGet(db, 'SELECT * FROM cves WHERE id = ?', [id]));
});

// POST /api/cves/:id/techniques — link a technique
router.post('/:id/techniques', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM cves WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: 'CVE not found' });
  const { technique_id } = req.body;
  if (!technique_id) return res.status(400).json({ error: 'technique_id required' });
  await rawRun(db, 'INSERT OR IGNORE INTO cve_techniques (cve_id, technique_id) VALUES (?, ?)', [req.params.id, technique_id]);
  res.status(201).json({ cve_id: req.params.id, technique_id });
});

// DELETE /api/cves/:id/techniques/:technique_id
router.delete('/:id/techniques/:technique_id', async (req, res) => {
  const db = getKnex();
  await rawRun(db, 'DELETE FROM cve_techniques WHERE cve_id = ? AND technique_id = ?', [req.params.id, req.params.technique_id]);
  res.status(204).end();
});

// POST /api/cves/sync-nvd — fetch CVE data from NVD for a list of CVE IDs
router.post('/sync-nvd', async (req, res) => {
  const db = getKnex();
  const { cve_ids } = req.body; // array of CVE IDs
  if (!Array.isArray(cve_ids) || cve_ids.length === 0)
    return res.status(400).json({ error: 'cve_ids array required' });

  const results: Array<{ id: string; ok: boolean; message: string }> = [];

  for (const cveId of cve_ids.slice(0, 50)) { // limit to 50 per call (NVD rate limit)
    try {
      const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`;
      const nvdRes = await fetch(url, {
        headers: {
          'User-Agent': 'MitreMap/1.0 (https://github.com/mitremap)',
          ...(process.env.NVD_API_KEY ? { apiKey: process.env.NVD_API_KEY } : {}),
        },
      });
      if (!nvdRes.ok) { results.push({ id: cveId, ok: false, message: `NVD HTTP ${nvdRes.status}` }); continue; }
      const json = await nvdRes.json() as any;
      const vuln = json.vulnerabilities?.[0]?.cve;
      if (!vuln) { results.push({ id: cveId, ok: false, message: 'Not found in NVD' }); continue; }

      const desc = (vuln.descriptions ?? []).find((d: any) => d.lang === 'en')?.value ?? null;
      const metrics = vuln.metrics?.cvssMetricV31?.[0] ?? vuln.metrics?.cvssMetricV30?.[0] ?? vuln.metrics?.cvssMetricV2?.[0];
      const cvssScore = metrics?.cvssData?.baseScore ?? null;
      const severity = metrics?.cvssData?.baseSeverity ?? null;
      const published = vuln.published ?? null;
      const cpes = (vuln.configurations ?? []).flatMap((c: any) =>
        (c.nodes ?? []).flatMap((n: any) => (n.cpeMatch ?? []).map((m: any) => m.criteria))
      ).slice(0, 20);

      await rawRun(db,
        `INSERT OR REPLACE INTO cves (id, description, cvss_score, cvss_severity, affected_products, published_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [cveId, desc, cvssScore, severity, JSON.stringify(cpes), published]
      );
      results.push({ id: cveId, ok: true, message: `CVSS ${cvssScore ?? 'N/A'}` });
    } catch (e: any) {
      results.push({ id: cveId, ok: false, message: e.message });
    }
    // NVD allows 5 req/30s without API key, 50 req/30s with key
    if (!process.env.NVD_API_KEY) await new Promise(r => setTimeout(r, 700));
  }

  res.json({ results });
});

// GET /api/cves/gap-summary — for each undetected technique, list linked CVEs
router.get('/gap-summary', async (req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, `
    SELECT ct.technique_id,
           COUNT(c.id) as cve_count,
           MAX(c.cvss_score) as max_cvss,
           GROUP_CONCAT(c.id, ',') as cve_ids
    FROM cve_techniques ct
    JOIN cves c ON c.id = ct.cve_id
    GROUP BY ct.technique_id
    ORDER BY max_cvss DESC NULLS LAST
  `);
  res.json(rows);
});

export default router;
```

- [ ] **Step 2: Register in index.ts**

```typescript
import cvesRouter from './routes/cves';
app.use('/api/cves', cvesRouter);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/cves.ts server/src/index.ts
git commit -m "feat: add CVE route with NVD sync"
```

---

### Task 4: Indicators route

**Files:**
- Create: `server/src/routes/indicators.ts`

- [ ] **Step 1: Create route**

```typescript
// server/src/routes/indicators.ts
import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';

const router = Router();

const VALID_TYPES = ['ip', 'domain', 'hash', 'url', 'email'];

// GET /api/indicators?group_id=APT29
router.get('/', async (req, res) => {
  const db = getKnex();
  const { group_id, technique_id } = req.query;
  let sql = 'SELECT * FROM indicators WHERE 1=1';
  const params: any[] = [];
  if (group_id) { sql += ' AND group_id = ?'; params.push(group_id); }
  if (technique_id) { sql += ' AND technique_id = ?'; params.push(technique_id); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  res.json(await rawAll(db, sql, params));
});

// POST /api/indicators
router.post('/', async (req, res) => {
  const db = getKnex();
  const { type, value, group_id, technique_id, confidence = 'medium', notes, first_seen, last_seen } = req.body;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  if (!value?.trim()) return res.status(400).json({ error: 'value is required' });
  const id = await rawInsert(db,
    'INSERT INTO indicators (type, value, group_id, technique_id, confidence, notes, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [type, value.trim(), group_id ?? null, technique_id ?? null, confidence, notes ?? null, first_seen ?? null, last_seen ?? null]
  );
  res.status(201).json(await rawGet(db, 'SELECT * FROM indicators WHERE id = ?', [id]));
});

// PUT /api/indicators/:id
router.put('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM indicators WHERE id = ?', [req.params.id]))
    return res.status(404).json({ error: 'Not found' });
  const { type, value, group_id, technique_id, confidence, notes, first_seen, last_seen } = req.body;
  await rawRun(db,
    `UPDATE indicators SET type=COALESCE(?,type), value=COALESCE(?,value), group_id=COALESCE(?,group_id),
     technique_id=COALESCE(?,technique_id), confidence=COALESCE(?,confidence), notes=COALESCE(?,notes),
     first_seen=COALESCE(?,first_seen), last_seen=COALESCE(?,last_seen) WHERE id=?`,
    [type ?? null, value ?? null, group_id ?? null, technique_id ?? null, confidence ?? null,
     notes ?? null, first_seen ?? null, last_seen ?? null, req.params.id]
  );
  res.json(await rawGet(db, 'SELECT * FROM indicators WHERE id = ?', [req.params.id]));
});

// DELETE /api/indicators/:id
router.delete('/:id', async (req, res) => {
  const db = getKnex();
  await rawRun(db, 'DELETE FROM indicators WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// GET /api/indicators/export/stix — export as STIX 2.1 bundle
router.get('/export/stix', async (req, res) => {
  const db = getKnex();
  const { group_id } = req.query;
  const indicators = await rawAll(db,
    group_id ? 'SELECT * FROM indicators WHERE group_id = ? ORDER BY created_at DESC' : 'SELECT * FROM indicators ORDER BY created_at DESC LIMIT 500',
    group_id ? [group_id] : []
  );

  const stixObjects = (indicators as any[]).map(ioc => ({
    type: 'indicator',
    spec_version: '2.1',
    id: `indicator--${Buffer.from(String(ioc.id)).toString('hex').padStart(36, '0').slice(0, 36)}`,
    created: new Date(ioc.created_at).toISOString(),
    modified: new Date(ioc.created_at).toISOString(),
    name: `${ioc.type}:${ioc.value}`,
    indicator_types: [ioc.type === 'ip' ? 'malicious-activity' : ioc.type === 'domain' ? 'malicious-activity' : 'compromised'],
    pattern: ioc.type === 'ip' ? `[ipv4-addr:value = '${ioc.value}']`
      : ioc.type === 'domain' ? `[domain-name:value = '${ioc.value}']`
      : ioc.type === 'hash' ? `[file:hashes.'SHA-256' = '${ioc.value}']`
      : ioc.type === 'url' ? `[url:value = '${ioc.value}']`
      : `[email-message:from_ref.value = '${ioc.value}']`,
    pattern_type: 'stix',
    valid_from: ioc.first_seen ?? new Date(ioc.created_at).toISOString(),
    confidence: ioc.confidence === 'high' ? 85 : ioc.confidence === 'low' ? 30 : 60,
  }));

  const bundle = { type: 'bundle', id: 'bundle--mitremap-ioc-export', spec_version: '2.1', objects: stixObjects };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="mitremap-iocs.stix.json"');
  res.json(bundle);
});

export default router;
```

- [ ] **Step 2: Register in index.ts**

```typescript
import indicatorsRouter from './routes/indicators';
app.use('/api/indicators', indicatorsRouter);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/indicators.ts server/src/index.ts
git commit -m "feat: add indicators route with STIX export"
```

---

### Task 5: Tests

**Files:**
- Modify: `server/src/__tests__/helpers/testDb.ts`
- Create: `server/src/__tests__/campaigns.test.ts`
- Create: `server/src/__tests__/cves.test.ts`
- Create: `server/src/__tests__/indicators.test.ts`

- [ ] **Step 1: Add tables to testDb.ts**

```typescript
// Add to setupTestDb chain:
    .createTableIfNotExists('group_campaigns', t => {
      t.increments('id').primary();
      t.string('group_id').notNullable();
      t.string('name').notNullable();
      t.text('description').nullable();
      t.string('start_date').nullable();
      t.string('end_date').nullable();
      t.string('source_url').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('campaign_techniques', t => {
      t.integer('campaign_id').notNullable();
      t.string('technique_id').notNullable();
      t.primary(['campaign_id', 'technique_id']);
    })
    .createTableIfNotExists('cves', t => {
      t.string('id').primary();
      t.text('description').nullable();
      t.float('cvss_score').nullable();
      t.string('cvss_severity').nullable();
      t.text('affected_products').nullable();
      t.string('published_at').nullable();
      t.string('modified_at').nullable();
      t.integer('patch_available').notNullable().defaultTo(0);
      t.timestamp('synced_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('cve_techniques', t => {
      t.string('cve_id').notNullable();
      t.string('technique_id').notNullable();
      t.primary(['cve_id', 'technique_id']);
    })
    .createTableIfNotExists('indicators', t => {
      t.increments('id').primary();
      t.string('type').notNullable();
      t.string('value').notNullable();
      t.string('group_id').nullable();
      t.string('technique_id').nullable();
      t.string('confidence').notNullable().defaultTo('medium');
      t.text('notes').nullable();
      t.string('first_seen').nullable();
      t.string('last_seen').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
```

- [ ] **Step 2: Write campaigns tests**

```typescript
// server/src/__tests__/campaigns.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import campaignsRouter from '../routes/campaigns';
import type { Knex as KnexType } from 'knex';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  const dbModule = await import('../db/database');
  (dbModule as any)._instance = db;
  // Seed a threat group
  await db.raw("INSERT INTO threat_groups (id, name, aliases) VALUES ('APT29', 'Cozy Bear', '[]')");
  app = createTestApp(['/api/campaigns', campaignsRouter]);
});

afterAll(async () => { await db.destroy(); });

describe('GET /api/campaigns', () => {
  it('requires group_id', async () => {
    await request(app).get('/api/campaigns').expect(400);
  });

  it('returns empty array for group with no campaigns', async () => {
    const res = await request(app).get('/api/campaigns?group_id=APT29').expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/campaigns', () => {
  it('creates a campaign with techniques', async () => {
    const res = await request(app).post('/api/campaigns').send({
      group_id: 'APT29',
      name: 'SolarWinds 2020',
      start_date: '2020-03-01',
      end_date: '2020-12-31',
      technique_ids: ['T1195', 'T1027'],
    }).expect(201);
    expect(res.body.name).toBe('SolarWinds 2020');
    expect(res.body.technique_ids).toEqual(['T1195', 'T1027']);
  });

  it('rejects campaign for nonexistent group', async () => {
    await request(app).post('/api/campaigns').send({ group_id: 'NONEXISTENT', name: 'Test' }).expect(404);
  });
});
```

- [ ] **Step 3: Write CVE tests**

```typescript
// server/src/__tests__/cves.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import cvesRouter from '../routes/cves';
import type { Knex as KnexType } from 'knex';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  const dbModule = await import('../db/database');
  (dbModule as any)._instance = db;
  app = createTestApp(['/api/cves', cvesRouter]);
});

afterAll(async () => { await db.destroy(); });

describe('POST /api/cves', () => {
  it('creates a CVE record', async () => {
    const res = await request(app).post('/api/cves').send({
      id: 'CVE-2021-44228',
      description: 'Log4Shell RCE',
      cvss_score: 10.0,
      cvss_severity: 'CRITICAL',
      technique_ids: ['T1190'],
    }).expect(201);
    expect(res.body.id).toBe('CVE-2021-44228');
    expect(res.body.cvss_score).toBe(10.0);
  });

  it('rejects invalid CVE ID format', async () => {
    await request(app).post('/api/cves').send({ id: 'NOT-A-CVE', description: 'Bad' }).expect(400);
  });
});

describe('GET /api/cves?technique_id=', () => {
  it('returns CVEs linked to a technique', async () => {
    const res = await request(app).get('/api/cves?technique_id=T1190').expect(200);
    expect(res.body.some((c: any) => c.id === 'CVE-2021-44228')).toBe(true);
  });
});
```

- [ ] **Step 4: Write indicator tests**

```typescript
// server/src/__tests__/indicators.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import indicatorsRouter from '../routes/indicators';
import type { Knex as KnexType } from 'knex';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  const dbModule = await import('../db/database');
  (dbModule as any)._instance = db;
  app = createTestApp(['/api/indicators', indicatorsRouter]);
});

afterAll(async () => { await db.destroy(); });

describe('IOC CRUD', () => {
  let iocId: number;

  it('creates an IP indicator', async () => {
    const res = await request(app).post('/api/indicators').send({
      type: 'ip', value: '185.220.101.1', confidence: 'high', notes: 'C2 server',
    }).expect(201);
    expect(res.body.type).toBe('ip');
    expect(res.body.value).toBe('185.220.101.1');
    iocId = res.body.id;
  });

  it('rejects invalid type', async () => {
    await request(app).post('/api/indicators').send({ type: 'phone', value: '555-1234' }).expect(400);
  });

  it('lists indicators', async () => {
    const res = await request(app).get('/api/indicators').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('deletes an indicator', async () => {
    await request(app).delete(`/api/indicators/${iocId}`).expect(204);
  });
});

describe('STIX export', () => {
  it('returns a STIX bundle', async () => {
    await request(app).post('/api/indicators').send({ type: 'domain', value: 'evil.example.com' });
    const res = await request(app).get('/api/indicators/export/stix').expect(200);
    expect(res.body.type).toBe('bundle');
    expect(res.body.spec_version).toBe('2.1');
  });
});
```

- [ ] **Step 5: Run all tests**

```bash
cd server && npm test -- campaigns cves indicators
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/__tests__/helpers/testDb.ts server/src/__tests__/campaigns.test.ts server/src/__tests__/cves.test.ts server/src/__tests__/indicators.test.ts
git commit -m "test: add campaigns, CVE, and indicator tests"
```

---

### Task 6: Frontend — Campaigns tab on ThreatGroups

**Files:**
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/pages/ThreatGroups.tsx`

- [ ] **Step 1: Add Campaign and Indicator types**

```typescript
// Add to client/src/types.ts:
export interface Campaign {
  id: number;
  group_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  source_url: string | null;
  technique_ids: string[];
  created_at: string;
}

export interface Indicator {
  id: number;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email';
  value: string;
  group_id: string | null;
  technique_id: string | null;
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
  first_seen: string | null;
  last_seen: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Add API methods**

```typescript
// Add to api.ts:
  getCampaigns: (groupId: string) => get<Campaign[]>(`/campaigns?group_id=${encodeURIComponent(groupId)}`),
  createCampaign: (data: any) => post<Campaign>('/campaigns', data),
  updateCampaign: (id: number, data: any) => put<Campaign>(`/campaigns/${id}`, data),
  deleteCampaign: (id: number) => del<void>(`/campaigns/${id}`),
  getIndicators: (groupId: string) => get<Indicator[]>(`/indicators?group_id=${encodeURIComponent(groupId)}`),
  createIndicator: (data: any) => post<Indicator>('/indicators', data),
  deleteIndicator: (id: number) => del<void>(`/indicators/${id}`),
  exportIndicatorsStix: (groupId?: string) => {
    const url = groupId ? `/api/indicators/export/stix?group_id=${encodeURIComponent(groupId)}` : '/api/indicators/export/stix';
    const a = document.createElement('a'); a.href = url; a.download = 'indicators.stix.json'; a.click();
  },
```

- [ ] **Step 3: Add Campaigns and IOC tabs to ThreatGroups page**

In `ThreatGroups.tsx`, the group detail pane has existing tabs (Techniques, Procedures, Coverage). Add two more tabs:

Find the existing tab list in the detail pane. Add:
```tsx
const [detailTab, setDetailTab] = useState<'techniques' | 'procedures' | 'coverage' | 'campaigns' | 'iocs'>('techniques');
```

Add tab buttons for 'campaigns' and 'iocs'.

Add campaign state:
```tsx
const [campaigns, setCampaigns] = useState<Campaign[]>([]);
const [indicators, setIndicators] = useState<Indicator[]>([]);
const [addCampaignOpen, setAddCampaignOpen] = useState(false);
const [campaignForm, setCampaignForm] = useState({ name: '', description: '', start_date: '', end_date: '', source_url: '' });
const [addIocOpen, setAddIocOpen] = useState(false);
const [iocForm, setIocForm] = useState({ type: 'ip', value: '', confidence: 'medium', notes: '' });
```

Load campaigns and indicators when a group is selected:
```tsx
useEffect(() => {
  if (!selectedGroup) return;
  api.getCampaigns(selectedGroup.id).then(setCampaigns).catch(() => {});
  api.getIndicators(selectedGroup.id).then(setIndicators).catch(() => {});
}, [selectedGroup?.id]);
```

Campaigns tab content:
```tsx
{detailTab === 'campaigns' && (
  <div className="space-y-3">
    <div className="flex justify-end">
      <button onClick={() => setAddCampaignOpen(true)}
        className="text-xs px-2.5 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors">
        + Add Campaign
      </button>
    </div>
    {campaigns.length === 0 && !addCampaignOpen && (
      <div className="text-xs text-gray-400 dark:text-slate-600 py-6 text-center">No campaigns recorded.</div>
    )}
    {campaigns.map(c => (
      <div key={c.id} className="bg-gray-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{c.name}</div>
            {(c.start_date || c.end_date) && (
              <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {c.start_date ?? '?'} → {c.end_date ?? 'ongoing'}
              </div>
            )}
            {c.description && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">{c.description}</div>}
            <div className="flex flex-wrap gap-1 mt-2">
              {c.technique_ids.map(tid => (
                <span key={tid} className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-mono">{tid}</span>
              ))}
            </div>
          </div>
          <button onClick={async () => { await api.deleteCampaign(c.id); setCampaigns(prev => prev.filter(x => x.id !== c.id)); }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors ml-2">Delete</button>
        </div>
        {c.source_url && (
          <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 block">Source →</a>
        )}
      </div>
    ))}
    {addCampaignOpen && (
      <div className="bg-gray-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-gray-200 dark:border-slate-700 space-y-2">
        <input type="text" value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="Campaign name *"
          className="w-full text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(f => ({ ...f, start_date: e.target.value }))} placeholder="Start date"
            className="text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
          <input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(f => ({ ...f, end_date: e.target.value }))} placeholder="End date"
            className="text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
        </div>
        <input type="text" value={campaignForm.source_url} onChange={e => setCampaignForm(f => ({ ...f, source_url: e.target.value }))} placeholder="Source URL"
          className="w-full text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none" />
        <div className="flex justify-end gap-2">
          <button onClick={() => setAddCampaignOpen(false)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Cancel</button>
          <button onClick={async () => {
            if (!campaignForm.name.trim() || !selectedGroup) return;
            const c = await api.createCampaign({ group_id: selectedGroup.id, ...campaignForm });
            setCampaigns(prev => [...prev, c]);
            setAddCampaignOpen(false);
            setCampaignForm({ name: '', description: '', start_date: '', end_date: '', source_url: '' });
          }} className="text-xs px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors">Save</button>
        </div>
      </div>
    )}
  </div>
)}
```

IOC tab content:
```tsx
{detailTab === 'iocs' && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <button onClick={() => setAddIocOpen(true)}
        className="text-xs px-2.5 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors">
        + Add IOC
      </button>
      {indicators.length > 0 && (
        <button onClick={() => selectedGroup && api.exportIndicatorsStix(selectedGroup.id)}
          className="text-xs px-2.5 py-1.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
          Export STIX
        </button>
      )}
    </div>
    {indicators.length === 0 && !addIocOpen && (
      <div className="text-xs text-gray-400 dark:text-slate-600 py-6 text-center">No indicators recorded.</div>
    )}
    <div className="space-y-1">
      {indicators.map(ioc => (
        <div key={ioc.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-slate-800/50">
          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded w-12 text-center flex-shrink-0">{ioc.type}</span>
          <span className="text-xs font-mono text-gray-700 dark:text-slate-300 flex-1 truncate">{ioc.value}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${ioc.confidence === 'high' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ioc.confidence === 'low' ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-slate-600' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>{ioc.confidence}</span>
          <button onClick={async () => { await api.deleteIndicator(ioc.id); setIndicators(prev => prev.filter(i => i.id !== ioc.id)); }}
            className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex-shrink-0">✕</button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/types.ts client/src/api.ts client/src/pages/ThreatGroups.tsx
git commit -m "feat: add Campaigns and IOC tabs to Threat Groups page"
```

---

### Task 7: CVE column on Gap Analysis

**Files:**
- Modify: `client/src/pages/GapAnalysis.tsx`

- [ ] **Step 1: Add CVE summary to gap rows**

Add to the imports in GapAnalysis.tsx:
```typescript
import type { GapTechnique } from '../types'; // already imported
```

Add CVE state to the component:
```tsx
const [cveSummary, setCveSummary] = useState<Map<string, { cve_count: number; max_cvss: number }>>(new Map());
```

Load CVE gap summary on mount:
```tsx
useEffect(() => {
  api.getCveGapSummary().catch(() => []).then((rows: any[]) => {
    const map = new Map<string, { cve_count: number; max_cvss: number }>();
    for (const r of rows) map.set(r.technique_id, { cve_count: r.cve_count, max_cvss: r.max_cvss ?? 0 });
    setCveSummary(map);
  });
}, []);
```

Add API method:
```typescript
  getCveGapSummary: () => get<any[]>('/cves/gap-summary'),
```

In the gap row, add a CVE badge next to the priority score:
```tsx
{(() => {
  const cve = cveSummary.get(g.id);
  if (!cve || cve.cve_count === 0) return null;
  const severity = cve.max_cvss >= 9 ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : cve.max_cvss >= 7 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${severity}`} title={`${cve.cve_count} CVE(s) — Max CVSS: ${cve.max_cvss}`}>
      CVE·{cve.cve_count}
    </span>
  );
})()}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/GapAnalysis.tsx client/src/api.ts
git commit -m "feat: add CVE indicator badges on Gap Analysis page"
```

---

### Task 8: ATT&CK group import from MITRE catalogue

**Files:**
- Modify: `server/src/routes/threat-groups.ts`
- Modify: `client/src/pages/ThreatGroups.tsx`

- [ ] **Step 1: Add bulk import endpoint**

In `server/src/routes/threat-groups.ts`, add:
```typescript
// GET /api/threat-groups/mitre-catalogue — returns all MITRE groups from the STIX data
router.get('/mitre-catalogue', async (req, res) => {
  try {
    const { fetchStixBundle } = await import('../data/stix-fetch');
    const bundle = await fetchStixBundle(); // returns parsed STIX bundle
    const groups = (bundle.objects ?? [])
      .filter((o: any) => o.type === 'intrusion-set')
      .map((g: any) => ({
        id: g.external_references?.find((r: any) => r.source_name === 'mitre-attack')?.external_id ?? g.id,
        name: g.name,
        aliases: g.aliases ?? [],
        description: g.description ?? null,
        url: g.external_references?.find((r: any) => r.source_name === 'mitre-attack')?.url ?? null,
      }));
    res.json(groups);
  } catch (e: any) {
    res.status(500).json({ error: `Failed to fetch MITRE catalogue: ${e.message}` });
  }
});
```

- [ ] **Step 2: Add "Import from ATT&CK" button to ThreatGroups page**

In `ThreatGroups.tsx`, add state:
```tsx
const [importCatalogueOpen, setImportCatalogueOpen] = useState(false);
const [catalogue, setCatalogue] = useState<Array<{ id: string; name: string; aliases: string[] }>>([]);
const [catalogueLoading, setCatalogueLoading] = useState(false);
const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set());
const [importing, setImporting] = useState(false);
const [catalogueSearch, setCatalogueSearch] = useState('');
```

Add handler:
```tsx
async function loadCatalogue() {
  setCatalogueLoading(true);
  try {
    const all = await api.getMitreCatalogue();
    const existing = new Set(threatGroups.map((g: any) => g.id));
    setCatalogue(all.filter((g: any) => !existing.has(g.id)));
  } catch (e: any) { toast(e.message, 'error'); }
  finally { setCatalogueLoading(false); }
}

async function importSelected() {
  setImporting(true);
  let count = 0;
  for (const gid of selectedImport) {
    const g = catalogue.find(c => c.id === gid);
    if (!g) continue;
    try {
      await api.createThreatGroup({
        id: g.id, name: g.name, aliases: g.aliases, description: g.description,
        url: g.url, technique_ids: [],
      });
      count++;
    } catch { /* skip if already exists */ }
  }
  toast(`Imported ${count} group(s)`);
  setImportCatalogueOpen(false);
  setSelectedImport(new Set());
  api.getThreatGroups().then(setThreatGroups).catch(() => {});
  setImporting(false);
}
```

Add button near the "New Group" button in the page header, and the catalogue modal similarly to other modals in the file (uses the existing Modal component).

Add API method:
```typescript
  getMitreCatalogue: () => get<any[]>('/threat-groups/mitre-catalogue'),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/threat-groups.ts client/src/pages/ThreatGroups.tsx client/src/api.ts
git commit -m "feat: add MITRE ATT&CK catalogue import and campaigns/IOC UI"
```

---

### Task 9: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test campaigns**

Navigate to `/threats`. Select a threat group. In the detail panel, find the Campaigns tab. Add a campaign with a name and date range. Confirm it persists on reload.

- [ ] **Step 3: Test CVE badges**

Navigate to `/gaps`. If any CVE data has been imported (via POST /api/cves), CVE badges should appear in the gap rows.

- [ ] **Step 4: Test IOC STIX export**

Navigate to `/threats`. Select a group. In the IOCs tab, add an indicator. Click "Export STIX" — a `.stix.json` file should download.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Section 4 — Intelligence Depth (campaigns, CVEs, IOCs, catalogue import)"
```
