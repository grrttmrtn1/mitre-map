import { Router } from 'express';
import { getKnex, rawAll, rawGet } from '../db/database';

const router = Router();

router.get('/frameworks', async (_req, res) => {
  const db = getKnex();
  const frameworks = await rawAll(db, 'SELECT * FROM compliance_frameworks ORDER BY name');
  const withCounts = await Promise.all(frameworks.map(async (f: any) => {
    const [{ c: total }, { c: covered }] = await Promise.all([
      rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM compliance_controls WHERE framework_id=?', [f.id]),
      rawGet<{ c: number }>(db, `
        SELECT COUNT(DISTINCT cc.id) as c FROM compliance_controls cc
        JOIN technique_compliance tc ON cc.id = tc.control_id
        JOIN detections d ON d.technique_ids LIKE '%"' || tc.technique_id || '"%'
        WHERE cc.framework_id=? AND d.status='active'
      `, [f.id]),
    ]) as any[];
    return { ...f, total_controls: total, covered_controls: covered, coverage_pct: total ? Math.round((covered / total) * 100) : 0 };
  }));
  res.json(withCounts);
});

router.get('/frameworks/:id', async (req, res) => {
  const db = getKnex();
  const framework = await rawGet(db, 'SELECT * FROM compliance_frameworks WHERE id=?', [req.params.id]);
  if (!framework) return res.status(404).json({ error: 'Not found' });
  const controls = await rawAll(db, 'SELECT * FROM compliance_controls WHERE framework_id=? ORDER BY id', [req.params.id]);
  const withCoverage = await Promise.all(controls.map(async (c: any) => {
    const techniques = await rawAll<{ id: string; name: string }>(db, `
      SELECT t.id, t.name FROM attack_techniques t
      JOIN technique_compliance tc ON t.id=tc.technique_id WHERE tc.control_id=?
    `, [c.id]);
    let coveredCount = 0;
    for (const t of techniques) {
      const { c: cnt } = await rawGet<{ c: number }>(db,
        "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?", [`%"${t.id}"%`]) as any;
      if (cnt > 0) coveredCount++;
    }
    return { ...c, techniques, covered_techniques: coveredCount, total_techniques: techniques.length };
  }));
  res.json({ ...framework, controls: withCoverage });
});

router.get('/controls', async (req, res) => {
  const db = getKnex();
  const { framework_id } = req.query;
  let sql = 'SELECT * FROM compliance_controls WHERE 1=1';
  const params: any[] = [];
  if (framework_id) { sql += ' AND framework_id=?'; params.push(framework_id); }
  sql += ' ORDER BY framework_id, id';
  res.json(await rawAll(db, sql, params));
});

router.get('/gap', async (req, res) => {
  const db = getKnex();
  const { framework_id } = req.query;
  let sql = `
    SELECT cc.id, cc.name, cc.framework_id, cc.category, tc.technique_id, t.name as technique_name
    FROM compliance_controls cc
    JOIN technique_compliance tc ON cc.id=tc.control_id
    JOIN attack_techniques t ON tc.technique_id=t.id
    LEFT JOIN (SELECT DISTINCT technique_ids FROM detections WHERE status='active') d
      ON d.technique_ids LIKE '%"' || tc.technique_id || '"%'
    WHERE d.technique_ids IS NULL
  `;
  const params: any[] = [];
  if (framework_id) { sql += ' AND cc.framework_id=?'; params.push(framework_id); }
  sql += ' ORDER BY cc.framework_id, cc.id';
  res.json(await rawAll(db, sql, params));
});

export default router;
