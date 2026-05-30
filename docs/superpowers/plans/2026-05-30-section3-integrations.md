# SIEM Integrations & External Connectors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a SIEM integrations system supporting push/pull for Sentinel, Splunk, Elastic, CrowdStrike, QRadar, and Google SecOps; a GitHub SIGMA sync; and Jira/ServiceNow ticketing connectors. All integrations follow the TAXII review model: changes are staged for analyst review before anything is committed.

**Architecture:** A new `siem_integrations` table stores connection configs with AES-256-GCM encrypted credentials. SIGMA translation is done via `sigma-cli` Python tool invoked as a child process — it must be installed in the Docker image and locally for dev. A new `Integrations` page in the frontend manages all connectors. Push operations stage a diff for review; pull operations update detection status fields.

**Tech Stack:** Node.js `child_process.spawn`, `crypto` (built-in, AES-256-GCM), Knex migration, Express routes, React page. Python 3 + sigma-cli required in the runtime environment.

**Pre-requisite:** sigma-cli must be installed. Run: `pip install sigma-cli pySigma-backend-splunk pySigma-backend-elasticsearch pySigma-backend-microsoft365defender pySigma-backend-crowdstrike pySigma-backend-qradar pySigma-backend-chronicle`

---

## File Map

| File | Action |
|------|--------|
| `server/src/db/migrations/018_siem_integrations.ts` | Create — siem_integrations, siem_sync_log, github_sync_configs, ticketing_configs tables |
| `server/src/integrations/crypto.ts` | Create — AES-256-GCM encrypt/decrypt helpers |
| `server/src/integrations/sigma-translator.ts` | Create — sigma-cli subprocess wrapper |
| `server/src/integrations/siem/sentinel.ts` | Create — Azure Monitor REST API push/pull |
| `server/src/integrations/siem/splunk.ts` | Create — Splunk REST API push/pull |
| `server/src/integrations/siem/elastic.ts` | Create — Elastic Detection Engine push/pull |
| `server/src/integrations/siem/crowdstrike.ts` | Create — CrowdStrike IOA push/pull |
| `server/src/integrations/siem/qradar.ts` | Create — QRadar REST API push/pull |
| `server/src/integrations/siem/chronicle.ts` | Create — Google SecOps Chronicle API push/pull |
| `server/src/integrations/github-sync.ts` | Create — GitHub repo polling + SIGMA import staging |
| `server/src/integrations/ticketing.ts` | Create — Jira + ServiceNow connector |
| `server/src/routes/integrations.ts` | Create — REST routes for all integration CRUD + push/pull/sync |
| `server/src/index.ts` | Modify — register integrations router |
| `server/src/__tests__/helpers/testDb.ts` | Modify — add new integration tables |
| `server/src/__tests__/integrations.test.ts` | Create — route tests (config CRUD, no external calls) |
| `Dockerfile` | Modify — install Python pip + sigma-cli backends |
| `client/src/types.ts` | Modify — add SiemIntegration, GithubSyncConfig, TicketingConfig types |
| `client/src/api.ts` | Modify — add integration API calls |
| `client/src/pages/Integrations.tsx` | Create — integrations management page |
| `client/src/App.tsx` | Modify — add `/integrations` route |
| `client/src/components/Sidebar.tsx` | Modify — add Integrations nav item under System |

---

### Task 1: DB migration for integration tables

**Files:**
- Create: `server/src/db/migrations/018_siem_integrations.ts`

- [ ] **Step 1: Create migration**

```typescript
// server/src/db/migrations/018_siem_integrations.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTableIfNotExists('siem_integrations', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable(); // sentinel | splunk | elastic | crowdstrike | qradar | chronicle
      t.text('config').notNullable().defaultTo('{}'); // JSON, type-specific fields
      t.text('credentials_enc').nullable(); // AES-256-GCM encrypted JSON: { iv, tag, data }
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_push_status').nullable(); // ok | error
      t.string('last_push_error').nullable();
      t.timestamp('last_pushed_at').nullable();
      t.string('last_pull_status').nullable();
      t.string('last_pull_error').nullable();
      t.timestamp('last_pulled_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('siem_sync_log', t => {
      t.increments('id').primary();
      t.integer('integration_id').notNullable()
        .references('id').inTable('siem_integrations').onDelete('CASCADE');
      t.string('direction').notNullable(); // push | pull
      t.string('status').notNullable();    // ok | error
      t.integer('items_affected').notNullable().defaultTo(0);
      t.text('detail').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('github_sync_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('repo_url').notNullable();  // https://github.com/org/repo
      t.string('branch').notNullable().defaultTo('main');
      t.string('path_glob').notNullable().defaultTo('**/*.yml');
      t.text('token_enc').nullable();      // encrypted GitHub PAT
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_sha').nullable();     // last processed commit SHA
      t.timestamp('last_synced_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('ticketing_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable();      // jira | servicenow
      t.string('base_url').notNullable();
      t.text('credentials_enc').nullable(); // encrypted { username, token } or { token }
      t.string('default_project').nullable(); // Jira project key or ServiceNow assignment group
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists('siem_sync_log')
    .dropTableIfExists('siem_integrations')
    .dropTableIfExists('github_sync_configs')
    .dropTableIfExists('ticketing_configs');
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npm run migrate
```
Expected: `Batch 16 run: 1 migrations`

- [ ] **Step 3: Commit**

```bash
git add server/src/db/migrations/018_siem_integrations.ts
git commit -m "feat: add SIEM integration tables migration"
```

---

### Task 2: AES-256-GCM credential encryption

**Files:**
- Create: `server/src/integrations/crypto.ts`

- [ ] **Step 1: Create encrypt/decrypt helpers**

```typescript
// server/src/integrations/crypto.ts
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';

// Derive a 32-byte key from JWT_SECRET. Salt is fixed so the same secret always produces the same key.
function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? 'dev-insecure-key-change-me';
  return scryptSync(secret, 'mitremap-siem-credentials', 32);
}

export interface EncryptedPayload {
  iv: string;   // hex
  tag: string;  // hex (GCM auth tag)
  data: string; // hex (ciphertext)
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = deriveKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: encrypted.toString('hex'),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = deriveKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const data = Buffer.from(payload.data, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptJson(obj: Record<string, string>): string {
  return JSON.stringify(encrypt(JSON.stringify(obj)));
}

export function decryptJson(encStr: string): Record<string, string> {
  const payload: EncryptedPayload = JSON.parse(encStr);
  return JSON.parse(decrypt(payload));
}
```

- [ ] **Step 2: Write tests**

