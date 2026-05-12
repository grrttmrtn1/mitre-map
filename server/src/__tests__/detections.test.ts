import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createTestDb, setupTestDb, createTestApp } from './helpers/testDb';
import type { Knex as KnexType } from 'knex';

// ─── Pure unit tests for quality scoring ────────────────────────────────────

import {
  computeQualityScore,
  SEVERITY_SCORES,
  CONFIDENCE_SCORES,
  FP_SCORES,
} from '../routes/detections';

describe('computeQualityScore', () => {
  const noTechCoverage = new Map<string, number>();

  it('score tables have correct values', () => {
    expect(SEVERITY_SCORES.critical).toBe(25);
    expect(SEVERITY_SCORES.informational).toBe(5);
    expect(CONFIDENCE_SCORES.high).toBe(25);
    expect(CONFIDENCE_SCORES.low).toBe(5);
    expect(FP_SCORES.low).toBe(15);
    expect(FP_SCORES.high).toBe(0);
  });

  it('maximum possible score is A grade (critical + high + low FP + 3 validated tests + all unique)', () => {
    // severity=25, confidence=25, fp=15, tests=30(3 validated), uniqueness=5 → total=100
    const coverage = new Map([['T1001', 1], ['T1002', 1], ['T1003', 1]]);
    const result = computeQualityScore('critical', 'high', 'low', ['T1001', 'T1002', 'T1003'], 3, 0, coverage);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.components.severity).toBe(25);
    expect(result.components.confidence).toBe(25);
    expect(result.components.fp_rate).toBe(15);
    expect(result.components.tests).toBe(30);
    expect(result.components.uniqueness).toBe(5);
  });

  it('minimum possible score is F grade (informational + low + high FP + no tests + not unique)', () => {
    // severity=5, confidence=5, fp=0, tests=0, uniqueness=0 → total=10
    const coverage = new Map([['T1001', 2]]); // not unique
    const result = computeQualityScore('informational', 'low', 'high', ['T1001'], 0, 0, coverage);
    expect(result.score).toBe(10);
    expect(result.grade).toBe('F');
  });

  it('assigns grade A for score >= 80', () => {
    // severity=25, confidence=25, fp=15, tests=20(2 validated), uniqueness=5 → 90
    const coverage = new Map([['T1001', 1]]);
    const result = computeQualityScore('critical', 'high', 'low', ['T1001'], 2, 0, coverage);
    expect(result.grade).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('assigns grade B for score 60-79', () => {
    // severity=20, confidence=15, fp=8, tests=10(1 validated), uniqueness=5 → 58... try medium+medium+medium+1v+unique
    // severity=15(medium), confidence=15(medium), fp=8(medium), tests=10(1v), uniqueness=5 → 53 = C
    // severity=20(high), confidence=25(high), fp=8(medium), tests=0, uniqueness=5 → 58 = C
    // severity=20(high), confidence=25(high), fp=15(low), tests=0, uniqueness=5 → 65 = B
    const coverage = new Map([['T1001', 1]]);
    const result = computeQualityScore('high', 'high', 'low', ['T1001'], 0, 0, coverage);
    expect(result.grade).toBe('B');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(80);
  });

  it('assigns grade C for score 40-59', () => {
    // severity=15(medium), confidence=15(medium), fp=8(medium), tests=10(1v), uniqueness=5 → 53
    const coverage = new Map([['T1001', 1]]);
    const result = computeQualityScore('medium', 'medium', 'medium', ['T1001'], 1, 0, coverage);
    expect(result.grade).toBe('C');
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(60);
  });

  it('assigns grade D for score 20-39', () => {
    // severity=10(low), confidence=5(low), fp=0(high), tests=0, uniqueness=0 → 15... F
    // severity=15(medium), confidence=15(medium), fp=0(high), tests=0, uniqueness=0 → 30 = D
    const result = computeQualityScore('medium', 'medium', 'high', ['T1001'], 0, 0, noTechCoverage);
    expect(result.grade).toBe('D');
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.score).toBeLessThan(40);
  });

  it('tests score is capped at 30 regardless of validated count', () => {
    const result = computeQualityScore('medium', 'medium', 'medium', [], 100, 0, noTechCoverage);
    expect(result.components.tests).toBe(30);
  });

  it('tests score is floored at 0 even with many failures', () => {
    const result = computeQualityScore('medium', 'medium', 'medium', [], 0, 100, noTechCoverage);
    expect(result.components.tests).toBe(0);
  });

  it('uniqueness score is 5 when all techniques are unique (coverage=1)', () => {
    const coverage = new Map([['T1001', 1], ['T1002', 1]]);
    const result = computeQualityScore('medium', 'medium', 'medium', ['T1001', 'T1002'], 0, 0, coverage);
    expect(result.components.uniqueness).toBe(5);
  });

  it('uniqueness score is 0 when all techniques are shared (coverage>1)', () => {
    const coverage = new Map([['T1001', 3], ['T1002', 2]]);
    const result = computeQualityScore('medium', 'medium', 'medium', ['T1001', 'T1002'], 0, 0, coverage);
    expect(result.components.uniqueness).toBe(0);
  });

  it('uniqueness score is 0 for an empty technique list', () => {
    const result = computeQualityScore('medium', 'medium', 'medium', [], 0, 0, noTechCoverage);
    expect(result.components.uniqueness).toBe(0);
  });

  it('defaults unknown severity/confidence/fp to mid-range values', () => {
    const result = computeQualityScore('unknown', 'unknown', null, [], 0, 0, noTechCoverage);
    // defaults: severity=15, confidence=15, fp=8
    expect(result.components.severity).toBe(15);
    expect(result.components.confidence).toBe(15);
    expect(result.components.fp_rate).toBe(8);
  });
});

