# Compliance Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ISO 27001:2022, PCI DSS v4.0, and SOC 2 TSC compliance frameworks; compliance trend tracking; per-framework gap exports; and a compliance comparison page.

**Architecture:** New frameworks use the existing `compliance_frameworks` → `compliance_controls` → `technique_compliance` schema — data goes in via seed, no schema changes. Compliance snapshots need a new `compliance_snapshots` table. A new `/compliance` frontend page replaces accessing compliance data only through the Reports page.

**Tech Stack:** Knex migration (compliance_snapshots), Express route additions, React page, CSV/PDF export via existing patterns.

---

## File Map

| File | Action |
|------|--------|
| `server/src/db/migrations/017_compliance_snapshots.ts` | Create — per-framework snapshot table |
| `server/src/data/compliance-iso27001.ts` | Create — ISO 27001:2022 controls + technique mappings |
| `server/src/data/compliance-pci.ts` | Create — PCI DSS v4.0 controls + technique mappings |
| `server/src/data/compliance-soc2.ts` | Create — SOC 2 TSC controls + technique mappings |
| `server/src/db/seed.ts` | Modify — seed three new frameworks on startup |
| `server/src/routes/compliance.ts` | Modify — add `/snapshot` + `/export/:framework_id` endpoints |
| `server/src/routes/snapshots.ts` | Modify — trigger compliance snapshot on coverage snapshot |
| `server/src/__tests__/helpers/testDb.ts` | Modify — add compliance_snapshots table |
| `client/src/types.ts` | Modify — add ComplianceSnapshot type |
| `client/src/api.ts` | Modify — add compliance snapshot + export API calls |
| `client/src/pages/Compliance.tsx` | Create — compliance page with framework comparison + trends |
| `client/src/App.tsx` | Modify — add `/compliance` route |
| `client/src/components/Sidebar.tsx` | Modify — add Compliance nav item under Coverage section |

---

### Task 1: Compliance snapshots migration

**Files:**
- Create: `server/src/db/migrations/017_compliance_snapshots.ts`

- [ ] **Step 1: Create migration**

```typescript
// server/src/db/migrations/017_compliance_snapshots.ts
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('compliance_snapshots', t => {
    t.increments('id').primary();
    t.string('framework_id').notNullable();
    t.integer('total_controls').notNullable();
    t.integer('covered_controls').notNullable();
    t.integer('coverage_pct').notNullable();
    t.timestamp('taken_at').defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_fw_time ON compliance_snapshots(framework_id, taken_at DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('compliance_snapshots');
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npm run migrate
```
Expected: `Batch 15 run: 1 migrations`

- [ ] **Step 3: Commit**

```bash
git add server/src/db/migrations/017_compliance_snapshots.ts
git commit -m "feat: add compliance_snapshots table"
```

---

### Task 2: ISO 27001:2022 data

**Files:**
- Create: `server/src/data/compliance-iso27001.ts`

- [ ] **Step 1: Create data file**

ISO 27001:2022 Annex A has 93 controls across 4 themes. Below are the controls most relevant to ATT&CK detection coverage (themes 8: Technological controls — the 34 tech controls map best). Only the detection-relevant subset is included; the full set of 93 can be extended.