```typescript
// server/src/__tests__/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptJson, decryptJson } from '../integrations/crypto';

describe('encrypt/decrypt', () => {
  it('round-trips a string', () => {
    const payload = encrypt('hello world');
    expect(decrypt(payload)).toBe('hello world');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const p1 = encrypt('same');
    const p2 = encrypt('same');
    expect(p1.data).not.toBe(p2.data);
  });
});

describe('encryptJson/decryptJson', () => {
  it('round-trips a JSON object', () => {
    const obj = { token: 'secret-token', user: 'admin' };
    const enc = encryptJson(obj);
    expect(decryptJson(enc)).toEqual(obj);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd server && npm test -- crypto
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/integrations/crypto.ts server/src/__tests__/crypto.test.ts
git commit -m "feat: add AES-256-GCM credential encryption helpers"
```

---

### Task 3: SIGMA translator (sigma-cli subprocess)

**Files:**
- Create: `server/src/integrations/sigma-translator.ts`

- [ ] **Step 1: Create translator**

```typescript
// server/src/integrations/sigma-translator.ts
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export type SiemBackend = 'splunk' | 'elasticsearch' | 'microsoft365defender' | 'crowdstrike' | 'qradar' | 'chronicle';

const BACKEND_PIPELINE: Record<SiemBackend, string[]> = {
  splunk: ['splunk'],
  elasticsearch: ['ecs_windows'],
  microsoft365defender: ['microsoft365defender'],
  crowdstrike: ['crowdstrike'],
  qradar: ['qradar'],
  chronicle: ['chronicle_contextual'],
};

/**
 * Translates a SIGMA YAML rule string to a target query language via sigma-cli.
 * Returns the translated rule string or throws if sigma-cli is not installed or translation fails.
 */
export async function translateSigma(sigmaYaml: string, backend: SiemBackend): Promise<string> {
  const tmpFile = join(tmpdir(), `mitremap-sigma-${randomBytes(6).toString('hex')}.yml`);
  await writeFile(tmpFile, sigmaYaml, 'utf8');

  try {
    const pipeline = BACKEND_PIPELINE[backend];
    const args = ['convert', '-t', backend, ...pipeline.flatMap(p => ['-p', p]), tmpFile];

    return await new Promise<string>((resolve, reject) => {
      const proc = spawn('sigma', args, { env: process.env });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code !== 0) reject(new Error(`sigma-cli exited with code ${code}: ${stderr.trim()}`));
        else resolve(stdout.trim());
      });
      proc.on('error', (err) => {
        if ((err as any).code === 'ENOENT') reject(new Error('sigma-cli not found. Install with: pip install sigma-cli'));
        else reject(err);
      });
    });
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/** Returns true if sigma-cli is available in the PATH */
export async function isSigmaAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn('sigma', ['--version'], { env: process.env });
    proc.on('close', code => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/integrations/sigma-translator.ts
git commit -m "feat: add sigma-cli subprocess wrapper for SIGMA translation"
```

---

### Task 4: SIEM connector implementations

**Files:**
- Create: `server/src/integrations/siem/sentinel.ts`
- Create: `server/src/integrations/siem/splunk.ts`
- Create: `server/src/integrations/siem/elastic.ts`
- Create: `server/src/integrations/siem/crowdstrike.ts`
- Create: `server/src/integrations/siem/qradar.ts`
- Create: `server/src/integrations/siem/chronicle.ts`

Each connector exports `testConnection`, `pushRule`, and `pullStatuses` with a consistent interface.

- [ ] **Step 1: Create shared interface file**

```typescript
// server/src/integrations/siem/types.ts
export interface SiemConnector {
  testConnection(): Promise<{ ok: boolean; message: string }>;
  pushRule(detection: { id: number; name: string; sigmaYaml: string }): Promise<{ ok: boolean; remoteId?: string; message: string }>;
  pullStatuses(): Promise<Array<{ remote_id: string; enabled: boolean; fire_count?: number }>>;
}

export interface SiemConfig {
  [key: string]: string; // type-specific config fields
}
```

- [ ] **Step 2: Create sentinel.ts**

```typescript
// server/src/integrations/siem/sentinel.ts
import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createSentinelConnector(config: {
  tenant_id: string;
  client_id: string;
  client_secret: string;
  subscription_id: string;
  resource_group: string;
  workspace_name: string;
}): SiemConnector {
  const ARM_BASE = 'https://management.azure.com';

  async function getToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.client_id,
      client_secret: config.client_secret,
      scope: 'https://management.azure.com/.default',
    });
    const res = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const json = await res.json() as any;
    return json.access_token;
  }

  const workspacePath = `/subscriptions/${config.subscription_id}/resourceGroups/${config.resource_group}/providers/Microsoft.OperationalInsights/workspaces/${config.workspace_name}`;
  const alertRulesPath = `${workspacePath}/providers/Microsoft.SecurityInsights/alertRules`;

  return {
    async testConnection() {
      try {
        const token = await getToken();
        const res = await fetch(`${ARM_BASE}${alertRulesPath}?api-version=2023-02-01`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) {
        return { ok: false, message: e.message };
      }
    },

    async pushRule(detection) {
      const kql = await translateSigma(detection.sigmaYaml, 'microsoft365defender');
      const token = await getToken();
      const ruleId = `mitremap-${detection.id}`;
      const body = {
        kind: 'Scheduled',
        properties: {
          displayName: detection.name,
          query: kql,
          queryFrequency: 'PT5M',
          queryPeriod: 'PT1H',
          triggerOperator: 'GreaterThan',
          triggerThreshold: 0,
          severity: 'Medium',
          enabled: true,
        },
      };
      const res = await fetch(`${ARM_BASE}${alertRulesPath}/${ruleId}?api-version=2023-02-01`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ok = res.ok || res.status === 201;
      return { ok, remoteId: ruleId, message: ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },

    async pullStatuses() {
      const token = await getToken();
      const res = await fetch(`${ARM_BASE}${alertRulesPath}?api-version=2023-02-01`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.value ?? [])
        .filter((r: any) => r.name?.startsWith('mitremap-'))
        .map((r: any) => ({
          remote_id: r.name,
          enabled: r.properties?.enabled ?? false,
        }));
    },
  };
}
```

- [ ] **Step 3: Create splunk.ts**