// ─── Detection CRUD route integration tests ──────────────────────────────────

const testDbHolder = vi.hoisted(() => ({ db: null as KnexType | null }));

vi.mock('../db/database', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../db/database')>();
  return {
    ...mod,
    getKnex: () => testDbHolder.db!,
  };
});

import detectionsRouter from '../routes/detections';

let db: KnexType;

beforeAll(async () => {
  db = createTestDb();
  await setupTestDb(db);
  testDbHolder.db = db;
  // Seed minimal technique data for detection_art_results
  await db.raw(`INSERT OR IGNORE INTO attack_techniques (id, name, tactic_ids, is_subtechnique) VALUES ('T1059', 'Command Scripting', '["TA0002"]', 0)`);
});

afterAll(async () => {
  await db.destroy();
});

function app() {
  return createTestApp(['/api/detections', detectionsRouter]);
}

describe('GET /api/detections', () => {
  it('returns an empty array when no detections exist', async () => {
    const res = await request(app()).get('/api/detections');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/detections', () => {
  it('creates a detection and returns 201 with parsed technique_ids', async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ name: 'Detect PowerShell', technique_ids: ['T1059'], severity: 'high', confidence: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Detect PowerShell');
    expect(res.body.technique_ids).toEqual(['T1059']);
    expect(res.body.severity).toBe('high');
    expect(typeof res.body.id).toBe('number');
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ technique_ids: ['T1059'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when technique_ids is missing', async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ name: 'No Techniques' });
    expect(res.status).toBe(400);
  });

  it('defaults status to active when not provided', async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ name: 'Default Status', technique_ids: ['T1059'] });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
  });
});

describe('GET /api/detections/:id', () => {
  let detectionId: number;

  beforeAll(async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ name: 'Get By ID', technique_ids: ['T1059'], severity: 'low' });
    detectionId = res.body.id;
  });

  it('returns the detection by ID', async () => {
    const res = await request(app()).get(`/api/detections/${detectionId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(detectionId);
    expect(res.body.name).toBe('Get By ID');
    expect(Array.isArray(res.body.technique_ids)).toBe(true);
  });

  it('returns 404 for a non-existent ID', async () => {
    const res = await request(app()).get('/api/detections/99999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/detections/:id', () => {
  let detectionId: number;

  beforeAll(async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ name: 'Update Me', technique_ids: ['T1059'], status: 'planned' });
    detectionId = res.body.id;
  });

  it('updates a detection and returns the updated resource', async () => {
    const res = await request(app())
      .put(`/api/detections/${detectionId}`)
      .send({ name: 'Updated Name', technique_ids: ['T1059'], status: 'active', severity: 'critical', confidence: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.status).toBe('active');
    expect(res.body.severity).toBe('critical');
  });

  it('returns 404 when updating a non-existent detection', async () => {
    const res = await request(app())
      .put('/api/detections/99999')
      .send({ name: 'Ghost', technique_ids: [] });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/detections/:id', () => {
  let detectionId: number;

  beforeAll(async () => {
    const res = await request(app())
      .post('/api/detections')
      .send({ name: 'Delete Me', technique_ids: ['T1059'] });
    detectionId = res.body.id;
  });

  it('deletes a detection and returns 204', async () => {
    const res = await request(app()).delete(`/api/detections/${detectionId}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 when deleting a non-existent detection', async () => {
    const res = await request(app()).delete(`/api/detections/${detectionId}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/detections/bulk', () => {
  let ids: number[];

  beforeAll(async () => {
    const results = await Promise.all([
      request(app()).post('/api/detections').send({ name: 'Bulk A', technique_ids: ['T1059'] }),
      request(app()).post('/api/detections').send({ name: 'Bulk B', technique_ids: ['T1059'] }),
    ]);
    ids = results.map(r => r.body.id);
  });

  it('bulk-updates status for multiple detections', async () => {
    const res = await request(app())
      .patch('/api/detections/bulk')
      .send({ ids, status: 'tuning' });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
  });

  it('rejects an invalid status value', async () => {
    const res = await request(app())
      .patch('/api/detections/bulk')
      .send({ ids, status: 'nonexistent' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ids array is empty', async () => {
    const res = await request(app())
      .patch('/api/detections/bulk')
      .send({ ids: [], status: 'active' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/detections/import', () => {
  it('imports multiple detections from an array', async () => {
    const res = await request(app())
      .post('/api/detections/import')
      .send({
        detections: [
          { name: 'Imported A', technique_ids: ['T1059'], severity: 'high' },
          { name: 'Imported B', technique_ids: ['T1059'], severity: 'low' },
          { name: 'Skip Me' }, // missing technique_ids — should be skipped
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
  });

  it('returns 400 when body is not an array', async () => {
    const res = await request(app())
      .post('/api/detections/import')
      .send({ detections: 'not-an-array' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/detections/quality-scores', () => {
  it('returns a score object for each detection', async () => {
    const res = await request(app()).get('/api/detections/quality-scores');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Every score entry should have required fields
    for (const entry of res.body) {
      expect(entry).toHaveProperty('detection_id');
      expect(entry).toHaveProperty('score');
      expect(entry).toHaveProperty('grade');
      expect(entry).toHaveProperty('components');
      expect(['A', 'B', 'C', 'D', 'F']).toContain(entry.grade);
    }
  });
});