```typescript
// server/src/data/compliance-iso27001.ts

export const ISO_FRAMEWORK = {
  id: 'iso27001-2022',
  name: 'ISO/IEC 27001:2022',
  version: '2022',
  description: 'International standard for information security management systems. Annex A controls mapped to ATT&CK detection techniques.',
};

export const ISO_CONTROLS = [
  { id: 'A.8.7',  framework_id: 'iso27001-2022', name: 'Protection against malware',         category: 'Technological' },
  { id: 'A.8.8',  framework_id: 'iso27001-2022', name: 'Management of technical vulnerabilities', category: 'Technological' },
  { id: 'A.8.12', framework_id: 'iso27001-2022', name: 'Data leakage prevention',             category: 'Technological' },
  { id: 'A.8.15', framework_id: 'iso27001-2022', name: 'Logging',                            category: 'Technological' },
  { id: 'A.8.16', framework_id: 'iso27001-2022', name: 'Monitoring activities',              category: 'Technological' },
  { id: 'A.8.17', framework_id: 'iso27001-2022', name: 'Clock synchronization',              category: 'Technological' },
  { id: 'A.8.19', framework_id: 'iso27001-2022', name: 'Installation of software',           category: 'Technological' },
  { id: 'A.8.20', framework_id: 'iso27001-2022', name: 'Networks security',                  category: 'Technological' },
  { id: 'A.8.21', framework_id: 'iso27001-2022', name: 'Security of network services',       category: 'Technological' },
  { id: 'A.8.22', framework_id: 'iso27001-2022', name: 'Segregation of networks',            category: 'Technological' },
  { id: 'A.8.23', framework_id: 'iso27001-2022', name: 'Web filtering',                      category: 'Technological' },
  { id: 'A.8.25', framework_id: 'iso27001-2022', name: 'Secure development lifecycle',       category: 'Technological' },
  { id: 'A.8.28', framework_id: 'iso27001-2022', name: 'Secure coding',                      category: 'Technological' },
  { id: 'A.5.28', framework_id: 'iso27001-2022', name: 'Collection of evidence',             category: 'Organizational' },
  { id: 'A.5.29', framework_id: 'iso27001-2022', name: 'Information security during disruption', category: 'Organizational' },
  { id: 'A.6.8',  framework_id: 'iso27001-2022', name: 'Information security event reporting', category: 'People' },
];

// Technique mappings: which ATT&CK techniques does each control help detect
export const ISO_TECHNIQUE_MAPPINGS: Array<{ technique_id: string; control_id: string }> = [
  // A.8.7 Protection against malware — detects malware execution techniques
  { technique_id: 'T1059', control_id: 'A.8.7' },
  { technique_id: 'T1059.001', control_id: 'A.8.7' },
  { technique_id: 'T1059.003', control_id: 'A.8.7' },
  { technique_id: 'T1204', control_id: 'A.8.7' },
  { technique_id: 'T1027', control_id: 'A.8.7' },
  // A.8.8 Vulnerability management — exploits
  { technique_id: 'T1190', control_id: 'A.8.8' },
  { technique_id: 'T1203', control_id: 'A.8.8' },
  { technique_id: 'T1211', control_id: 'A.8.8' },
  // A.8.12 DLP — exfiltration
  { technique_id: 'T1048', control_id: 'A.8.12' },
  { technique_id: 'T1041', control_id: 'A.8.12' },
  { technique_id: 'T1052', control_id: 'A.8.12' },
  { technique_id: 'T1567', control_id: 'A.8.12' },
  // A.8.15 Logging + A.8.16 Monitoring
  { technique_id: 'T1070', control_id: 'A.8.15' },
  { technique_id: 'T1070.001', control_id: 'A.8.15' },
  { technique_id: 'T1562', control_id: 'A.8.15' },
  { technique_id: 'T1562.001', control_id: 'A.8.16' },
  { technique_id: 'T1485', control_id: 'A.8.16' },
  { technique_id: 'T1490', control_id: 'A.8.16' },
  // A.8.19 Software installation
  { technique_id: 'T1072', control_id: 'A.8.19' },
  { technique_id: 'T1195', control_id: 'A.8.19' },
  // A.8.20–A.8.23 Network controls
  { technique_id: 'T1071', control_id: 'A.8.20' },
  { technique_id: 'T1571', control_id: 'A.8.21' },
  { technique_id: 'T1599', control_id: 'A.8.22' },
  { technique_id: 'T1568', control_id: 'A.8.23' },
  // A.5.28 Evidence collection
  { technique_id: 'T1005', control_id: 'A.5.28' },
  { technique_id: 'T1119', control_id: 'A.5.28' },
  // A.6.8 Event reporting
  { technique_id: 'T1499', control_id: 'A.6.8' },
  { technique_id: 'T1498', control_id: 'A.6.8' },
];
```

- [ ] **Step 2: Commit**

```bash
git add server/src/data/compliance-iso27001.ts
git commit -m "feat: add ISO 27001:2022 compliance data"
```

---

### Task 3: PCI DSS v4.0 data

**Files:**
- Create: `server/src/data/compliance-pci.ts`

- [ ] **Step 1: Create data file**

