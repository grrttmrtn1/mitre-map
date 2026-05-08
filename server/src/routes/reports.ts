import { Router } from 'express';
import { getKnex, rawAll, rawGet } from '../db/database';

const router = Router();

router.get('/executive', async (_req, res) => {
  const db = getKnex();
  const [{ c: totalTechniques }, { c: activeDetections }, { c: totalDetections }, { c: activeTools }] = await Promise.all([
    rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique=0'),
    rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active'"),
    rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM detections'),
    rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM tools WHERE status='active'"),
  ]) as any[];

  const detections = await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'");
  const covered = new Set<string>();
  for (const d of detections) for (const id of JSON.parse(d.technique_ids)) covered.add(id);

  const [severityCounts, tacticCoverage, topGaps, snapshots] = await Promise.all([
    rawAll(db, "SELECT severity, COUNT(*) as count FROM detections WHERE status='active' GROUP BY severity"),
    rawAll(db, `
      SELECT ta.id, ta.name,
        COUNT(DISTINCT t.id) as total,
        SUM(CASE WHEN (
          SELECT COUNT(*) FROM detections d
          WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%'
        ) > 0 THEN 1 ELSE 0 END) as covered
      FROM attack_tactics ta
      JOIN attack_techniques t ON t.tactic_ids LIKE '%' || ta.id || '%'
      WHERE t.is_subtechnique=0
      GROUP BY ta.id, ta.name
      ORDER BY ta.name
    `),
    rawAll<any>(db, `SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t WHERE t.is_subtechnique=0
      AND NOT EXISTS (SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%')
      ORDER BY t.id LIMIT 20`),
    rawAll(db, 'SELECT * FROM coverage_snapshots ORDER BY taken_at DESC LIMIT 2'),
  ]);

  const trend = (snapshots as any[]).length >= 2 ? {
    coverage_change: (snapshots[0] as any).coverage_pct - (snapshots[1] as any).coverage_pct,
    detection_change: (snapshots[0] as any).active_detections - (snapshots[1] as any).active_detections,
  } : null;

  res.json({
    generated_at: new Date().toISOString(),
    summary: {
      total_techniques: totalTechniques, covered_techniques: covered.size,
      coverage_pct: Math.round((covered.size / totalTechniques) * 100),
      gap_count: totalTechniques - covered.size,
      active_detections: activeDetections, total_detections: totalDetections, active_tools: activeTools,
    },
    trend, severity_breakdown: severityCounts,
    tactic_coverage: (tacticCoverage as any[]).map(t => ({
      ...t, covered: Number(t.covered), total: Number(t.total),
      pct: Math.round((Number(t.covered) / Number(t.total)) * 100),
    })),
    top_gaps: topGaps.map(t => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
  });
});

router.get('/threat-landscape', async (_req, res) => {
  const db = getKnex();

  const groups = await rawAll(db, `
    SELECT tg.*, COUNT(gt.technique_id) as total_techniques,
      SUM(CASE WHEN (
        SELECT COUNT(*) FROM detections d
        WHERE d.status='active' AND d.technique_ids LIKE '%"' || gt.technique_id || '"%'
      ) > 0 THEN 1 ELSE 0 END) as covered_count
    FROM threat_groups tg
    LEFT JOIN group_techniques gt ON tg.id = gt.group_id
    GROUP BY tg.id
    ORDER BY tg.motivation, tg.country
  `);

  const result = (groups as any[]).map(g => {
    const total = Number(g.total_techniques);
    const covered = Number(g.covered_count ?? 0);
    const exposure = total - covered;
    return {
      id: g.id, name: g.name, country: g.country, motivation: g.motivation,
      aliases: JSON.parse(g.aliases), total_techniques: total, covered, exposure,
      exposure_pct: total ? Math.round((exposure / total) * 100) : 0,
      risk_level: exposure > 8 ? 'critical' : exposure > 5 ? 'high' : exposure > 2 ? 'medium' : 'low',
    };
  });

  res.json({ generated_at: new Date().toISOString(), groups: result.sort((a, b) => b.exposure - a.exposure) });
});

router.get('/gaps', async (_req, res) => {
  const db = getKnex();
  const gaps = await rawAll<any>(db, `
    SELECT t.id, t.name, t.tactic_ids,
      (SELECT COUNT(*) FROM group_techniques gt WHERE gt.technique_id=t.id) as group_count,
      CASE WHEN EXISTS (
        SELECT 1 FROM technique_mitigations tm
        JOIN tool_mitigations tlm ON tm.mitigation_id=tlm.mitigation_id
        JOIN tools tl ON tlm.tool_id=tl.id
        WHERE tm.technique_id=t.id AND tl.status='active'
      ) THEN 1 ELSE 0 END as mitigated,
      (SELECT COUNT(*) FROM technique_compliance tc WHERE tc.technique_id=t.id) as compliance_impact
    FROM attack_techniques t
    WHERE t.is_subtechnique=0
      AND NOT EXISTS (SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%')
    ORDER BY t.id
  `);

  const enriched = gaps.map(g => {
    const groupCount = Number(g.group_count);
    const mitigated = Boolean(g.mitigated);
    const complianceImpact = Number(g.compliance_impact);
    const priority_score = groupCount * 3 + complianceImpact * 2 + (mitigated ? 0 : 1);
    return { ...g, tactic_ids: JSON.parse(g.tactic_ids), group_count: groupCount, mitigated, compliance_impact: complianceImpact, priority_score };
  });

  res.json({ generated_at: new Date().toISOString(), total_gaps: enriched.length, gaps: enriched.sort((a, b) => b.priority_score - a.priority_score) });
});

export default router;
