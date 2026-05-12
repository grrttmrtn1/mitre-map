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

import riskRouter from '../routes/risk';

let db: KnexType;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;

  // Seed tactics and parent techniques
  await db.raw(`INSERT INTO attack_tactics (id, name, shortname) VALUES
    ('TA0001', 'Initial Access', 'initial-access'),
    ('TA0002', 'Execution', 'execution'),
    ('TA0003', 'Persistence', 'persistence')
  `);

  await db.raw(`INSERT INTO attack_techniques (id, name, tactic_ids, is_subtechnique) VALUES
    ('T1001', 'Technique A', '["TA0001"]', 0),
    ('T1002', 'Technique B', '["TA0001"]', 0),
    ('T1003', 'Technique C', '["TA0002"]', 0),
    ('T1004', 'Technique D', '["TA0003"]', 0)
  `);

  // Seed threat groups
  await db.raw(`INSERT INTO threat_groups (id, name, aliases, description) VALUES
    ('G0001', 'APT1', '[]', 'Test group 1'),
    ('G0002', 'APT2', '[]', 'Test group 2'),
    ('G0003', 'APT3', '[]', 'Test group 3'),
    ('G0004', 'APT4', '[]', 'Test group 4')
  `);

  // T1001 is used by 3 groups (critical gap if not covered)
  await db.raw(`INSERT INTO group_techniques (group_id, technique_id) VALUES
    ('G0001', 'T1001'),
    ('G0002', 'T1001'),
    ('G0003', 'T1001'),
    ('G0001', 'T1002'),
    ('G0004', 'T1003')
  `);

  // Active detection covering only T1002 (T1001 is a gap)
  await db.raw(`INSERT INTO detections (name, technique_ids, status, severity, confidence) VALUES
    ('Coverage for T1002', '["T1002"]', 'active', 'high', 'high')
  `);
});

afterAll(async () => {
  await db.destroy();
});

function app() {
  return createTestApp(['/api/risk', riskRouter]);
}

describe('GET /api/risk/score', () => {
  it('returns a risk score object with required fields', async () => {
    const res = await request(app()).get('/api/risk/score');
    expect(res.status).toBe(200);
    const { body } = res;
    expect(body).toHaveProperty('score');
    expect(body).toHaveProperty('level');
    expect(body).toHaveProperty('components');
    expect(body).toHaveProperty('coverage_pct');
    expect(body).toHaveProperty('gap_count');
    expect(body).toHaveProperty('total_techniques');
  });

  it('score is a number between 0 and 100', async () => {
    const res = await request(app()).get('/api/risk/score');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
  });

  it('level is one of critical/high/medium/low', async () => {
    const res = await request(app()).get('/api/risk/score');
    expect(['critical', 'high', 'medium', 'low']).toContain(res.body.level);
  });

  it('includes the three risk components', async () => {
    const res = await request(app()).get('/api/risk/score');
    const { components } = res.body;
    expect(components).toHaveProperty('coverage_gap_pct');
    expect(components).toHaveProperty('exposed_threat_groups');
    expect(components).toHaveProperty('critical_gaps');
  });

  it('coverage_pct reflects the proportion of covered parent techniques', async () => {
    const res = await request(app()).get('/api/risk/score');
    // 1 out of 4 techniques covered = 25%
    expect(res.body.coverage_pct).toBe(25);
    expect(res.body.gap_count).toBe(3);
    expect(res.body.total_techniques).toBe(4);
  });

  it('exposed_threat_groups counts groups with at least one uncovered technique', async () => {
    const res = await request(app()).get('/api/risk/score');
    // G0001 uses T1001 (gap) and T1002 (covered) → still exposed because T1001 is uncovered
    // G0002 uses T1001 (gap) → exposed
    // G0003 uses T1001 (gap) → exposed
    // G0004 uses T1003 (gap) → exposed
    // All 4 groups are exposed
    expect(res.body.components.exposed_threat_groups).toBe(4);
  });

  it('critical_gaps counts uncovered techniques used by 3+ groups', async () => {
    const res = await request(app()).get('/api/risk/score');
    // T1001 is used by G0001, G0002, G0003 (3 groups) and is NOT covered → critical gap
    expect(res.body.components.critical_gaps).toBe(1);
  });

  it('base risk is 100 minus coverage_pct', async () => {
    const res = await request(app()).get('/api/risk/score');
    // coverage=25, baseRisk=75, exposedGroups=4 (capped at 10), criticalGaps=1 (factor=2)
    // riskScore = min(100, 75 + 4 + 2) = 81 → critical
    const { score, coverage_pct, components } = res.body;
    const baseRisk = 100 - coverage_pct;
    const expectedMin = baseRisk;
    expect(score).toBeGreaterThanOrEqual(expectedMin);
    expect(score).toBeLessThanOrEqual(100);
    expect(components.coverage_gap_pct).toBe(baseRisk);
  });

  it('level is "critical" when score >= 75', async () => {
    const res = await request(app()).get('/api/risk/score');
    // With 75% gap + group exposure, score should be >= 75
    if (res.body.score >= 75) {
      expect(res.body.level).toBe('critical');
    }
  });
});