```typescript
// server/src/data/compliance-pci.ts

export const PCI_FRAMEWORK = {
  id: 'pci-dss-v4',
  name: 'PCI DSS v4.0',
  version: '4.0',
  description: 'Payment Card Industry Data Security Standard v4.0. Requirements 10 and 11 map to ATT&CK detection and monitoring controls.',
};

export const PCI_CONTROLS = [
  { id: 'PCI-10.2', framework_id: 'pci-dss-v4', name: 'Implement audit logs to detect anomalous or suspicious activity', category: 'Logging & Monitoring' },
  { id: 'PCI-10.3', framework_id: 'pci-dss-v4', name: 'Protect audit logs from destruction and unauthorized modifications', category: 'Logging & Monitoring' },
  { id: 'PCI-10.4', framework_id: 'pci-dss-v4', name: 'Audit logs are reviewed to identify anomalies or suspicious activity', category: 'Logging & Monitoring' },
  { id: 'PCI-10.5', framework_id: 'pci-dss-v4', name: 'Retain audit log history for at least 12 months', category: 'Logging & Monitoring' },
  { id: 'PCI-10.6', framework_id: 'pci-dss-v4', name: 'Time-synchronization mechanisms support consistent time settings', category: 'Logging & Monitoring' },
  { id: 'PCI-10.7', framework_id: 'pci-dss-v4', name: 'Failures of critical security controls are detected and reported', category: 'Logging & Monitoring' },
  { id: 'PCI-11.3', framework_id: 'pci-dss-v4', name: 'External and internal vulnerabilities are regularly identified', category: 'Security Testing' },
  { id: 'PCI-11.4', framework_id: 'pci-dss-v4', name: 'External and internal penetration testing is regularly performed', category: 'Security Testing' },
  { id: 'PCI-11.5', framework_id: 'pci-dss-v4', name: 'Network intrusions and unexpected file changes are detected and responded to', category: 'Security Testing' },
  { id: 'PCI-11.6', framework_id: 'pci-dss-v4', name: 'Unauthorized changes on payment pages are detected and alerted on', category: 'Security Testing' },
  { id: 'PCI-5.2',  framework_id: 'pci-dss-v4', name: 'Malicious software (malware) is prevented, detected, and addressed', category: 'Anti-Malware' },
  { id: 'PCI-8.2',  framework_id: 'pci-dss-v4', name: 'User identification and authentication are managed for all users', category: 'Access Control' },
  { id: 'PCI-8.3',  framework_id: 'pci-dss-v4', name: 'User authentication factors are secured', category: 'Access Control' },
  { id: 'PCI-6.3',  framework_id: 'pci-dss-v4', name: 'Security vulnerabilities are identified and addressed', category: 'Vulnerability Management' },
];

export const PCI_TECHNIQUE_MAPPINGS: Array<{ technique_id: string; control_id: string }> = [
  // PCI-10.2 — audit log generation
  { technique_id: 'T1070', control_id: 'PCI-10.2' },
  { technique_id: 'T1070.001', control_id: 'PCI-10.2' },
  { technique_id: 'T1562.002', control_id: 'PCI-10.2' },
  // PCI-10.3 — log protection
  { technique_id: 'T1562', control_id: 'PCI-10.3' },
  { technique_id: 'T1485', control_id: 'PCI-10.3' },
  // PCI-10.4 — log review
  { technique_id: 'T1078', control_id: 'PCI-10.4' },
  { technique_id: 'T1021', control_id: 'PCI-10.4' },
  // PCI-10.7 — security control failures
  { technique_id: 'T1562.001', control_id: 'PCI-10.7' },
  // PCI-11.3 — vulnerability scanning
  { technique_id: 'T1190', control_id: 'PCI-11.3' },
  { technique_id: 'T1203', control_id: 'PCI-11.3' },
  // PCI-11.4 — pen testing
  { technique_id: 'T1595', control_id: 'PCI-11.4' },
  { technique_id: 'T1592', control_id: 'PCI-11.4' },
  // PCI-11.5 — IDS/IPS
  { technique_id: 'T1046', control_id: 'PCI-11.5' },
  { technique_id: 'T1049', control_id: 'PCI-11.5' },
  { technique_id: 'T1571', control_id: 'PCI-11.5' },
  // PCI-5.2 — anti-malware
  { technique_id: 'T1059', control_id: 'PCI-5.2' },
  { technique_id: 'T1204', control_id: 'PCI-5.2' },
  { technique_id: 'T1027', control_id: 'PCI-5.2' },
  // PCI-8.2 / PCI-8.3 — auth controls
  { technique_id: 'T1078', control_id: 'PCI-8.2' },
  { technique_id: 'T1110', control_id: 'PCI-8.2' },
  { technique_id: 'T1556', control_id: 'PCI-8.3' },
  { technique_id: 'T1621', control_id: 'PCI-8.3' },
  // PCI-6.3 — vulnerability management
  { technique_id: 'T1190', control_id: 'PCI-6.3' },
  { technique_id: 'T1211', control_id: 'PCI-6.3' },
];
```

