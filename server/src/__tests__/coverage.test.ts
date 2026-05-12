import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return {
    ...mod,
    getKnex: () => testDbHolder.db!,
  };
});

import coverageRouter from '../routes/coverage';

let db: KnexType;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;

  // Seed two tactics
  await db.raw(`INSERT INTO attack_tactics (id, name, shortname) VALUES
    ('TA0001', 'Initial Access', 'initial-access'),
    ('TA0002', 'Execution', 'execution')
  `);

  // Seed parent techniques: 3 for TA0001, 2 for TA0002
  await db.raw(`INSERT INTO attack_techniques (id, name, tactic_ids, is_subtechnique) VALUES
    ('T1001', 'Technique A', '["TA0001"]', 0),
    ('T1002', 'Technique B', '["TA0001"]', 0),
    ('T1003', 'Technique C', '["TA0001"]', 0),
    ('T1059', 'Command Scripting', '["TA0002"]', 0),
    ('T1204', 'User Execution', '["TA0002"]', 0)
  `);

  // Subtechniques of T1001
  await db.raw(`INSERT INTO attack_techniques (id, name, tactic_ids, is_subtechnique, parent_id) VALUES
    ('T1001.001', 'Sub A', '["TA0001"]', 1, 'T1001')
  `);

  // Active detection covering T1001 directly and T1001.001 (subtechnique → resolves to T1001)
  await db.raw(`INSERT INTO detections (name, technique_ids, status, severity, confidence) VALUES
    ('Detection Alpha', '["T1001"]', 'active', 'high', 'high'),
    ('Detection Beta (subtech)', '["T1001.001"]', 'active', 'medium', 'medium'),
    ('Detection Gamma (planned)', '["T1059"]', 'planned', 'low', 'low')
  `);
});

afterAll(async () => {
  await db.destroy();
});

function app() {
  return createTestApp(['/api/coverage', coverageRouter]);
}

describe('GET /api/coverage/stats', () => {
  it('returns a stats object with required fields', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    expect(res.status).toBe(200);
    const { body } = res;
    expect(body).toHaveProperty('total_techniques');
    expect(body).toHaveProperty('covered_techniques');
    expect(body).toHaveProperty('gap_techniques');
    expect(body).toHaveProperty('coverage_pct');
    expect(body).toHaveProperty('detection_pct');
    expect(body).toHaveProperty('tactic_stats');
    expect(Array.isArray(body.tactic_stats)).toBe(true);
  });

  it('total_techniques equals the number of parent (non-subtechnique) techniques', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    expect(res.body.total_techniques).toBe(5); // T1001, T1002, T1003, T1059, T1204
  });

  it('active detections covering T1001 (direct and via sub) still count as one covered parent', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    // T1001 is covered (Detection Alpha covers it directly)
    // Detection Beta covers T1001.001 which resolves to T1001 — same covered parent
    expect(res.body.detected_techniques).toBe(1); // only T1001 parent
    expect(res.body.covered_techniques).toBe(1);
    expect(res.body.gap_techniques).toBe(4);
  });

  it('planned detections do NOT count toward coverage', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    // T1059 has only a planned detection → not covered
    expect(res.body.detected_techniques).toBe(1);
  });

  it('coverage_pct is computed correctly', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    // 1 covered / 5 total = 20%
    expect(res.body.coverage_pct).toBe(20);
  });

  it('tactic_stats has one entry per tactic with correct fields', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    const stats = res.body.tactic_stats as any[];
    expect(stats.length).toBe(2);

    const ta0001 = stats.find(s => s.tactic_id === 'TA0001');
    expect(ta0001).toBeDefined();
    expect(ta0001.total).toBe(3);  // T1001, T1002, T1003
    expect(ta0001.covered).toBe(1); // T1001 only
    expect(ta0001.gap).toBe(2);
    expect(ta0001.pct).toBe(33);

    const ta0002 = stats.find(s => s.tactic_id === 'TA0002');
    expect(ta0002).toBeDefined();
    expect(ta0002.total).toBe(2);  // T1059, T1204
    expect(ta0002.covered).toBe(0);
    expect(ta0002.gap).toBe(2);
    expect(ta0002.pct).toBe(0);
  });

  it('detection counts are included in the response', async () => {
    const res = await request(app()).get('/api/coverage/stats');
    // 2 active + 1 planned = 3 total, 2 active, 1 planned
    expect(res.body.total_detections).toBe(3);
    expect(res.body.active_detections).toBe(2);
    expect(res.body.planned_detections).toBe(1);
  });
});