```typescript
// server/src/integrations/siem/splunk.ts
import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createSplunkConnector(config: {
  base_url: string;  // e.g. https://splunk.example.com:8089
  token: string;     // Splunk HEC or REST API token
  app: string;       // Splunk app context, e.g. 'search'
}): SiemConnector {
  const headers = () => ({
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  });

  return {
    async testConnection() {
      try {
        const res = await fetch(`${config.base_url}/services/apps/local`, { headers: headers() });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) {
        return { ok: false, message: e.message };
      }
    },

    async pushRule(detection) {
      const spl = await translateSigma(detection.sigmaYaml, 'splunk');
      const searchName = `mitremap-${detection.id}-${detection.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`;
      const body = new URLSearchParams({
        name: searchName,
        search: spl,
        dispatch_earliest_time: '-1h',
        dispatch_latest_time: 'now',
        is_scheduled: '1',
        cron_schedule: '*/5 * * * *',
        output_mode: 'json',
      });
      const res = await fetch(`${config.base_url}/servicesNS/nobody/${config.app}/saved/searches`, {
        method: 'POST',
        headers: headers(),
        body,
      });
      const ok = res.ok || res.status === 409; // 409 = already exists
      return { ok, remoteId: searchName, message: ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },

    async pullStatuses() {
      const res = await fetch(
        `${config.base_url}/servicesNS/nobody/${config.app}/saved/searches?output_mode=json&search=mitremap-`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.entry ?? []).map((e: any) => ({
        remote_id: e.name,
        enabled: e.content?.disabled === '0' || e.content?.disabled === false,
      }));
    },
  };
}
```

- [ ] **Step 4: Create elastic.ts**

```typescript
// server/src/integrations/siem/elastic.ts
import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createElasticConnector(config: {
  base_url: string; // e.g. https://kibana.example.com:5601
  api_key: string;  // base64 encoded Elasticsearch API key
  space_id?: string;
}): SiemConnector {
  const spacePrefix = config.space_id ? `/s/${config.space_id}` : '';
  const headers = () => ({
    Authorization: `ApiKey ${config.api_key}`,
    'Content-Type': 'application/json',
    'kbn-xsrf': 'true',
  });

  return {
    async testConnection() {
      try {
        const res = await fetch(`${config.base_url}${spacePrefix}/api/detection_engine/rules/_find?per_page=1`, { headers: headers() });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) {
        return { ok: false, message: e.message };
      }
    },

    async pushRule(detection) {
      const eql = await translateSigma(detection.sigmaYaml, 'elasticsearch');
      const ruleId = `mitremap-${detection.id}`;
      const body = {
        rule_id: ruleId,
        name: detection.name,
        type: 'eql',
        query: eql,
        language: 'eql',
        index: ['logs-*', 'winlogbeat-*'],
        enabled: true,
        severity: 'medium',
        risk_score: 47,
        from: 'now-1h',
        interval: '5m',
      };
      const res = await fetch(`${config.base_url}${spacePrefix}/api/detection_engine/rules`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const ok = res.ok;
      return { ok, remoteId: ruleId, message: ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },

    async pullStatuses() {
      const res = await fetch(
        `${config.base_url}${spacePrefix}/api/detection_engine/rules/_find?filter=alert.attributes.tags:%22mitremap%22&per_page=100`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.data ?? [])
        .filter((r: any) => r.rule_id?.startsWith('mitremap-'))
        .map((r: any) => ({ remote_id: r.rule_id, enabled: r.enabled ?? false }));
    },
  };
}
```

- [ ] **Step 5: Create chronicle.ts**

```typescript
// server/src/integrations/siem/chronicle.ts
import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createChronicleConnector(config: {
  project_id: string;
  instance_id: string;
  region: string;      // e.g. 'us', 'eu', 'asia-southeast1'
  service_account_json: string; // JSON string of the service account key
}): SiemConnector {
  // Google Chronicle API v1alpha
  const baseUrl = `https://${config.region}-chronicle.googleapis.com/v1alpha/projects/${config.project_id}/locations/${config.region}/instances/${config.instance_id}`;

  async function getToken(): Promise<string> {
    // Use Google's token endpoint with a JWT assertion from the service account
    const sa = JSON.parse(config.service_account_json);
    const now = Math.floor(Date.now() / 1000);
    const { createSign } = await import('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: 'https://www.googleapis.com/auth/chronicle-backstory',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(sa.private_key).toString('base64url');
    const jwt = `${header}.${payload}.${sig}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    });
    if (!res.ok) throw new Error(`Chronicle auth failed: ${res.status}`);
    const json = await res.json() as any;
    return json.access_token;
  }

  return {
    async testConnection() {
      try {
        const token = await getToken();
        const res = await fetch(`${baseUrl}/rules?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) {
        return { ok: false, message: e.message };
      }
    },

    async pushRule(detection) {
      const yaraL = await translateSigma(detection.sigmaYaml, 'chronicle');
      const token = await getToken();
      const body = { displayName: `mitremap-${detection.id}: ${detection.name}`, text: yaraL };
      const res = await fetch(`${baseUrl}/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ok = res.ok;
      let remoteId: string | undefined;
      if (ok) { const j = await res.json() as any; remoteId = j.name; }
      return { ok, remoteId, message: ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },

    async pullStatuses() {
      const token = await getToken();
      const res = await fetch(`${baseUrl}/rules?pageSize=1000`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
      const json = await res.json() as any;
      return (json.rules ?? [])
        .filter((r: any) => r.displayName?.startsWith('mitremap-'))
        .map((r: any) => ({
          remote_id: r.name,
          enabled: r.deploymentState === 'ACTIVE',
        }));
    },
  };
}
```

- [ ] **Step 6: Create crowdstrike.ts and qradar.ts** (abbreviated — follow same pattern)

```typescript
// server/src/integrations/siem/crowdstrike.ts
import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createCrowdStrikeConnector(config: {
  client_id: string;
  client_secret: string;
  base_url?: string; // defaults to https://api.crowdstrike.com
}): SiemConnector {
  const base = config.base_url ?? 'https://api.crowdstrike.com';

  async function getToken(): Promise<string> {
    const body = new URLSearchParams({ client_id: config.client_id, client_secret: config.client_secret });
    const res = await fetch(`${base}/oauth2/token`, { method: 'POST', body });
    if (!res.ok) throw new Error(`CrowdStrike auth failed: ${res.status}`);
    const j = await res.json() as any;
    return j.access_token;
  }

  return {
    async testConnection() {
      try { await getToken(); return { ok: true, message: 'Connected' }; }
      catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      // CrowdStrike Custom IOA rules require a rule group; simplified push creates a rule in a MitreMap group
      const token = await getToken();
      const query = await translateSigma(detection.sigmaYaml, 'crowdstrike');
      const body = { name: `mitremap-${detection.id}`, description: detection.name, pattern: query };
      const res = await fetch(`${base}/ioarules/entities/rules/v1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const token = await getToken();
      const res = await fetch(`${base}/ioarules/entities/rules/GET/v1?filter=name:'mitremap-'`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const j = await res.json() as any;
      return (j.resources ?? []).map((r: any) => ({ remote_id: String(r.id), enabled: r.enabled ?? false }));
    },
  };
}
```

```typescript
// server/src/integrations/siem/qradar.ts
import { translateSigma } from '../sigma-translator';
import type { SiemConnector } from './types';

export function createQRadarConnector(config: {
  base_url: string; // e.g. https://qradar.example.com
  token: string;    // QRadar REST API Security Token (SEC header)
}): SiemConnector {
  const headers = () => ({ SEC: config.token, 'Content-Type': 'application/json', Accept: 'application/json' });

  return {
    async testConnection() {
      try {
        const res = await fetch(`${config.base_url}/api/system/about`, { headers: headers() });
        return { ok: res.ok, message: res.ok ? 'Connected' : `HTTP ${res.status}` };
      } catch (e: any) { return { ok: false, message: e.message }; }
    },
    async pushRule(detection) {
      const aql = await translateSigma(detection.sigmaYaml, 'qradar');
      const body = { name: `mitremap-${detection.id}`, aql_query: aql, enabled: true };
      const res = await fetch(`${config.base_url}/api/analytics/rules`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      });
      return { ok: res.ok, message: res.ok ? 'Rule pushed' : `HTTP ${res.status}` };
    },
    async pullStatuses() {
      const res = await fetch(`${config.base_url}/api/analytics/rules?filter=name LIKE 'mitremap-%'`, { headers: headers() });
      if (!res.ok) return [];
      const rules = await res.json() as any[];
      return rules.map((r: any) => ({ remote_id: String(r.id), enabled: r.enabled ?? false }));
    },
  };
}
```

- [ ] **Step 7: Commit all SIEM connectors**

```bash
git add server/src/integrations/
git commit -m "feat: add SIEM connector implementations (Sentinel, Splunk, Elastic, CrowdStrike, QRadar, Chronicle)"
```

---

### Task 5: GitHub SIGMA sync

**Files:**
- Create: `server/src/integrations/github-sync.ts`

- [ ] **Step 1: Create the sync module**

```typescript
// server/src/integrations/github-sync.ts
import { getKnex, rawAll, rawGet, rawRun } from '../db/database';
import type { Knex as KnexType } from 'knex';