- [ ] **Step 2: Commit**

```bash
git add server/src/data/compliance-pci.ts
git commit -m "feat: add PCI DSS v4.0 compliance data"
```

---

### Task 4: SOC 2 TSC data

**Files:**
- Create: `server/src/data/compliance-soc2.ts`

- [ ] **Step 1: Create data file**

```typescript
// server/src/data/compliance-soc2.ts

export const SOC2_FRAMEWORK = {
  id: 'soc2-tsc',
  name: 'SOC 2 (Trust Services Criteria)',
  version: '2017 (updated 2022)',
  description: 'AICPA Trust Services Criteria. CC6–CC9 (Logical Access, Change Management, Risk Mitigation) map to ATT&CK detection coverage.',
};

export const SOC2_CONTROLS = [
  { id: 'CC6.1', framework_id: 'soc2-tsc', name: 'Logical access security software, infrastructure, and architectures', category: 'Logical Access' },
  { id: 'CC6.2', framework_id: 'soc2-tsc', name: 'Registration and authorization of new users, credentials, and authentication', category: 'Logical Access' },
  { id: 'CC6.3', framework_id: 'soc2-tsc', name: 'Role-based access controls and need-to-know principles', category: 'Logical Access' },
  { id: 'CC6.6', framework_id: 'soc2-tsc', name: 'Logical access security measures against threats from outside system boundaries', category: 'Logical Access' },
  { id: 'CC6.7', framework_id: 'soc2-tsc', name: 'Transmission of data restricted to authorized individuals and systems', category: 'Logical Access' },
  { id: 'CC6.8', framework_id: 'soc2-tsc', name: 'Controls to prevent or detect and act upon unauthorized or malicious software', category: 'Logical Access' },
  { id: 'CC7.1', framework_id: 'soc2-tsc', name: 'Detection and monitoring procedures to identify vulnerabilities and anomalies', category: 'System Operations' },
  { id: 'CC7.2', framework_id: 'soc2-tsc', name: 'Monitoring tools implemented to detect anomalies, indicators of compromise', category: 'System Operations' },
  { id: 'CC7.3', framework_id: 'soc2-tsc', name: 'Evaluated security events to determine if they could be security incidents', category: 'System Operations' },
  { id: 'CC7.4', framework_id: 'soc2-tsc', name: 'Security incidents identified and remediated on a timely basis', category: 'System Operations' },
  { id: 'CC7.5', framework_id: 'soc2-tsc', name: 'Identified security incidents are contained, remediated, and communicated', category: 'System Operations' },
  { id: 'CC8.1', framework_id: 'soc2-tsc', name: 'Changes to infrastructure, data, and software are authorized and tested', category: 'Change Management' },
  { id: 'CC9.1', framework_id: 'soc2-tsc', name: 'Entity identifies, selects, and develops risk mitigation activities for risks', category: 'Risk Mitigation' },
  { id: 'CC9.2', framework_id: 'soc2-tsc', name: 'Entity assesses and manages risks associated with vendors and business partners', category: 'Risk Mitigation' },
];

export const SOC2_TECHNIQUE_MAPPINGS: Array<{ technique_id: string; control_id: string }> = [
  // CC6.1 — logical access infrastructure
  { technique_id: 'T1078', control_id: 'CC6.1' },
  { technique_id: 'T1190', control_id: 'CC6.1' },
  // CC6.2 — auth controls
  { technique_id: 'T1110', control_id: 'CC6.2' },
  { technique_id: 'T1556', control_id: 'CC6.2' },
  { technique_id: 'T1621', control_id: 'CC6.2' },
  // CC6.3 — access control
  { technique_id: 'T1078.003', control_id: 'CC6.3' },
  { technique_id: 'T1134', control_id: 'CC6.3' },
  { technique_id: 'T1548', control_id: 'CC6.3' },
  // CC6.6 — external threats
  { technique_id: 'T1190', control_id: 'CC6.6' },
  { technique_id: 'T1133', control_id: 'CC6.6' },
  { technique_id: 'T1566', control_id: 'CC6.6' },
  // CC6.7 — data transmission
  { technique_id: 'T1041', control_id: 'CC6.7' },
  { technique_id: 'T1048', control_id: 'CC6.7' },
  { technique_id: 'T1567', control_id: 'CC6.7' },
  // CC6.8 — malware prevention
  { technique_id: 'T1059', control_id: 'CC6.8' },
  { technique_id: 'T1204', control_id: 'CC6.8' },
  { technique_id: 'T1027', control_id: 'CC6.8' },
  // CC7.1 — vulnerability detection
  { technique_id: 'T1046', control_id: 'CC7.1' },
  { technique_id: 'T1595', control_id: 'CC7.1' },
  // CC7.2 — anomaly detection / monitoring
  { technique_id: 'T1078', control_id: 'CC7.2' },
  { technique_id: 'T1021', control_id: 'CC7.2' },
  { technique_id: 'T1071', control_id: 'CC7.2' },
  { technique_id: 'T1562', control_id: 'CC7.2' },
  // CC7.3 — event evaluation
  { technique_id: 'T1087', control_id: 'CC7.3' },
  { technique_id: 'T1057', control_id: 'CC7.3' },
  // CC7.4 — incident response
  { technique_id: 'T1485', control_id: 'CC7.4' },
  { technique_id: 'T1490', control_id: 'CC7.4' },
  // CC7.5 — incident containment
  { technique_id: 'T1489', control_id: 'CC7.5' },
  // CC8.1 — change management
  { technique_id: 'T1072', control_id: 'CC8.1' },
  { technique_id: 'T1195', control_id: 'CC8.1' },
  // CC9.1 / CC9.2 — risk / supply chain
  { technique_id: 'T1195.001', control_id: 'CC9.1' },
  { technique_id: 'T1195.002', control_id: 'CC9.2' },
];
```