describe('GET /api/coverage/gaps', () => {
  it('returns techniques not covered by any active detection', async () => {
    const res = await request(app()).get('/api/coverage/gaps');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ids = res.body.map((t: any) => t.id);
    // T1001 is covered → should NOT appear in gaps
    expect(ids).not.toContain('T1001');
    // T1002, T1003, T1059, T1204 are not covered → appear in gaps
    expect(ids).toContain('T1002');
    expect(ids).toContain('T1003');
    expect(ids).toContain('T1059');
    expect(ids).toContain('T1204');
  });

  it('each gap technique includes tactic_names, recommended_d3fend, and recommended_mitigations', async () => {
    const res = await request(app()).get('/api/coverage/gaps');
    const gap = res.body[0];
    expect(gap).toHaveProperty('tactic_names');
    expect(gap).toHaveProperty('recommended_d3fend');
    expect(gap).toHaveProperty('recommended_mitigations');
    expect(Array.isArray(gap.tactic_names)).toBe(true);
    expect(Array.isArray(gap.recommended_d3fend)).toBe(true);
    expect(Array.isArray(gap.recommended_mitigations)).toBe(true);
  });
});

describe('GET /api/coverage/matrix', () => {
  it('returns one column per tactic', async () => {
    const res = await request(app()).get('/api/coverage/matrix');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it('each column has a tactic and cells array', async () => {
    const res = await request(app()).get('/api/coverage/matrix');
    for (const col of res.body) {
      expect(col).toHaveProperty('tactic');
      expect(col).toHaveProperty('cells');
      expect(Array.isArray(col.cells)).toBe(true);
    }
  });

  it('assigns "detected" status to T1001 which has an active detection', async () => {
    const res = await request(app()).get('/api/coverage/matrix');
    const ta0001Col = res.body.find((c: any) => c.tactic.id === 'TA0001');
    const t1001Cell = ta0001Col.cells.find((c: any) => c.id === 'T1001');
    expect(t1001Cell.status).toBe('detected');
    expect(t1001Cell.detection_count).toBeGreaterThan(0);
  });

  it('assigns "planned" status to T1059 which only has a planned detection', async () => {
    const res = await request(app()).get('/api/coverage/matrix');
    const ta0002Col = res.body.find((c: any) => c.tactic.id === 'TA0002');
    const t1059Cell = ta0002Col.cells.find((c: any) => c.id === 'T1059');
    expect(t1059Cell.status).toBe('planned');
  });

  it('assigns "gap" status to uncovered techniques with no detections', async () => {
    const res = await request(app()).get('/api/coverage/matrix');
    const ta0001Col = res.body.find((c: any) => c.tactic.id === 'TA0001');
    const t1002Cell = ta0001Col.cells.find((c: any) => c.id === 'T1002');
    expect(t1002Cell.status).toBe('gap');
    expect(t1002Cell.detection_count).toBe(0);
  });

  it('includes subtechnique data for techniques that have them', async () => {
    const res = await request(app()).get('/api/coverage/matrix');
    const ta0001Col = res.body.find((c: any) => c.tactic.id === 'TA0001');
    const t1001Cell = ta0001Col.cells.find((c: any) => c.id === 'T1001');
    expect(t1001Cell.subtechnique_count).toBe(1);
    expect(Array.isArray(t1001Cell.subtechniques)).toBe(true);
  });
});
