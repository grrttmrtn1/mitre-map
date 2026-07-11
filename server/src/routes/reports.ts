import { Router } from 'express';
import { getKnex, rawAll, rawGet, buildTechniqueGraph, resolveToParent, computeCoverageState } from '../db/database';

const router = Router();

router.get('/executive', async (_req, res) => {
  const db = getKnex();
  const coverage = await computeCoverageState(db);
  const { parentTechIds, coveredIds: covered } = coverage;
  const totalTechniques = coverage.total;

  const [{ c: activeDetections }, { c: totalDetections }, { c: activeTools }] = await Promise.all([
    rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active'"),
    rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM detections'),
    rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM tools WHERE status='active'"),
  ]) as any[];

  // Tactic coverage using in-memory covered set
  const tacticsData = await rawAll<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_tactics ORDER BY name');
  const tacticCoverage = await Promise.all(tacticsData.map(async ta => {
    const techs = await rawAll<{ id: string }>(db,
      'SELECT id FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ?', [`%${ta.id}%`]);
    const total = techs.length;
    const coveredCount = techs.filter(t => covered.has(t.id)).length;
    return { id: ta.id, name: ta.name, total, covered: coveredCount, pct: total ? Math.round((coveredCount / total) * 100) : 0 };
  }));

  // Top gaps: rank the complete uncovered set by threat and compliance impact.
  const topGaps = await rawAll<any>(db, `
    SELECT t.id, t.name, t.tactic_ids,
      COUNT(DISTINCT gt.group_id) AS group_count,
      COUNT(DISTINCT tc.control_id) AS compliance_impact
    FROM attack_techniques t
    LEFT JOIN group_techniques gt ON gt.technique_id=t.id
    LEFT JOIN technique_compliance tc ON tc.technique_id=t.id
    WHERE t.is_subtechnique=0
    GROUP BY t.id, t.name, t.tactic_ids
  `);
  const uncoveredGaps = topGaps
    .filter(t => !covered.has(t.id))
    .map(t => ({ ...t, priority_score: Number(t.group_count) * 8 + Number(t.compliance_impact) * 2 }))
    .sort((a, b) => b.priority_score - a.priority_score || a.id.localeCompare(b.id))
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
      coverage_pct: coverage.pct,
      gap_count: totalTechniques - covered.size,
      active_detections: activeDetections, total_detections: totalDetections, active_tools: activeTools,
    },
    methodology: coverage.methodology,
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

  const orgSectorRow = await rawGet<{ value: string | null }>(db, "SELECT value FROM settings WHERE key='org_sector'");
  const orgSector = orgSectorRow?.value ?? null;

  const gaps = await rawAll<any>(db, `
    SELECT t.id, t.name, t.tactic_ids,
      (SELECT COUNT(*) FROM group_techniques gt WHERE gt.technique_id=t.id) as group_count,
      (SELECT COUNT(*) FROM technique_compliance tc WHERE tc.technique_id=t.id) as compliance_impact,
      (SELECT COUNT(*) FROM technique_mitigations tm2 WHERE tm2.technique_id=t.id) as mitigation_guidance,
      CASE WHEN EXISTS (
        SELECT 1 FROM technique_mitigations tm
        JOIN tool_mitigations tlm ON tm.mitigation_id=tlm.mitigation_id
        JOIN tools tl ON tlm.tool_id=tl.id
        WHERE tm.technique_id=t.id AND tl.status='active'
      ) THEN 1 ELSE 0 END as tool_mitigated
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

  // Batch-fetch industry targeting data
  const industryGroupMap = new Map<string, number>();
  if (orgSector) {
    const industryRows = await rawAll<{ technique_id: string; cnt: number }>(db, `
      SELECT gt.technique_id, COUNT(*) as cnt
      FROM group_techniques gt
      JOIN threat_groups tg ON gt.group_id = tg.id
      WHERE tg.targeted_sectors LIKE ?
      GROUP BY gt.technique_id
    `, [`%${orgSector}%`]);
    industryRows.forEach(r => industryGroupMap.set(r.technique_id, Number(r.cnt)));
  }

  const dsRequiredRows = await rawAll<{ technique_id: string; cnt: number }>(db,
    'SELECT technique_id, COUNT(*) as cnt FROM technique_data_sources GROUP BY technique_id');
  const dsRequiredMap = new Map(dsRequiredRows.map(r => [r.technique_id, Number(r.cnt)]));

  const dsCollectingRows = await rawAll<{ technique_id: string; cnt: number }>(db, `
    SELECT tds.technique_id, COUNT(*) as cnt
    FROM technique_data_sources tds
    JOIN org_data_sources ods ON tds.data_source_id = ods.data_source_id
    WHERE ods.status = 'collecting'
    GROUP BY tds.technique_id
  `);
  const dsCollectingMap = new Map(dsCollectingRows.map(r => [r.technique_id, Number(r.cnt)]));

  const enriched = gaps.map(g => {
    const groupCount = Number(g.group_count);
    const industryGroups = industryGroupMap.get(g.id) ?? 0;
    const required = dsRequiredMap.get(g.id) ?? 0;
    const collecting = dsCollectingMap.get(g.id) ?? 0;
    const hasGuidance = Number(g.mitigation_guidance) > 0;

    const groupScore = Math.min(40, groupCount * 8);
    const industryScore = Math.round((industryGroups / Math.max(1, groupCount)) * 30);
    const dsScore = Math.round((collecting / Math.max(1, required)) * 20);
    const guidanceScore = hasGuidance ? 10 : 0;
    const priority_score = groupScore + industryScore + dsScore + guidanceScore;

    return {
      ...g,
      tactic_ids: JSON.parse(g.tactic_ids),
      group_count: groupCount,
      industry_group_count: industryGroups,
      compliance_impact: Number(g.compliance_impact),
      tool_mitigated: Boolean(g.tool_mitigated),
      has_mitigation_guidance: hasGuidance,
      priority_score,
      priority_components: { group: groupScore, industry: industryScore, data_sources: dsScore, mitigation_guidance: guidanceScore },
    };
  });

  res.json({ generated_at: new Date().toISOString(), total_gaps: enriched.length, gaps: enriched.sort((a, b) => b.priority_score - a.priority_score) });
});

export default router;