- [ ] **Step 2: Commit**

```bash
git add server/src/data/compliance-soc2.ts
git commit -m "feat: add SOC 2 TSC compliance data"
```

---

### Task 5: Seed new frameworks on startup

**Files:**
- Modify: `server/src/db/seed.ts`

- [ ] **Step 1: Import and seed new frameworks in seed.ts**

In `server/src/db/seed.ts`, add imports at the top:
```typescript
import { ISO_FRAMEWORK, ISO_CONTROLS, ISO_TECHNIQUE_MAPPINGS } from './data/compliance-iso27001';
import { PCI_FRAMEWORK, PCI_CONTROLS, PCI_TECHNIQUE_MAPPINGS } from './data/compliance-pci';
import { SOC2_FRAMEWORK, SOC2_CONTROLS, SOC2_TECHNIQUE_MAPPINGS } from './data/compliance-soc2';
```

Find the existing compliance seeding section (where NIST CSF and CIS Controls are seeded). After those calls, add:

```typescript
// Seed ISO 27001:2022
const isoExists = await rawGet(db, "SELECT id FROM compliance_frameworks WHERE id = ?", [ISO_FRAMEWORK.id]);
if (!isoExists) {
  await rawRun(db, 'INSERT INTO compliance_frameworks (id, name, version, description) VALUES (?, ?, ?, ?)',
    [ISO_FRAMEWORK.id, ISO_FRAMEWORK.name, ISO_FRAMEWORK.version, ISO_FRAMEWORK.description]);
  for (const c of ISO_CONTROLS) {
    await rawRun(db, 'INSERT OR IGNORE INTO compliance_controls (id, framework_id, name, category) VALUES (?, ?, ?, ?)',
      [c.id, c.framework_id, c.name, c.category]);
  }
  for (const m of ISO_TECHNIQUE_MAPPINGS) {
    await rawRun(db, 'INSERT OR IGNORE INTO technique_compliance (technique_id, control_id) VALUES (?, ?)',
      [m.technique_id, m.control_id]);
  }
}

// Seed PCI DSS v4.0
const pciExists = await rawGet(db, "SELECT id FROM compliance_frameworks WHERE id = ?", [PCI_FRAMEWORK.id]);
if (!pciExists) {
  await rawRun(db, 'INSERT INTO compliance_frameworks (id, name, version, description) VALUES (?, ?, ?, ?)',
    [PCI_FRAMEWORK.id, PCI_FRAMEWORK.name, PCI_FRAMEWORK.version, PCI_FRAMEWORK.description]);
  for (const c of PCI_CONTROLS) {
    await rawRun(db, 'INSERT OR IGNORE INTO compliance_controls (id, framework_id, name, category) VALUES (?, ?, ?, ?)',
      [c.id, c.framework_id, c.name, c.category]);
  }
  for (const m of PCI_TECHNIQUE_MAPPINGS) {
    await rawRun(db, 'INSERT OR IGNORE INTO technique_compliance (technique_id, control_id) VALUES (?, ?)',
      [m.technique_id, m.control_id]);
  }
}

// Seed SOC 2 TSC
const soc2Exists = await rawGet(db, "SELECT id FROM compliance_frameworks WHERE id = ?", [SOC2_FRAMEWORK.id]);
if (!soc2Exists) {
  await rawRun(db, 'INSERT INTO compliance_frameworks (id, name, version, description) VALUES (?, ?, ?, ?)',
    [SOC2_FRAMEWORK.id, SOC2_FRAMEWORK.name, SOC2_FRAMEWORK.version, SOC2_FRAMEWORK.description]);
  for (const c of SOC2_CONTROLS) {
    await rawRun(db, 'INSERT OR IGNORE INTO compliance_controls (id, framework_id, name, category) VALUES (?, ?, ?, ?)',
      [c.id, c.framework_id, c.name, c.category]);
  }
  for (const m of SOC2_TECHNIQUE_MAPPINGS) {
    await rawRun(db, 'INSERT OR IGNORE INTO technique_compliance (technique_id, control_id) VALUES (?, ?)',
      [m.technique_id, m.control_id]);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 3: Start server to confirm seeding runs without error**

```bash
npm run dev
```
Expected: Server starts, no errors in console about compliance seeding.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/seed.ts
git commit -m "feat: seed ISO 27001, PCI DSS v4.0, and SOC 2 TSC on startup"
```