interface GithubSyncConfig {
  id: number;
  repo_url: string;
  branch: string;
  path_glob: string;
  token_enc: string | null;
  last_sha: string | null;
}

/** Convert a github.com URL to the REST API base */
function toApiBase(repoUrl: string): string {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Cannot parse GitHub repo URL: ${repoUrl}`);
  return `https://api.github.com/repos/${match[1].replace(/\.git$/, '')}`;
}

/** Fetch the latest commit SHA for a branch */
async function getLatestSha(apiBase: string, branch: string, token: string | null): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBase}/commits/${branch}`, { headers });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const j = await res.json() as any;
  return j.sha;
}

/** Fetch changed .yml files between two SHAs (or all .yml files if no lastSha) */
async function getChangedYmlFiles(
  apiBase: string, branch: string, lastSha: string | null, token: string | null
): Promise<Array<{ path: string; content: string }>> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (!lastSha) {
    // First sync — get file tree
    const treeRes = await fetch(`${apiBase}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error(`GitHub tree error: ${treeRes.status}`);
    const tree = await treeRes.json() as any;
    const ymlPaths = (tree.tree ?? []).filter((f: any) => f.type === 'blob' && f.path.endsWith('.yml')).slice(0, 200);
    const files: Array<{ path: string; content: string }> = [];
    for (const f of ymlPaths) {
      const blobRes = await fetch(`${apiBase}/contents/${f.path}?ref=${branch}`, { headers });
      if (!blobRes.ok) continue;
      const blob = await blobRes.json() as any;
      files.push({ path: f.path, content: Buffer.from(blob.content, 'base64').toString('utf8') });
    }
    return files;
  }

  // Incremental — compare commits
  const compareRes = await fetch(`${apiBase}/compare/${lastSha}...${branch}`, { headers });
  if (!compareRes.ok) throw new Error(`GitHub compare error: ${compareRes.status}`);
  const compare = await compareRes.json() as any;
  const files: Array<{ path: string; content: string }> = [];
  for (const f of (compare.files ?? []).filter((f: any) => f.filename.endsWith('.yml'))) {
    const contentRes = await fetch(`${apiBase}/contents/${f.filename}?ref=${branch}`, { headers });
    if (!contentRes.ok) continue;
    const blob = await contentRes.json() as any;
    files.push({ path: f.filename, content: Buffer.from(blob.content, 'base64').toString('utf8') });
  }
  return files;
}

/** Stage SIGMA files as pending imports (using the existing SIGMA parser) */
async function stageFiles(db: KnexType, configId: number, files: Array<{ path: string; content: string }>): Promise<number> {
  const { parseSigmaYaml } = await import('../routes/sigma') as any;
  let staged = 0;
  for (const f of files) {
    try {
      const parsed = parseSigmaYaml(f.content);
      if (!parsed?.title) continue;
      // Insert into a staging table — re-use taxii_pending_ingests with entity_type='sigma_github'
      const existing = await rawGet(db, "SELECT id FROM taxii_pending_ingests WHERE entity_type = 'sigma_github' AND entity_id = ?", [f.path]);
      if (existing) continue; // already staged
      await rawRun(db,
        "INSERT INTO taxii_pending_ingests (batch_id, entity_type, entity_id, proposed_action, proposed_data, status) VALUES (?, 'sigma_github', ?, 'import_sigma', ?, 'pending')",
        [configId, f.path, JSON.stringify({ path: f.path, sigma_yaml: f.content, parsed })]
      );
      staged++;
    } catch { /* skip unparseable files */ }
  }
  return staged;
}

