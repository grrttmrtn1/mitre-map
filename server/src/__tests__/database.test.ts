import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, setupTestDb } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

// Use a real in-memory SQLite for database helper tests
let db: KnexType;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
});

afterAll(async () => {
  await db.destroy();
});

// ─── resolveToParent ─────────────────────────────────────────────────────────

import { resolveToParent, buildTechniqueGraph, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

describe('resolveToParent', () => {
  const parents = new Set(['T1001', 'T1002', 'T1003']);
  const subtechToParent = new Map([
    ['T1001.001', 'T1001'],
    ['T1001.002', 'T1001'],
    ['T1002.001', 'T1002'],
  ]);

  it('returns the ID unchanged when it is a parent technique', () => {
    expect(resolveToParent('T1001', parents, subtechToParent)).toBe('T1001');
    expect(resolveToParent('T1002', parents, subtechToParent)).toBe('T1002');
  });

  it('maps a subtechnique ID to its parent', () => {
    expect(resolveToParent('T1001.001', parents, subtechToParent)).toBe('T1001');
    expect(resolveToParent('T1001.002', parents, subtechToParent)).toBe('T1001');
    expect(resolveToParent('T1002.001', parents, subtechToParent)).toBe('T1002');
  });

  it('returns null for an unknown technique ID', () => {
    expect(resolveToParent('T9999', parents, subtechToParent)).toBeNull();
  });

  it('returns null when subtechnique parent is not in parentTechIds', () => {
    // subtechToParent references a parent not in the parents set
    const orphanSubtech = new Map([['T1001.001', 'T9999']]);
    expect(resolveToParent('T1001.001', parents, orphanSubtech)).toBeNull();
  });

  it('returns null for empty maps and sets', () => {
    expect(resolveToParent('T1001', new Set(), new Map())).toBeNull();
  });
});

// ─── buildTechniqueGraph ──────────────────────────────────────────────────────

describe('buildTechniqueGraph', () => {
  beforeAll(async () => {
    // Seed minimal ATT&CK data
    await db.raw(`INSERT INTO attack_techniques (id, name, tactic_ids, is_subtechnique) VALUES
      ('T1001', 'Data Obfuscation', '["TA0001"]', 0),
      ('T1002', 'Data Compressed', '["TA0001"]', 0),
      ('T1003', 'OS Credential Dumping', '["TA0006"]', 0)
    `);
    await db.raw(`INSERT INTO attack_techniques (id, name, tactic_ids, is_subtechnique, parent_id) VALUES
      ('T1001.001', 'Junk Data', '["TA0001"]', 1, 'T1001'),
      ('T1001.002', 'Steganography', '["TA0001"]', 1, 'T1001'),
      ('T1003.001', 'LSASS Memory', '["TA0006"]', 1, 'T1003')
    `);
  });

  it('returns a Set of all parent technique IDs', async () => {
    const { parentTechIds } = await buildTechniqueGraph(db);
    expect(parentTechIds.has('T1001')).toBe(true);
    expect(parentTechIds.has('T1002')).toBe(true);
    expect(parentTechIds.has('T1003')).toBe(true);
    // subtechniques should NOT be in parentTechIds
    expect(parentTechIds.has('T1001.001')).toBe(false);
    expect(parentTechIds.has('T1003.001')).toBe(false);
  });

  it('builds subtechToParent mapping correctly', async () => {
    const { subtechToParent } = await buildTechniqueGraph(db);
    expect(subtechToParent.get('T1001.001')).toBe('T1001');
    expect(subtechToParent.get('T1001.002')).toBe('T1001');
    expect(subtechToParent.get('T1003.001')).toBe('T1003');
    expect(subtechToParent.has('T1001')).toBe(false);
  });

  it('builds parentToSubtechs mapping correctly', async () => {
    const { parentToSubtechs } = await buildTechniqueGraph(db);
    expect(parentToSubtechs.get('T1001')).toEqual(expect.arrayContaining(['T1001.001', 'T1001.002']));
    expect(parentToSubtechs.get('T1001')?.length).toBe(2);
    expect(parentToSubtechs.get('T1003')).toEqual(['T1003.001']);
    // A parent with no subtechniques should not appear in the map
    expect(parentToSubtechs.has('T1002')).toBe(false);
  });
});

// ─── rawAll / rawGet / rawRun / rawInsert ─────────────────────────────────────

describe('raw query helpers', () => {
  it('rawAll returns all matching rows', async () => {
    const rows = await rawAll<{ id: string }>(db, 'SELECT id FROM attack_techniques WHERE is_subtechnique=0 ORDER BY id');
    expect(rows.map(r => r.id)).toEqual(['T1001', 'T1002', 'T1003']);
  });

  it('rawGet returns undefined when no row matches', async () => {
    const row = await rawGet(db, 'SELECT id FROM attack_techniques WHERE id=?', ['TXXX']);
    expect(row).toBeUndefined();
  });

  it('rawGet returns the first matching row', async () => {
    const row = await rawGet<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_techniques WHERE id=?', ['T1001']);
    expect(row?.id).toBe('T1001');
    expect(row?.name).toBe('Data Obfuscation');
  });

  it('rawInsert returns the inserted row id', async () => {
    const id = await rawInsert(db,
      `INSERT INTO tags (name, color) VALUES (?, ?) RETURNING id`,
      ['test-tag', '#ff0000']);
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('rawRun executes without error', async () => {
    await expect(rawRun(db, 'UPDATE tags SET color=? WHERE name=?', ['#00ff00', 'test-tag'])).resolves.toBeUndefined();
  });
});

// ─── logAudit ─────────────────────────────────────────────────────────────────

describe('logAudit', () => {
  it('inserts an audit log entry with all fields', async () => {
    await logAudit(db, 'detection', '42', 'created', 'analyst', { name: 'My Rule' }, '10.0.0.1');
    const row = await rawGet<any>(db, `SELECT * FROM audit_log WHERE entity_id='42' AND action='created'`);
    expect(row).toBeDefined();
    expect(row.entity_type).toBe('detection');
    expect(row.actor).toBe('analyst');
    expect(JSON.parse(row.changes)).toEqual({ name: 'My Rule' });
    expect(row.source_ip).toBe('10.0.0.1');
  });

  it('accepts null changes and sourceIp', async () => {
    await expect(logAudit(db, 'tool', '99', 'deleted')).resolves.toBeUndefined();
    const row = await rawGet<any>(db, `SELECT * FROM audit_log WHERE entity_id='99' AND action='deleted'`);
    expect(row.changes).toBeNull();
    expect(row.source_ip).toBeNull();
  });
});
