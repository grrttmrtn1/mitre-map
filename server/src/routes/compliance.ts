import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawInsert } from '../db/database';

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

export async function snapshotComplianceCoverage(db: any): Promise<void> {
  const frameworks = await rawAll<{ id: string }>(db, 'SELECT id FROM compliance_frameworks');
  for (const fw of frameworks) {
    const total = await rawGet<{ n: number }>(db,
      'SELECT COUNT(*) as n FROM compliance_controls WHERE framework_id = ?', [fw.id]);
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
    ...(gaps as any[]).map(g => [g.id, g.name, g.category ?? '', g.technique_ids ?? '']),
  ];
  const safeCell = (c: unknown) => {
    const raw = String(c);
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = rows.map(r => r.map(safeCell).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.framework_id}-gaps.csv"`);
  res.send(csv);
});

export default router;
