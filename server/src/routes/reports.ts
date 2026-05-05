import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

// Executive summary report
router.get('/executive', (_req, res) => {
  const db = getDb();

  const totalTechniques = (db.prepare('SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique=0').get() as any).c;
  const activeDetections = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active'").get() as any).c;
  const totalDetections = (db.prepare('SELECT COUNT(*) as c FROM detections').get() as any).c;
  const activeTools = (db.prepare("SELECT COUNT(*) as c FROM tools WHERE status='active'").get() as any).c;

  const detections = db.prepare("SELECT technique_ids FROM detections WHERE status='active'").all() as any[];
  const covered = new Set<string>();
  for (const d of detections) for (const id of JSON.parse(d.technique_ids)) covered.add(id);

  const severityCounts = db.prepare(`
    SELECT severity, COUNT(*) as count FROM detections WHERE status='active' GROUP BY severity
  `).all() as any[];

  const tacticCoverage = db.prepare(`
    SELECT ta.id, ta.name, COUNT(DISTINCT t.id) as total FROM attack_tactics ta
    JOIN attack_techniques t ON t.tactic_ids LIKE '%' || ta.id || '%'
    WHERE t.is_subtechnique = 0
    GROUP BY ta.id, ta.name ORDER BY ta.name
  `).all() as any[];

  const tacticCoverageWithDetected = tacticCoverage.map(tac => {
    const tacTechniques = db.prepare(
      "SELECT id FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ?"
    ).all(`%${tac.id}%`) as any[];
    const detectedCount = tacTechniques.filter(t =>
      (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?").get(`%"${t.id}"%`) as any).c > 0
    ).length;
    return { ...tac, covered: detectedCount, pct: Math.round((detectedCount / tac.total) * 100) };
  });

  const gapCount = totalTechniques - covered.size;
  const topGaps = db.prepare(`
    SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t
    WHERE t.is_subtechnique = 0
    AND NOT EXISTS (
      SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%'
    )
    ORDER BY t.id LIMIT 20
  `).all() as any[];

  const snapshots = db.prepare('SELECT * FROM coverage_snapshots ORDER BY taken_at DESC LIMIT 2').all() as any[];
  const trend = snapshots.length >= 2 ? {
    coverage_change: (snapshots[0] as any).coverage_pct - (snapshots[1] as any).coverage_pct,
    detection_change: (snapshots[0] as any).active_detections - (snapshots[1] as any).active_detections,
  } : null;

  res.json({
    generated_at: new Date().toISOString(),
    summary: {
      total_techniques: totalTechniques,
      covered_techniques: covered.size,
      coverage_pct: Math.round((covered.size / totalTechniques) * 100),
      gap_count: gapCount,
      active_detections: activeDetections,
      total_detections: totalDetections,
      active_tools: activeTools,
    },
    trend,
    severity_breakdown: severityCounts,
    tactic_coverage: tacticCoverageWithDetected,
    top_gaps: topGaps.map(t => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
  });
});

// Threat landscape report — coverage per threat group
router.get('/threat-landscape', (_req, res) => {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM threat_groups ORDER BY motivation, country').all() as any[];

  const result = groups.map(g => {
    const techniques = db.prepare(
      'SELECT technique_id FROM group_techniques WHERE group_id = ?'
    ).all(g.id) as any[];
    const covered = techniques.filter(t =>
      (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?").get(`%"${t.technique_id}"%`) as any).c > 0
    ).length;
    const exposure = techniques.length - covered;
    return {
      id: g.id, name: g.name, country: g.country, motivation: g.motivation,
      aliases: JSON.parse(g.aliases),
      total_techniques: techniques.length,
      covered, exposure,
      exposure_pct: techniques.length ? Math.round((exposure / techniques.length) * 100) : 0,
      risk_level: exposure > 8 ? 'critical' : exposure > 5 ? 'high' : exposure > 2 ? 'medium' : 'low',
    };
  });

  res.json({
    generated_at: new Date().toISOString(),
    groups: result.sort((a, b) => b.exposure - a.exposure),
  });
});

// Gap prioritization report
router.get('/gaps', (_req, res) => {
  const db = getDb();
  const gaps = db.prepare(`
    SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t
    WHERE t.is_subtechnique = 0
    AND NOT EXISTS (SELECT 1 FROM detections d WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%')
    ORDER BY t.id
  `).all() as any[];

  const enriched = gaps.map(g => {
    const groupCount = (db.prepare('SELECT COUNT(*) as c FROM group_techniques WHERE technique_id = ?').get(g.id) as any).c;
    const mitigated = (db.prepare(`
      SELECT COUNT(*) as c FROM technique_mitigations tm
      JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
      JOIN tools tl ON tlm.tool_id = tl.id WHERE tm.technique_id = ? AND tl.status='active'
    `).get(g.id) as any).c > 0;
    const complianceImpact = (db.prepare('SELECT COUNT(*) as c FROM technique_compliance WHERE technique_id = ?').get(g.id) as any).c;
    const priority_score = groupCount * 3 + complianceImpact * 2 + (mitigated ? 0 : 1);
    return { ...g, tactic_ids: JSON.parse(g.tactic_ids), group_count: groupCount, mitigated, compliance_impact: complianceImpact, priority_score };
  });

  res.json({
    generated_at: new Date().toISOString(),
    total_gaps: enriched.length,
    gaps: enriched.sort((a, b) => b.priority_score - a.priority_score),
  });
});

export default router;
