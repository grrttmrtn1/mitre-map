import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/frameworks', (_req, res) => {
  const db = getDb();
  const frameworks = db.prepare('SELECT * FROM compliance_frameworks ORDER BY name').all() as any[];
  const withCounts = frameworks.map(f => {
    const total = (db.prepare('SELECT COUNT(*) as c FROM compliance_controls WHERE framework_id = ?').get(f.id) as any).c;
    const covered = (db.prepare(`
      SELECT COUNT(DISTINCT cc.id) as c FROM compliance_controls cc
      JOIN technique_compliance tc ON cc.id = tc.control_id
      JOIN detections d ON d.technique_ids LIKE '%"' || tc.technique_id || '"%'
      WHERE cc.framework_id = ? AND d.status = 'active'
    `).get(f.id) as any).c;
    return { ...f, total_controls: total, covered_controls: covered, coverage_pct: total ? Math.round((covered / total) * 100) : 0 };
  });
  res.json(withCounts);
});

router.get('/frameworks/:id', (req, res) => {
  const db = getDb();
  const framework = db.prepare('SELECT * FROM compliance_frameworks WHERE id = ?').get(req.params.id);
  if (!framework) return res.status(404).json({ error: 'Not found' });
  const controls = db.prepare('SELECT * FROM compliance_controls WHERE framework_id = ? ORDER BY id').all(req.params.id) as any[];
  const withCoverage = controls.map(c => {
    const techniques = db.prepare(`
      SELECT t.id, t.name FROM attack_techniques t
      JOIN technique_compliance tc ON t.id = tc.technique_id
      WHERE tc.control_id = ?
    `).all(c.id) as any[];
    const covered = techniques.filter(t =>
      (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?").get(`%"${t.id}"%`) as any).c > 0
    ).length;
    return { ...c, techniques, covered_techniques: covered, total_techniques: techniques.length };
  });
  res.json({ ...framework, controls: withCoverage });
});

router.get('/controls', (req, res) => {
  const db = getDb();
  const { framework_id } = req.query;
  let query = 'SELECT * FROM compliance_controls WHERE 1=1';
  const params: unknown[] = [];
  if (framework_id) { query += ' AND framework_id = ?'; params.push(framework_id); }
  query += ' ORDER BY framework_id, id';
  res.json(db.prepare(query).all(...params));
});

router.get('/gap', (req, res) => {
  const db = getDb();
  const { framework_id } = req.query;
  let query = `
    SELECT cc.id, cc.name, cc.framework_id, cc.category, tc.technique_id, t.name as technique_name
    FROM compliance_controls cc
    JOIN technique_compliance tc ON cc.id = tc.control_id
    JOIN attack_techniques t ON tc.technique_id = t.id
    LEFT JOIN (
      SELECT DISTINCT technique_ids FROM detections WHERE status = 'active'
    ) d ON d.technique_ids LIKE '%"' || tc.technique_id || '"%'
    WHERE d.technique_ids IS NULL
  `;
  const params: unknown[] = [];
  if (framework_id) { query += ' AND cc.framework_id = ?'; params.push(framework_id); }
  query += ' ORDER BY cc.framework_id, cc.id';
  res.json(db.prepare(query).all(...params));
});

export default router;
