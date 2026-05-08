import { Router } from 'express';
import { getKnex, rawAll, rawGet, buildTechniqueGraph, resolveToParent } from '../db/database';

const router = Router();

router.get('/executive', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);
  const totalTechniques = parentTechIds.size;

  const [{ c: activeDetections }, { c: totalDetections }, { c: activeTools }] = await Promise.all([
    rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active'"),
    rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM detections'),
    rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM tools WHERE status='active'"),
  ]) as any[];

  // Build covered parent IDs from active detections
  const detections = await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'");
  const covered = new Set<string>();
  for (const d of detections) for (const id of JSON.parse(d.technique_ids)) {
    const p = resolveToParent(id, parentTechIds, subtechToParent);
    if (p) covered.add(p);
  }

  // Tactic coverage using in-memory covered set
  const tacticsData = await rawAll<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_tactics ORDER BY name');
  const tacticCoverage = await Promise.all(tacticsData.map(async ta => {
    const techs = await rawAll<{ id: string }>(db,
      'SELECT id FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ?', [`%${ta.id}%`]);
    const total = techs.length;
    const coveredCount = techs.filter(t => covered.has(t.id)).length;
    return { id: ta.id, name: ta.name, total, covered: coveredCount, pct: total ? Math.round((coveredCount / total) * 100) : 0 };
  }));

  // Top gaps: parent techniques not covered, with subtechnique count context
  const topGaps = await rawAll<any>(db, `
    SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t WHERE t.is_subtechnique=0
    ORDER BY t.id LIMIT 100
  `);
  const uncoveredGaps = topGaps
    .filter(t => !covered.has(t.id))
    .slice(0, 20)
    .map(t => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) }));

  const [severityCounts, snapshots] = await Promise.all([
    rawAll(db, "SELECT severity, COUNT(*) as count FROM detections WHERE status='active' GROUP BY severity"),
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
    tactic_coverage: tacticCoverage,
    top_gaps: uncoveredGaps,
  });
});

router.get('/threat-landscape', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);

  // Build covered parent IDs from active detections
  const coveredParents = new Set<string>();
  for (const d of await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'")) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) coveredParents.add(p);
    }
  }

  const groups = await rawAll(db, `
    SELECT tg.*, COUNT(gt.technique_id) as total_techniques
    FROM threat_groups tg
    LEFT JOIN group_techniques gt ON tg.id = gt.group_id
    GROUP BY tg.id
    ORDER BY tg.motivation, tg.country
  `);

  const result = await Promise.all((groups as any[]).map(async g => {
    const groupTechs = await rawAll<{ technique_id: string }>(db,
      'SELECT technique_id FROM group_techniques WHERE group_id=?', [g.id]);
    const total = groupTechs.length;
    let coveredCount = 0;
    for (const { technique_id } of groupTechs) {
      const resolved = resolveToParent(technique_id, parentTechIds, subtechToParent) ?? technique_id;
      if (coveredParents.has(resolved)) coveredCount++;
    }
    const exposure = total - coveredCount;
    return {
      id: g.id, name: g.name, country: g.country, motivation: g.motivation,
      aliases: JSON.parse(g.aliases), total_techniques: total, covered: coveredCount, exposure,
      exposure_pct: total ? Math.round((exposure / total) * 100) : 0,
      risk_level: exposure > 8 ? 'critical' : exposure > 5 ? 'high' : exposure > 2 ? 'medium' : 'low',
    };
  }));

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
      AND NOT EXISTS (
        SELECT 1 FROM attack_techniques sub
        JOIN detections d ON d.status='active' AND d.technique_ids LIKE '%"' || sub.id || '"%'
        WHERE sub.parent_id=t.id AND sub.is_subtechnique=1
      )
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
