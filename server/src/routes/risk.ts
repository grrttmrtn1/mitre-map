import { Router } from 'express';
import { getKnex, rawAll, rawGet, buildTechniqueGraph, resolveToParent } from '../db/database';

const router = Router();

router.get('/score', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);
  const total = parentTechIds.size;

  // Build covered parent IDs from active detections (direct + via subtechniques)
  const detections = await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'");
  const covered = new Set<string>();
  for (const d of detections) for (const id of JSON.parse(d.technique_ids)) {
    const p = resolveToParent(id, parentTechIds, subtechToParent);
    if (p) covered.add(p);
  }

  // Load group_techniques once and compute exposure in memory
  const allGroupTechs = await rawAll<{ group_id: string; technique_id: string }>(db,
    'SELECT group_id, technique_id FROM group_techniques');

  // Exposed groups: groups that have at least one technique not covered
  const exposedGroupIds = new Set<string>();
  for (const { group_id, technique_id } of allGroupTechs) {
    const p = resolveToParent(technique_id, parentTechIds, subtechToParent) ?? technique_id;
    if (!covered.has(p)) exposedGroupIds.add(group_id);
  }
  const exposedGroups = exposedGroupIds.size;

  // Critical gaps: parent techniques used by 3+ groups and not covered
  const techGroupMap = new Map<string, Set<string>>();
  for (const { group_id, technique_id } of allGroupTechs) {
    const p = resolveToParent(technique_id, parentTechIds, subtechToParent);
    if (!p) continue;
    if (!techGroupMap.has(p)) techGroupMap.set(p, new Set());
    techGroupMap.get(p)!.add(group_id);
  }
  const criticalGaps = [...techGroupMap.entries()]
    .filter(([techId, gs]) => !covered.has(techId) && gs.size >= 3).length;

  const coveragePct = Math.round((covered.size / total) * 100);
  const baseRisk = 100 - coveragePct;
  const groupExposureFactor = Math.min(10, exposedGroups);
  const criticalFactor = Math.min(15, criticalGaps * 2);
  const riskScore = Math.min(100, baseRisk + groupExposureFactor + criticalFactor);
  const level = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

  res.json({
    score: riskScore, level,
    components: { coverage_gap_pct: 100 - coveragePct, exposed_threat_groups: exposedGroups, critical_gaps: criticalGaps },
    coverage_pct: coveragePct, gap_count: total - covered.size, total_techniques: total,
  });
});

router.get('/by-tactic', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);

  // Build covered parent IDs upfront
  const coveredParents = new Set<string>();
  for (const d of await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'")) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) coveredParents.add(p);
    }
  }

  const tactics = await rawAll(db, 'SELECT * FROM attack_tactics ORDER BY name');
  const result = await Promise.all(tactics.map(async (tac: any) => {
    const techniques = await rawAll<{ id: string }>(db,
      'SELECT id FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ?', [`%${tac.id}%`]);
    let covered = 0;
    let groupExposure = 0;
    for (const t of techniques) {
      if (coveredParents.has(t.id)) covered++;
      const { c: gCount } = await rawGet<{ c: number }>(db,
        'SELECT COUNT(DISTINCT group_id) as c FROM group_techniques WHERE technique_id=?', [t.id]) as any;
      groupExposure += gCount;
    }
    const pct = techniques.length ? Math.round((covered / techniques.length) * 100) : 100;
    const riskScore = Math.min(100, (100 - pct) + Math.min(20, groupExposure));
    return {
      tactic_id: tac.id, tactic_name: tac.name,
      total_techniques: techniques.length, covered, gap_count: techniques.length - covered,
      coverage_pct: pct, group_exposure_score: groupExposure, risk_score: riskScore,
      risk_level: riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
    };
  }));
  res.json(result.sort((a, b) => b.risk_score - a.risk_score));
});

router.get('/by-technique', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);

  // Build covered parent IDs from detections
  const coveredByDetection = new Set<string>();
  for (const d of await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'")) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) coveredByDetection.add(p);
    }
  }

  // Build mitigated parent IDs (direct + via subtechniques)
  const mitigatedParents = new Set<string>();
  for (const r of await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tlm ON tm.mitigation_id=tlm.mitigation_id
    JOIN tools tl ON tlm.tool_id=tl.id WHERE tl.status='active'
  `)) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent);
    if (p) mitigatedParents.add(p);
  }

  const techniques = await rawAll<{ id: string; name: string; tactic_ids: string }>(
    db, 'SELECT id, name, tactic_ids FROM attack_techniques WHERE is_subtechnique=0');
  const result = await Promise.all(techniques.map(async t => {
    const detected = coveredByDetection.has(t.id);
    const mitigated = mitigatedParents.has(t.id);
    const [{ c: groupCount }, { c: complianceCount }] = await Promise.all([
      rawGet<{ c: number }>(db, 'SELECT COUNT(DISTINCT group_id) as c FROM group_techniques WHERE technique_id=?', [t.id]),
      rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM technique_compliance WHERE technique_id=?', [t.id]),
    ]) as any[];
    const detectionScore = detected ? 0 : mitigated ? 20 : 40;
    const groupScore = Math.min(40, groupCount * 10);
    const complianceScore = Math.min(20, complianceCount * 5);
    const riskScore = detectionScore + groupScore + complianceScore;
    return {
      id: t.id, name: t.name, tactic_ids: JSON.parse(t.tactic_ids),
      detected, mitigated, group_count: groupCount, compliance_count: complianceCount,
      risk_score: riskScore,
      risk_level: riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
    };
  }));
  res.json(result.filter(t => t.risk_score >= 20).sort((a, b) => b.risk_score - a.risk_score));
});

export default router;