export async function runGithubSync(configId: number): Promise<{ staged: number; sha: string }> {
  const db = getKnex();
  const cfg = await rawGet<GithubSyncConfig>(db, 'SELECT * FROM github_sync_configs WHERE id = ?', [configId]);
  if (!cfg) throw new Error('Config not found');

  const { decryptJson } = await import('./crypto');
  const token = cfg.token_enc ? decryptJson(cfg.token_enc).token ?? null : null;
  const apiBase = toApiBase(cfg.repo_url);
  const sha = await getLatestSha(apiBase, cfg.branch, token);

  if (sha === cfg.last_sha) return { staged: 0, sha }; // no changes

  const files = await getChangedYmlFiles(apiBase, cfg.branch, cfg.last_sha, token);
  const staged = await stageFiles(db, configId, files);
  await rawRun(db, 'UPDATE github_sync_configs SET last_sha = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?', [sha, configId]);

  return { staged, sha };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/integrations/github-sync.ts
git commit -m "feat: add GitHub SIGMA sync module"
```

---

### Task 6: Ticketing connector

**Files:**
- Create: `server/src/integrations/ticketing.ts`

- [ ] **Step 1: Create connector**

```typescript
// server/src/integrations/ticketing.ts

export interface TicketInput {
  summary: string;
  description: string;
  priority?: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
}

export interface TicketResult {
  ticket_id: string;
  url: string;
}

export async function createJiraTicket(config: {
  base_url: string;
  username: string;
  token: string;
  project_key: string;
}, input: TicketInput): Promise<TicketResult> {
  const auth = Buffer.from(`${config.username}:${config.token}`).toString('base64');
  const body = {
    fields: {
      project: { key: config.project_key },
      summary: input.summary,
      description: {
        type: 'doc', version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description }] }],
      },
      issuetype: { name: 'Task' },
      priority: { name: input.priority === 'highest' ? 'Highest' : input.priority === 'high' ? 'High' : input.priority === 'low' ? 'Low' : 'Medium' },
    },
  };
  const res = await fetch(`${config.base_url}/rest/api/3/issue`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jira error: ${res.status} ${await res.text()}`);
  const j = await res.json() as any;
  return { ticket_id: j.key, url: `${config.base_url}/browse/${j.key}` };
}

export async function createServiceNowTicket(config: {
  base_url: string;
  username: string;
  password: string;
  assignment_group?: string;
}, input: TicketInput): Promise<TicketResult> {
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const urgency = input.priority === 'highest' || input.priority === 'high' ? '1'
    : input.priority === 'low' || input.priority === 'lowest' ? '3' : '2';
  const body: Record<string, string> = {
    short_description: input.summary,
    description: input.description,
    urgency,
  };
  if (config.assignment_group) body.assignment_group = config.assignment_group;

  const res = await fetch(`${config.base_url}/api/now/table/incident`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ServiceNow error: ${res.status} ${await res.text()}`);
  const j = await res.json() as any;
  const sysId = j.result.sys_id;
  const ticketId = j.result.number;
  return { ticket_id: ticketId, url: `${config.base_url}/incident.do?sys_id=${sysId}` };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/integrations/ticketing.ts
git commit -m "feat: add Jira and ServiceNow ticketing connectors"
```

---

### Task 7: Integrations REST route

**Files:**
- Create: `server/src/routes/integrations.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create the route (CRUD + test + push + pull)**

```typescript
// server/src/routes/integrations.ts
import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';
import { encryptJson, decryptJson } from '../integrations/crypto';
import { createSentinelConnector } from '../integrations/siem/sentinel';
import { createSplunkConnector } from '../integrations/siem/splunk';
import { createElasticConnector } from '../integrations/siem/elastic';
import { createCrowdStrikeConnector } from '../integrations/siem/crowdstrike';
import { createQRadarConnector } from '../integrations/siem/qradar';
import { createChronicleConnector } from '../integrations/siem/chronicle';
import { runGithubSync } from '../integrations/github-sync';

const router = Router();

const VALID_TYPES = ['sentinel', 'splunk', 'elastic', 'crowdstrike', 'qradar', 'chronicle'];

function buildConnector(type: string, config: Record<string, string>, credentials: Record<string, string>) {
  const merged = { ...config, ...credentials };
  switch (type) {
    case 'sentinel': return createSentinelConnector(merged as any);
    case 'splunk':   return createSplunkConnector(merged as any);
    case 'elastic':  return createElasticConnector(merged as any);
    case 'crowdstrike': return createCrowdStrikeConnector(merged as any);
    case 'qradar':   return createQRadarConnector(merged as any);
    case 'chronicle': return createChronicleConnector(merged as any);
    default: throw new Error(`Unknown type: ${type}`);
  }
}

// ── SIEM Integrations ────────────────────────────────────────────────────────

router.get('/siem', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, 'SELECT id, name, type, config, enabled, last_push_status, last_push_error, last_pushed_at, last_pull_status, last_pull_error, last_pulled_at, created_at FROM siem_integrations ORDER BY name');
  res.json(rows.map(r => ({ ...r, config: JSON.parse(r.config ?? '{}') })));
});

router.post('/siem', async (req, res) => {
  const db = getKnex();
  const { name, type, config = {}, credentials = {}, enabled = true } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  const credentials_enc = Object.keys(credentials).length > 0 ? encryptJson(credentials) : null;
  const id = await rawInsert(db,
    'INSERT INTO siem_integrations (name, type, config, credentials_enc, enabled) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [name.trim(), type, JSON.stringify(config), credentials_enc, enabled ? 1 : 0]);
  await logAudit(db, 'siem_integration', String(id), 'create', (req as any).actor ?? 'user', { name, type });
  res.status(201).json(await rawGet(db, 'SELECT id, name, type, config, enabled, created_at FROM siem_integrations WHERE id=?', [id]));
});

router.put('/siem/:id', async (req, res) => {
  const db = getKnex();
  const row = await rawGet(db, 'SELECT id FROM siem_integrations WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { name, config, credentials, enabled } = req.body;
  const credentials_enc = credentials && Object.keys(credentials).length > 0 ? encryptJson(credentials) : undefined;
  await rawRun(db,
    `UPDATE siem_integrations SET
      name=COALESCE(?,name), config=COALESCE(?,config),
      credentials_enc=COALESCE(?,credentials_enc),
      enabled=COALESCE(?,enabled), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [name ?? null, config ? JSON.stringify(config) : null, credentials_enc ?? null, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id]);
  res.json(await rawGet(db, 'SELECT id, name, type, config, enabled FROM siem_integrations WHERE id=?', [req.params.id]));
});

router.delete('/siem/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM siem_integrations WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Not found' });
  await rawRun(db, 'DELETE FROM siem_integrations WHERE id=?', [req.params.id]);
  res.status(204).end();
});