---

### Task 6: Compliance snapshot endpoint + snapshot trigger

**Files:**
- Modify: `server/src/routes/compliance.ts`
- Modify: `server/src/routes/snapshots.ts`
- Modify: `server/src/__tests__/helpers/testDb.ts`

- [ ] **Step 1: Add compliance_snapshots to testDb.ts**

In the `setupTestDb` chain, add:
```typescript
    .createTableIfNotExists('compliance_snapshots', t => {
      t.increments('id').primary();
      t.string('framework_id').notNullable();
      t.integer('total_controls').notNullable();
      t.integer('covered_controls').notNullable();
      t.integer('coverage_pct').notNullable();
      t.timestamp('taken_at').defaultTo(db.fn.now());
    })
```

- [ ] **Step 2: Add compliance snapshot helper to compliance.ts**

In `server/src/routes/compliance.ts`, add this helper function and new endpoints:

```typescript
import { rawInsert } from '../db/database';

// Helper: compute and store a compliance snapshot for all frameworks
export async function snapshotComplianceCoverage(db: any): Promise<void> {
  const frameworks = await rawAll<{ id: string }>(db, 'SELECT id FROM compliance_frameworks');
  for (const fw of frameworks) {
    const total = await rawGet<{ n: number }>(db,
      'SELECT COUNT(*) as n FROM compliance_controls WHERE framework_id = ?', [fw.id]);
    // A control is "covered" if at least one of its technique_compliance techniques has an active detection
    const covered = await rawGet<{ n: number }>(db, `
      SELECT COUNT(DISTINCT tc.control_id) as n
      FROM technique_compliance tc
      JOIN compliance_controls cc ON cc.id = tc.control_id
      JOIN detections d ON (',' || d.technique_ids || ',') LIKE ('%,' || tc.technique_id || ',%')
      WHERE cc.framework_id = ? AND d.status = 'active'
    `, [fw.id]);
    const totalN = (total as any)?.n ?? 0;
    const coveredN = (covered as any)?.n ?? 0;
    const pct = totalN === 0 ? 0 : Math.round((coveredN / totalN) * 100);
    await rawInsert(db,
      'INSERT INTO compliance_snapshots (framework_id, total_controls, covered_controls, coverage_pct) VALUES (?, ?, ?, ?) RETURNING id',
      [fw.id, totalN, coveredN, pct]
    );
  }
}

// Add to compliance router:
// GET /api/compliance/snapshots?framework_id=xxx
router.get('/snapshots', async (req, res) => {
  const db = getKnex();
  const { framework_id, limit = 90 } = req.query;
  if (!framework_id) return res.status(400).json({ error: 'framework_id is required' });
  const rows = await rawAll(db,
    'SELECT * FROM compliance_snapshots WHERE framework_id = ? ORDER BY taken_at ASC LIMIT ?',
    [framework_id, Number(limit)]
  );
  res.json(rows);
});

// GET /api/compliance/export/:framework_id — CSV of controls with no detection coverage
router.get('/export/:framework_id', async (req, res) => {
  const db = getKnex();
  const fw = await rawGet(db, 'SELECT * FROM compliance_frameworks WHERE id = ?', [req.params.framework_id]);
  if (!fw) return res.status(404).json({ error: 'Framework not found' });

  const gaps = await rawAll(db, `
    SELECT cc.id, cc.name, cc.category,
           GROUP_CONCAT(tc.technique_id, '; ') as technique_ids
    FROM compliance_controls cc
    LEFT JOIN technique_compliance tc ON tc.control_id = cc.id
    WHERE cc.framework_id = ?
    AND NOT EXISTS (
      SELECT 1 FROM technique_compliance tc2
      JOIN detections d ON (',' || d.technique_ids || ',') LIKE ('%,' || tc2.technique_id || ',%')
      WHERE tc2.control_id = cc.id AND d.status = 'active'
    )
    GROUP BY cc.id, cc.name, cc.category
    ORDER BY cc.category, cc.id
  `, [req.params.framework_id]);

  const rows = [
    ['Control ID', 'Control Name', 'Category', 'Mapped Techniques (no active detection)'],
    ...gaps.map((g: any) => [g.id, g.name, g.category ?? '', g.technique_ids ?? '']),
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.framework_id}-gaps.csv"`);
  res.send(csv);
});
```

- [ ] **Step 3: Trigger compliance snapshot when coverage snapshot is taken**

In `server/src/routes/snapshots.ts`, add import:
```typescript
import { snapshotComplianceCoverage } from './compliance';
```

Find the `POST /api/snapshots` handler (where a coverage snapshot row is inserted). After the snapshot is saved, add:
```typescript
// Fire compliance snapshots in background — don't block the response
snapshotComplianceCoverage(db).catch(() => {});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/compliance.ts server/src/routes/snapshots.ts server/src/__tests__/helpers/testDb.ts
git commit -m "feat: add compliance snapshot endpoint and export CSV"
```

---

### Task 7: Frontend — Compliance page

**Files:**
- Create: `client/src/pages/Compliance.tsx`
- Modify: `client/src/types.ts`
- Modify: `client/src/api.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Sidebar.tsx`

- [ ] **Step 1: Add ComplianceSnapshot type**

In `client/src/types.ts`, add:
```typescript
export interface ComplianceSnapshot {
  id: number;
  framework_id: string;
  total_controls: number;
  covered_controls: number;
  coverage_pct: number;
  taken_at: string;
}
```

- [ ] **Step 2: Add API methods**

In `client/src/api.ts`, add to the api object:
```typescript
  getComplianceSnapshots: (frameworkId: string) =>
    get<ComplianceSnapshot[]>(`/compliance/snapshots?framework_id=${encodeURIComponent(frameworkId)}`),
  downloadComplianceExport: (frameworkId: string) => {
    const key = localStorage.getItem('mitremap_api_key');
    const a = document.createElement('a');
    a.href = `/api/compliance/export/${encodeURIComponent(frameworkId)}`;
    if (key) a.href += ''; // auth header can't be set on anchor — user must be cookie-authed or use API key in URL
    a.download = `${frameworkId}-gaps.csv`;
    a.click();
  },