describe('GET /api/risk/by-tactic', () => {
  it('returns an array of tactic risk scores', async () => {
    const res = await request(app()).get('/api/risk/by-tactic');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3); // TA0001, TA0002, TA0003
  });

  it('each entry has required risk fields', async () => {
    const res = await request(app()).get('/api/risk/by-tactic');
    for (const tactic of res.body) {
      expect(tactic).toHaveProperty('tactic_id');
      expect(tactic).toHaveProperty('tactic_name');
      expect(tactic).toHaveProperty('coverage_pct');
      expect(tactic).toHaveProperty('risk_score');
      expect(tactic).toHaveProperty('risk_level');
      expect(['critical', 'high', 'medium', 'low']).toContain(tactic.risk_level);
    }
  });

  it('results are sorted by risk_score descending', async () => {
    const res = await request(app()).get('/api/risk/by-tactic');
    const scores = res.body.map((t: any) => t.risk_score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('TA0001 (Initial Access) has higher risk due to group exposure on T1001', async () => {
    const res = await request(app()).get('/api/risk/by-tactic');
    const ta0001 = res.body.find((t: any) => t.tactic_id === 'TA0001');
    // TA0001 has T1001 (exposed by 3 groups, uncovered) and T1002 (covered)
    expect(ta0001.coverage_pct).toBe(50); // 1/2 covered
    expect(ta0001.covered).toBe(1);
    expect(ta0001.gap_count).toBe(1);
  });
});

describe('GET /api/risk/by-technique', () => {
  it('returns techniques with risk >= 20 (excludes fully-covered, low-exposure)', async () => {
    const res = await request(app()).get('/api/risk/by-technique');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All returned techniques should have risk_score >= 20
    for (const tech of res.body) {
      expect(tech.risk_score).toBeGreaterThanOrEqual(20);
    }
  });

  it('each entry has required fields', async () => {
    const res = await request(app()).get('/api/risk/by-technique');
    for (const tech of res.body) {
      expect(tech).toHaveProperty('id');
      expect(tech).toHaveProperty('name');
      expect(tech).toHaveProperty('detected');
      expect(tech).toHaveProperty('mitigated');
      expect(tech).toHaveProperty('group_count');
      expect(tech).toHaveProperty('risk_score');
      expect(tech).toHaveProperty('risk_level');
    }
  });

  it('results are sorted by risk_score descending', async () => {
    const res = await request(app()).get('/api/risk/by-technique');
    const scores = res.body.map((t: any) => t.risk_score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('T1001 (used by 3 groups, undetected, unmitigated) has highest risk', async () => {
    const res = await request(app()).get('/api/risk/by-technique');
    const t1001 = res.body.find((t: any) => t.id === 'T1001');
    expect(t1001).toBeDefined();
    expect(t1001.detected).toBe(false);
    expect(t1001.mitigated).toBe(false);
    expect(t1001.group_count).toBe(3);
    // detectionScore=40(not detected, not mitigated) + groupScore=30(3*10) = 70
    expect(t1001.risk_score).toBe(70);
  });

  it('T1002 (detected by active detection) has lower risk than T1001', async () => {
    const res = await request(app()).get('/api/risk/by-technique');
    const t1001 = res.body.find((t: any) => t.id === 'T1001');
    const t1002 = res.body.find((t: any) => t.id === 'T1002');
    if (t1002) {
      expect(t1001.risk_score).toBeGreaterThan(t1002.risk_score);
    }
  });
});