router.post('/siem/:id/test', async (req, res) => {
  const db = getKnex();
  const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  try {
    const config = JSON.parse(row.config ?? '{}');
    const credentials = row.credentials_enc ? decryptJson(row.credentials_enc) : {};
    const connector = buildConnector(row.type, config, credentials);
    const result = await connector.testConnection();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

router.post('/siem/:id/push', async (req, res) => {
  const db = getKnex();
  const row = await rawGet<any>(db, 'SELECT * FROM siem_integrations WHERE id=?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { detection_ids } = req.body; // array of detection IDs to push
  if (!Array.isArray(detection_ids) || detection_ids.length === 0)
    return res.status(400).json({ error: 'detection_ids array required' });

  const config = JSON.parse(row.config ?? '{}');
  const credentials = row.credentials_enc ? decryptJson(row.credentials_enc) : {};
  const connector = buildConnector(row.type, config, credentials);

  const results: any[] = [];
  for (const did of detection_ids) {
    const det = await rawGet<any>(db, 'SELECT id, name, notes FROM detections WHERE id=?', [did]);
    if (!det) { results.push({ detection_id: did, ok: false, message: 'Not found' }); continue; }
    // notes field used as SIGMA YAML store (or empty stub if no SIGMA rule)
    const sigmaYaml = det.notes ?? `title: ${det.name}\nstatus: experimental\nlogsource:\n  category: process_creation\ndetection:\n  selection:\n    CommandLine|contains: '${det.name}'\n  condition: selection`;
    try {
      const result = await connector.pushRule({ id: det.id, name: det.name, sigmaYaml });
      results.push({ detection_id: did, ...result });
    } catch (e: any) {
      results.push({ detection_id: did, ok: false, message: e.message });
    }
  }

  const allOk = results.every(r => r.ok);
  await rawRun(db, 'UPDATE siem_integrations SET last_push_status=?, last_push_error=?, last_pushed_at=CURRENT_TIMESTAMP WHERE id=?',
    [allOk ? 'ok' : 'error', allOk ? null : results.find(r => !r.ok)?.message ?? null, req.params.id]);
  await rawInsert(db, 'INSERT INTO siem_sync_log (integration_id, direction, status, items_affected, detail) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [req.params.id, 'push', allOk ? 'ok' : 'error', results.filter(r => r.ok).length, JSON.stringify(results)]);

  res.json({ results });
});

// ── GitHub Sync ───────────────────────────────────────────────────────────────

router.get('/github', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, 'SELECT id, name, repo_url, branch, path_glob, enabled, last_sha, last_synced_at FROM github_sync_configs ORDER BY name');
  res.json(rows);
});

router.post('/github', async (req, res) => {
  const db = getKnex();
  const { name, repo_url, branch = 'main', path_glob = '**/*.yml', token, enabled = true } = req.body;
  if (!name?.trim() || !repo_url?.trim()) return res.status(400).json({ error: 'name and repo_url required' });
  const token_enc = token ? encryptJson({ token }) : null;
  const id = await rawInsert(db,
    'INSERT INTO github_sync_configs (name, repo_url, branch, path_glob, token_enc, enabled) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [name.trim(), repo_url.trim(), branch, path_glob, token_enc, enabled ? 1 : 0]);
  res.status(201).json(await rawGet(db, 'SELECT id, name, repo_url, branch, path_glob, enabled FROM github_sync_configs WHERE id=?', [id]));
});

router.post('/github/:id/sync', async (req, res) => {
  try {
    const result = await runGithubSync(Number(req.params.id));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Ticketing ─────────────────────────────────────────────────────────────────

router.get('/ticketing', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll(db, 'SELECT id, name, type, base_url, default_project, enabled FROM ticketing_configs ORDER BY name');
  res.json(rows);
});

router.post('/ticketing', async (req, res) => {
  const db = getKnex();
  const { name, type, base_url, credentials = {}, default_project, enabled = true } = req.body;
  if (!name?.trim() || !type || !base_url?.trim()) return res.status(400).json({ error: 'name, type, base_url required' });
  if (!['jira', 'servicenow'].includes(type)) return res.status(400).json({ error: 'type must be jira or servicenow' });
  const credentials_enc = Object.keys(credentials).length > 0 ? encryptJson(credentials) : null;
  const id = await rawInsert(db,
    'INSERT INTO ticketing_configs (name, type, base_url, credentials_enc, default_project, enabled) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [name.trim(), type, base_url.trim(), credentials_enc, default_project ?? null, enabled ? 1 : 0]);
  res.status(201).json(await rawGet(db, 'SELECT id, name, type, base_url, default_project, enabled FROM ticketing_configs WHERE id=?', [id]));
});

export default router;
```

- [ ] **Step 2: Register in index.ts**

```typescript
import integrationsRouter from './routes/integrations';
// ... after other routers:
app.use('/api/integrations', integrationsRouter);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/integrations.ts server/src/index.ts
git commit -m "feat: add integrations REST route (SIEM, GitHub, ticketing)"
```

---

### Task 8: Integrations route tests

**Files:**
- Modify: `server/src/__tests__/helpers/testDb.ts`
- Create: `server/src/__tests__/integrations.test.ts`

- [ ] **Step 1: Add integration tables to testDb.ts**

```typescript
// Add to setupTestDb chain:
    .createTableIfNotExists('siem_integrations', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.text('config').notNullable().defaultTo('{}');
      t.text('credentials_enc').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_push_status').nullable();
      t.string('last_push_error').nullable();
      t.timestamp('last_pushed_at').nullable();
      t.string('last_pull_status').nullable();
      t.string('last_pull_error').nullable();
      t.timestamp('last_pulled_at').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('siem_sync_log', t => {
      t.increments('id').primary();
      t.integer('integration_id').notNullable();
      t.string('direction').notNullable();
      t.string('status').notNullable();
      t.integer('items_affected').notNullable().defaultTo(0);
      t.text('detail').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('github_sync_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('repo_url').notNullable();
      t.string('branch').notNullable().defaultTo('main');
      t.string('path_glob').notNullable().defaultTo('**/*.yml');
      t.text('token_enc').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_sha').nullable();
      t.timestamp('last_synced_at').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('ticketing_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.string('base_url').notNullable();
      t.text('credentials_enc').nullable();
      t.string('default_project').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
```

- [ ] **Step 2: Write tests (no external network calls)**

```typescript
// server/src/__tests__/integrations.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import integrationsRouter from '../routes/integrations';
import type { Knex as KnexType } from 'knex';

let db: KnexType;
let app: ReturnType<typeof createTestApp>;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  const dbModule = await import('../db/database');
  (dbModule as any)._instance = db;
  app = createTestApp(['/api/integrations', integrationsRouter]);
});

afterAll(async () => { await db.destroy(); });

describe('SIEM integration CRUD', () => {
  let integrationId: number;

  it('creates a SIEM integration', async () => {
    const res = await request(app).post('/api/integrations/siem').send({
      name: 'Test Splunk',
      type: 'splunk',
      config: { base_url: 'https://splunk.example.com:8089', app: 'search' },
      credentials: { token: 'test-token' },
    }).expect(201);
    expect(res.body.name).toBe('Test Splunk');
    expect(res.body.type).toBe('splunk');
    integrationId = res.body.id;
  });

  it('lists SIEM integrations', async () => {
    const res = await request(app).get('/api/integrations/siem').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Splunk');
    // Credentials must NOT be returned
    expect(res.body[0].credentials_enc).toBeUndefined();
  });

  it('rejects unknown type', async () => {
    await request(app).post('/api/integrations/siem').send({ name: 'Bad', type: 'unknown' }).expect(400);
  });

  it('updates a SIEM integration', async () => {
    const res = await request(app).put(`/api/integrations/siem/${integrationId}`).send({ name: 'Updated Splunk' }).expect(200);
    expect(res.body.name).toBe('Updated Splunk');
  });

  it('deletes a SIEM integration', async () => {
    await request(app).delete(`/api/integrations/siem/${integrationId}`).expect(204);
    const res = await request(app).get('/api/integrations/siem').expect(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('GitHub sync CRUD', () => {
  it('creates a GitHub sync config', async () => {
    const res = await request(app).post('/api/integrations/github').send({
      name: 'Detection Rules Repo',
      repo_url: 'https://github.com/example/sigma-rules',
      branch: 'main',
      token: 'ghp_testtoken',
    }).expect(201);
    expect(res.body.repo_url).toBe('https://github.com/example/sigma-rules');
  });
});

describe('Ticketing CRUD', () => {
  it('creates a Jira config', async () => {
    const res = await request(app).post('/api/integrations/ticketing').send({
      name: 'JIRA',
      type: 'jira',
      base_url: 'https://company.atlassian.net',
      credentials: { username: 'user@example.com', token: 'jira-token' },
      default_project: 'SEC',
    }).expect(201);
    expect(res.body.type).toBe('jira');
    expect(res.body.default_project).toBe('SEC');
  });

  it('rejects invalid ticketing type', async () => {
    await request(app).post('/api/integrations/ticketing').send({ name: 'X', type: 'trello', base_url: 'https://x.com' }).expect(400);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd server && npm test -- integrations
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/src/__tests__/helpers/testDb.ts server/src/__tests__/integrations.test.ts
git commit -m "test: add integrations route tests"
```

---

### Task 9: Dockerfile — install sigma-cli

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Add sigma-cli to production stage**

In the production stage (`FROM node:20-bookworm-slim AS production`), modify the `apt-get install` line to add `python3-pip`, then install sigma-cli after:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip make g++ ca-certificates gosu \
    && pip3 install --no-cache-dir --break-system-packages \
         sigma-cli \
         pySigma-backend-splunk \
         pySigma-backend-elasticsearch \
         pySigma-backend-microsoft365defender \
         pySigma-backend-crowdstrike \
         pySigma-backend-qradar \
         pySigma-backend-chronicle \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Verify Docker build succeeds**

```bash
docker build -t mitremap:test . 2>&1 | tail -20
```
Expected: `Successfully built ...`

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: install sigma-cli and pySigma backends in Docker image"
```

---

### Task 10: Frontend Integrations page

**Files:**
- Create: `client/src/pages/Integrations.tsx`
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Sidebar.tsx`

- [ ] **Step 1: Add types**

```typescript
// Add to client/src/types.ts:
export interface SiemIntegration {
  id: number;
  name: string;
  type: 'sentinel' | 'splunk' | 'elastic' | 'crowdstrike' | 'qradar' | 'chronicle';
  config: Record<string, string>;
  enabled: number;
  last_push_status: string | null;
  last_push_error: string | null;
  last_pushed_at: string | null;
  last_pull_status: string | null;
  last_pulled_at: string | null;
  created_at: string;
}

export interface GithubSyncConfig {
  id: number;
  name: string;
  repo_url: string;
  branch: string;
  path_glob: string;
  enabled: number;
  last_sha: string | null;
  last_synced_at: string | null;
}

export interface TicketingConfig {
  id: number;
  name: string;
  type: 'jira' | 'servicenow';
  base_url: string;
  default_project: string | null;
  enabled: number;
}
```

- [ ] **Step 2: Add API methods**

```typescript
// Add to api.ts:
  getSiemIntegrations: () => get<SiemIntegration[]>('/integrations/siem'),
  createSiemIntegration: (data: any) => post<SiemIntegration>('/integrations/siem', data),
  updateSiemIntegration: (id: number, data: any) => put<SiemIntegration>(`/integrations/siem/${id}`, data),
  deleteSiemIntegration: (id: number) => del<void>(`/integrations/siem/${id}`),
  testSiemIntegration: (id: number) => post<{ ok: boolean; message: string }>(`/integrations/siem/${id}/test`, {}),
  pushSiemDetections: (id: number, detectionIds: number[]) => post<any>(`/integrations/siem/${id}/push`, { detection_ids: detectionIds }),
  getGithubSyncConfigs: () => get<GithubSyncConfig[]>('/integrations/github'),
  createGithubSyncConfig: (data: any) => post<GithubSyncConfig>('/integrations/github', data),
  triggerGithubSync: (id: number) => post<{ staged: number; sha: string }>(`/integrations/github/${id}/sync`, {}),
  getTicketingConfigs: () => get<TicketingConfig[]>('/integrations/ticketing'),
  createTicketingConfig: (data: any) => post<TicketingConfig>('/integrations/ticketing', data),
```

- [ ] **Step 3: Create Integrations.tsx**

The page has three tabs: SIEM Connectors, GitHub Sync, Ticketing. Each tab shows a list of configs with status indicators and action buttons (Test, Push, Edit, Delete).

```tsx
// client/src/pages/Integrations.tsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { SiemIntegration, GithubSyncConfig, TicketingConfig } from '../types';
import { useToast } from '../context/ToastContext';
import { Plug, Github, Ticket } from 'lucide-react';

type Tab = 'siem' | 'github' | 'ticketing';

const SIEM_TYPES = ['sentinel', 'splunk', 'elastic', 'crowdstrike', 'qradar', 'chronicle'] as const;
const SIEM_LABELS: Record<string, string> = {
  sentinel: 'Microsoft Sentinel', splunk: 'Splunk', elastic: 'Elastic/OpenSearch',
  crowdstrike: 'CrowdStrike', qradar: 'QRadar', chronicle: 'Google SecOps',
};

export default function Integrations() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('siem');
  const [siemList, setSiemList] = useState<SiemIntegration[]>([]);
  const [githubList, setGithubList] = useState<GithubSyncConfig[]>([]);
  const [ticketingList, setTicketingList] = useState<TicketingConfig[]>([]);
  const [testing, setTesting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [addSiemOpen, setAddSiemOpen] = useState(false);
  const [siemForm, setSiemForm] = useState({ name: '', type: 'splunk', config: '{}', credentials: '{}' });

  useEffect(() => {
    Promise.all([
      api.getSiemIntegrations().then(setSiemList).catch(() => {}),
      api.getGithubSyncConfigs().then(setGithubList).catch(() => {}),
      api.getTicketingConfigs().then(setTicketingList).catch(() => {}),
    ]);
  }, []);

  async function testSiem(id: number) {
    setTesting(id);
    try {
      const result = await api.testSiemIntegration(id);
      toast(result.ok ? `Connected: ${result.message}` : `Failed: ${result.message}`, result.ok ? 'success' : 'error');
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setTesting(null); }
  }

  async function deleteSiem(id: number) {
    await api.deleteSiemIntegration(id);
    setSiemList(l => l.filter(s => s.id !== id));
    toast('Integration deleted');
  }

  async function addSiem() {
    try {
      const cfg = JSON.parse(siemForm.config);
      const creds = JSON.parse(siemForm.credentials);
      const created = await api.createSiemIntegration({ name: siemForm.name, type: siemForm.type, config: cfg, credentials: creds });
      setSiemList(l => [...l, created]);
      setAddSiemOpen(false);
      setSiemForm({ name: '', type: 'splunk', config: '{}', credentials: '{}' });
      toast('Integration added');
    } catch (e: any) { toast(e.message, 'error'); }
  }

  async function syncGithub(id: number) {
    setSyncing(id);
    try {
      const result = await api.triggerGithubSync(id);
      toast(`Synced: ${result.staged} rules staged`);
      api.getGithubSyncConfigs().then(setGithubList).catch(() => {});
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setSyncing(null); }
  }

  const statusBadge = (status: string | null) => {
    if (!status) return null;
    const cls = status === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20';
    return <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase ${cls}`}>{status}</span>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Integrations</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">SIEM connectors, GitHub sync, and ticketing</p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-slate-800 px-6">
        <div className="flex gap-1 -mb-px">
          {([['siem', 'SIEM Connectors', Plug], ['github', 'GitHub Sync', Github], ['ticketing', 'Ticketing', Ticket]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* SIEM Tab */}
        {tab === 'siem' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setAddSiemOpen(true)}
                className="px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors">
                + Add SIEM Connector
              </button>
            </div>

            {addSiemOpen && (
              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300">New SIEM Connector</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Name</label>
                    <input type="text" value={siemForm.name} onChange={e => setSiemForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400">Type</label>
                    <select value={siemForm.type} onChange={e => setSiemForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full mt-1 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none">
                      {SIEM_TYPES.map(t => <option key={t} value={t}>{SIEM_LABELS[t]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400">Config (JSON — connection settings, no secrets)</label>
                  <textarea value={siemForm.config} onChange={e => setSiemForm(f => ({ ...f, config: e.target.value }))} rows={3}
                    className="w-full mt-1 text-xs font-mono bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400">Credentials (JSON — stored encrypted)</label>
                  <textarea value={siemForm.credentials} onChange={e => setSiemForm(f => ({ ...f, credentials: e.target.value }))} rows={2}
                    className="w-full mt-1 text-xs font-mono bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-2 py-1.5 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddSiemOpen(false)} className="text-xs px-3 py-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
                  <button onClick={addSiem} className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors">Save</button>
                </div>
              </div>
            )}

            {siemList.length === 0 && !addSiemOpen && (
              <div className="text-center text-sm text-gray-400 dark:text-slate-600 py-12">No SIEM connectors configured.</div>
            )}

            <div className="space-y-2">
              {siemList.map(s => (
                <div key={s.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{s.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded font-medium uppercase">{SIEM_LABELS[s.type] ?? s.type}</span>
                      {statusBadge(s.last_push_status)}
                    </div>
                    {s.last_pushed_at && (
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                        Last push: {new Date(s.last_pushed_at).toLocaleString()}
                        {s.last_push_error && <span className="ml-2 text-red-400">{s.last_push_error}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => testSiem(s.id)} disabled={testing === s.id}
                      className="text-xs px-2.5 py-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors">
                      {testing === s.id ? '…' : 'Test'}
                    </button>
                    <button onClick={() => deleteSiem(s.id)}
                      className="text-xs px-2.5 py-1 text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GitHub Sync Tab */}
        {tab === 'github' && (
          <div className="space-y-4">
            {githubList.length === 0 && (
              <div className="text-center text-sm text-gray-400 dark:text-slate-600 py-12">No GitHub sync configs.</div>
            )}
            {githubList.map(g => (
              <div key={g.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{g.name}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{g.repo_url} @ {g.branch}</div>
                  {g.last_synced_at && (
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Last sync: {new Date(g.last_synced_at).toLocaleString()}</div>
                  )}
                </div>
                <button onClick={() => syncGithub(g.id)} disabled={syncing === g.id}
                  className="text-xs px-2.5 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 disabled:opacity-50 transition-colors">
                  {syncing === g.id ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ticketing Tab */}
        {tab === 'ticketing' && (
          <div className="space-y-4">
            {ticketingList.length === 0 && (
              <div className="text-center text-sm text-gray-400 dark:text-slate-600 py-12">No ticketing connectors configured.</div>
            )}
            {ticketingList.map(t => (
              <div key={t.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{t.name}</div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t.type === 'jira' ? 'Jira' : 'ServiceNow'} · {t.base_url}</div>
                {t.default_project && <div className="text-xs text-gray-400 dark:text-slate-500">Default project: {t.default_project}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register route and nav item**

In `App.tsx`:
```typescript
import Integrations from './pages/Integrations';
// In Routes:
<Route path="/integrations" element={<Integrations />} />
```

In `Sidebar.tsx`, add to the System section:
```typescript
{ to: '/integrations', label: 'Integrations', icon: Plug },
```
And add `Plug` to the lucide-react import.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Integrations.tsx client/src/types.ts client/src/api.ts client/src/App.tsx client/src/components/Sidebar.tsx
git commit -m "feat: add Integrations page"
```

---

### Task 11: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to `/integrations` and add a Splunk config**

Fill in a test Splunk config with a dummy base_url. Click Test — should return an error (not connected), but no server crash.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Section 3 — SIEM Integrations & External Connectors"
```