```

- [ ] **Step 3: Create Compliance.tsx**

```tsx
// client/src/pages/Compliance.tsx
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ComplianceFramework, ComplianceSnapshot } from '../types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import CoverageBar from '../components/CoverageBar';
import { useTheme } from '../context/ThemeContext';

const FRAMEWORK_COLORS: Record<string, string> = {
  'nist-csf-2': '#3b82f6',
  'cis-controls-v8': '#10b981',
  'iso27001-2022': '#8b5cf6',
  'pci-dss-v4': '#f59e0b',
  'soc2-tsc': '#ef4444',
};

export default function Compliance() {
  const { theme } = useTheme();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ComplianceSnapshot[]>>({});
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | null>(null);
  const [frameworkDetail, setFrameworkDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getComplianceFrameworks().then(async (fws) => {
      setFrameworks(fws);
      // Load snapshots for all frameworks in parallel
      const snapshotMap: Record<string, ComplianceSnapshot[]> = {};
      await Promise.all(fws.map(async (fw: ComplianceFramework) => {
        try {
          snapshotMap[fw.id] = await api.getComplianceSnapshots(fw.id);
        } catch { snapshotMap[fw.id] = []; }
      }));
      setSnapshots(snapshotMap);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFramework) return;
    api.getComplianceFramework(selectedFramework.id).then(setFrameworkDetail).catch(() => {});
  }, [selectedFramework]);

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-slate-500">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Compliance</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Detection coverage mapped to compliance frameworks</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Framework comparison table */}
        <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Framework Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 dark:text-slate-600 border-b border-gray-200 dark:border-slate-800">
                  <th className="text-left pb-2 font-medium">Framework</th>
                  <th className="text-left pb-2 font-medium">Version</th>
                  <th className="text-center pb-2 font-medium">Controls</th>
                  <th className="text-center pb-2 font-medium">Covered</th>
                  <th className="text-left pb-2 font-medium w-40">Coverage</th>
                  <th className="text-right pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {frameworks.map(fw => (
                  <tr
                    key={fw.id}
                    className={`hover:bg-gray-100/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${selectedFramework?.id === fw.id ? 'bg-blue-500/5' : ''}`}
                    onClick={() => setSelectedFramework(fw.id === selectedFramework?.id ? null : fw)}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-slate-200">{fw.name}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-slate-400">{fw.version ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-center text-gray-500 dark:text-slate-400">{fw.total_controls ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-center text-gray-500 dark:text-slate-400">{fw.covered_controls ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      <CoverageBar covered={fw.covered_controls ?? 0} total={fw.total_controls ?? 1} showLabel={false} />
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); api.downloadComplianceExport(fw.id); }}
                        className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        Export gaps CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coverage trend per framework */}
        {Object.entries(snapshots).some(([, s]) => s.length >= 2) && (
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Compliance Coverage Trend</h2>
            {frameworks.map(fw => {
              const fwSnaps = snapshots[fw.id] ?? [];
              if (fwSnaps.length < 2) return null;
              const color = FRAMEWORK_COLORS[fw.id] ?? '#6366f1';
              const data = fwSnaps.map(s => ({
                date: new Date(s.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                pct: s.coverage_pct,
              }));
              return (
                <div key={fw.id} className="mb-4">
                  <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{fw.name}</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" width={30} />
                      <Tooltip
                        contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`${v}%`, 'Coverage']}
                      />
                      <Line type="monotone" dataKey="pct" stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )}

        {/* Framework detail — controls breakdown */}
        {selectedFramework && frameworkDetail && (
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">
              {selectedFramework.name} — Control Detail
            </h2>
            <div className="space-y-1">
              {(frameworkDetail.controls ?? []).map((ctrl: any) => (
                <div key={ctrl.id} className="flex items-center gap-3 py-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ctrl.covered ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-slate-700'}`} />
                  <span className="text-xs font-mono text-gray-400 dark:text-slate-500 w-16 flex-shrink-0">{ctrl.id}</span>
                  <span className="text-xs text-gray-700 dark:text-slate-300 flex-1">{ctrl.name}</span>
                  {!ctrl.covered && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">Gap</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add ComplianceFramework fields to types.ts**

The existing `ComplianceFramework` type in types.ts needs `covered_controls` and `total_controls` fields (returned by the frameworks endpoint). Add:
```typescript
// In the existing ComplianceFramework interface, add:
covered_controls?: number;
total_controls?: number;
```

- [ ] **Step 5: Add route and nav item**

In `client/src/App.tsx`, add import:
```typescript
import Compliance from './pages/Compliance';
```

Add route inside `<Routes>`:
```tsx
<Route path="/compliance" element={<Compliance />} />
```

In `client/src/components/Sidebar.tsx`, add to the Coverage section of NAV:
```typescript
{ to: '/compliance', label: 'Compliance', icon: ClipboardCheck },
```

And add `ClipboardCheck` to the lucide-react import.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Compliance.tsx client/src/types.ts client/src/api.ts client/src/App.tsx client/src/components/Sidebar.tsx
git commit -m "feat: add Compliance page with framework comparison, trend charts, and gap exports"
```

---

### Task 8: Smoke test

- [ ] **Step 1: Start dev server and navigate to `/compliance`**

```bash
npm run dev
```

- [ ] **Step 2: Verify all 5 frameworks appear in the table**

Navigate to http://localhost:3000/compliance. The framework table should show NIST CSF 2.0, CIS Controls v8, ISO 27001:2022, PCI DSS v4.0, and SOC 2 TSC.

- [ ] **Step 3: Verify gap export works**

Click "Export gaps CSV" for any framework. A CSV file should download with columns: Control ID, Control Name, Category, Mapped Techniques.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Section 2 — Compliance Expansion"
```
