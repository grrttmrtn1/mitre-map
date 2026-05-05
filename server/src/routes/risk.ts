import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

// Overall risk score (0-100, higher = more exposed)
router.get('/score', (_req, res) => {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique=0').get() as any).c;
  const detections = db.prepare("SELECT technique_ids FROM detections WHERE status='active'").all() as any[];
  const covered = new Set<string>();
  for (const d of detections) for (const id of JSON.parse(d.technique_ids)) covered.add(id);
  const gapCount = total - covered.size;

  // Weight by group targeting — uncovered techniques used by more groups = higher risk
  const exposedGroups = db.prepare(`
    SELECT COUNT(DISTINCT gt.group_id) as c FROM group_techniques gt
    WHERE NOT EXISTS (
      SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || gt.technique_id || '"%'
    )
  `).get() as any;

  const criticalGaps = db.prepare(`
    SELECT COUNT(DISTINCT t.id) as c FROM attack_techniques t
    JOIN group_techniques gt ON t.id = gt.technique_id
    WHERE t.is_subtechnique=0
    AND NOT EXISTS (SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%')
    GROUP BY t.id HAVING COUNT(DISTINCT gt.group_id) >= 3
  `).all().length;

  const coveragePct = Math.round((covered.size / total) * 100);
  const baseRisk = 100 - coveragePct;
  const groupExposureFactor = Math.min(10, exposedGroups.c);
  const criticalFactor = Math.min(15, criticalGaps * 2);
  const riskScore = Math.min(100, baseRisk + groupExposureFactor + criticalFactor);

  const level = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';

  res.json({
    score: riskScore,
    level,
    components: {
      coverage_gap_pct: 100 - coveragePct,
      exposed_threat_groups: exposedGroups.c,
      critical_gaps: criticalGaps,
    },
    coverage_pct: coveragePct,
    gap_count: gapCount,
    total_techniques: total,
  });
});

// Risk per tactic
router.get('/by-tactic', (_req, res) => {
  const db = getDb();
  const tactics = db.prepare('SELECT * FROM attack_tactics ORDER BY name').all() as any[];

  const result = tactics.map(tac => {
    const techniques = db.prepare(
      "SELECT id FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ?"
    ).all(`%${tac.id}%`) as any[];

    const covered = techniques.filter(t =>
      (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?").get(`%"${t.id}"%`) as any).c > 0
    ).length;

    const groupExposure = techniques.reduce((acc, t) => {
      return acc + (db.prepare('SELECT COUNT(DISTINCT group_id) as c FROM group_techniques WHERE technique_id = ?').get(t.id) as any).c;
    }, 0);

    const gapCount = techniques.length - covered;
    const pct = techniques.length ? Math.round((covered / techniques.length) * 100) : 100;
    const riskScore = Math.min(100, (100 - pct) + Math.min(20, groupExposure));

    return {
      tactic_id: tac.id,
      tactic_name: tac.name,
      total_techniques: techniques.length,
      covered,
      gap_count: gapCount,
      coverage_pct: pct,
      group_exposure_score: groupExposure,
      risk_score: riskScore,
      risk_level: riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
    };
  });

  res.json(result.sort((a, b) => b.risk_score - a.risk_score));
});

// Risk per technique (for heat map)
router.get('/by-technique', (_req, res) => {
  const db = getDb();
  const { min_score = '20' } = (db as any).query ?? {};

  const techniques = db.prepare('SELECT id, name, tactic_ids FROM attack_techniques WHERE is_subtechnique=0').all() as any[];

  const result = techniques.map(t => {
    const detected = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?").get(`%"${t.id}"%`) as any).c > 0;
    const mitigated = (db.prepare(`
      SELECT COUNT(*) as c FROM technique_mitigations tm
      JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
      JOIN tools tl ON tlm.tool_id = tl.id WHERE tm.technique_id = ? AND tl.status='active'
    `).get(t.id) as any).c > 0;
    const groupCount = (db.prepare('SELECT COUNT(DISTINCT group_id) as c FROM group_techniques WHERE technique_id = ?').get(t.id) as any).c;
    const complianceCount = (db.prepare('SELECT COUNT(*) as c FROM technique_compliance WHERE technique_id = ?').get(t.id) as any).c;

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
  });

  const minScore = Number(min_score);
  res.json(result.filter(t => t.risk_score >= minScore).sort((a, b) => b.risk_score - a.risk_score));
});

export default router;
