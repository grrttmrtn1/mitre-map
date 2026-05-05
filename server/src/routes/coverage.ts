import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

router.get('/stats', (_req, res) => {
  const db = getDb();

  const totalTechniques = (db.prepare('SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique = 0').get() as any).c;
  const totalDetections = (db.prepare('SELECT COUNT(*) as c FROM detections').get() as any).c;
  const activeDetections = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status = 'active'").get() as any).c;
  const tuningDetections = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status = 'tuning'").get() as any).c;
  const disabledDetections = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status = 'disabled'").get() as any).c;
  const plannedDetections = (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status = 'planned'").get() as any).c;
  const totalTools = (db.prepare("SELECT COUNT(*) as c FROM tools WHERE status != 'deprecated'").get() as any).c;
  const activeTools = (db.prepare("SELECT COUNT(*) as c FROM tools WHERE status = 'active'").get() as any).c;

  const detectedTechniqueIds = new Set<string>();
  const allDetections = db.prepare('SELECT technique_ids FROM detections WHERE status = ?').all('active') as any[];
  for (const d of allDetections) {
    for (const id of JSON.parse(d.technique_ids)) detectedTechniqueIds.add(id);
  }

  const mitigatedTechniqueIds = new Set<string>();
  const techsWithMitigations = db.prepare(`
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status = 'active'
  `).all() as any[];
  for (const r of techsWithMitigations) mitigatedTechniqueIds.add(r.technique_id);

  const coveredCount = new Set([...detectedTechniqueIds, ...mitigatedTechniqueIds]).size;
  const detectionOnlyCount = detectedTechniqueIds.size;
  const gapCount = totalTechniques - coveredCount;

  const tacticCoverage = db.prepare('SELECT * FROM attack_tactics ORDER BY id').all() as any[];
  const tacticStats = tacticCoverage.map(tactic => {
    const techs = db.prepare(
      'SELECT id FROM attack_techniques WHERE is_subtechnique = 0 AND tactic_ids LIKE ?'
    ).all(`%"${tactic.id}"%`) as any[];
    const techIds = techs.map(t => t.id);
    const detected = techIds.filter(id => detectedTechniqueIds.has(id)).length;
    const mitigated = techIds.filter(id => mitigatedTechniqueIds.has(id)).length;
    const covered = techIds.filter(id => detectedTechniqueIds.has(id) || mitigatedTechniqueIds.has(id)).length;
    return {
      tactic_id: tactic.id,
      tactic_name: tactic.name,
      total: techIds.length,
      detected,
      mitigated,
      covered,
      gap: techIds.length - covered,
      pct: techIds.length > 0 ? Math.round((covered / techIds.length) * 100) : 0,
    };
  });

  res.json({
    total_techniques: totalTechniques,
    detected_techniques: detectionOnlyCount,
    mitigated_techniques: mitigatedTechniqueIds.size,
    covered_techniques: coveredCount,
    gap_techniques: gapCount,
    coverage_pct: Math.round((coveredCount / totalTechniques) * 100),
    detection_pct: Math.round((detectionOnlyCount / totalTechniques) * 100),
    total_detections: totalDetections,
    active_detections: activeDetections,
    tuning_detections: tuningDetections,
    disabled_detections: disabledDetections,
    planned_detections: plannedDetections,
    total_tools: totalTools,
    active_tools: activeTools,
    tactic_stats: tacticStats,
  });
});

router.get('/matrix', (_req, res) => {
  const db = getDb();

  const tactics = db.prepare('SELECT * FROM attack_tactics ORDER BY id').all() as any[];
  const allDetections = db.prepare('SELECT id, name, status, severity, technique_ids FROM detections').all() as any[];
  const parsedDetections = allDetections.map(d => ({ ...d, technique_ids: JSON.parse(d.technique_ids) as string[] }));

  const toolMitigatedTechs = new Set<string>();
  const techsWithMitigations = db.prepare(`
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status = 'active'
  `).all() as any[];
  for (const r of techsWithMitigations) toolMitigatedTechs.add(r.technique_id);

  const columns = tactics.map(tactic => {
    const techniques = db.prepare(
      'SELECT id, name FROM attack_techniques WHERE is_subtechnique = 0 AND tactic_ids LIKE ? ORDER BY id'
    ).all(`%"${tactic.id}"%`) as any[];

    const cells = techniques.map(tech => {
      const detections = parsedDetections.filter(d => d.technique_ids.includes(tech.id));
      const activeDetections = detections.filter(d => d.status === 'active');
      const tuningDetections = detections.filter(d => d.status === 'tuning');
      const plannedDetections = detections.filter(d => d.status === 'planned');
      const isMitigated = toolMitigatedTechs.has(tech.id);

      let status: string;
      if (activeDetections.length > 0 && isMitigated) status = 'full';
      else if (activeDetections.length > 0) status = 'detected';
      else if (isMitigated) status = 'mitigated';
      else if (tuningDetections.length > 0) status = 'tuning';
      else if (plannedDetections.length > 0) status = 'planned';
      else status = 'gap';

      return {
        id: tech.id,
        name: tech.name,
        status,
        detection_count: activeDetections.length,
        detections: activeDetections.map(d => ({ id: d.id, name: d.name, severity: d.severity })),
      };
    });

    return { tactic, cells };
  });

  res.json(columns);
});

router.get('/gaps', (_req, res) => {
  const db = getDb();

  const detectedIds = new Set<string>();
  const allActiveDetections = db.prepare("SELECT technique_ids FROM detections WHERE status = 'active'").all() as any[];
  for (const d of allActiveDetections) {
    for (const id of JSON.parse(d.technique_ids)) detectedIds.add(id);
  }

  const mitigatedIds = new Set<string>();
  const techsWithMitigations = db.prepare(`
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status = 'active'
  `).all() as any[];
  for (const r of techsWithMitigations) mitigatedIds.add(r.technique_id);

  const allTechniques = db.prepare('SELECT * FROM attack_techniques WHERE is_subtechnique = 0').all() as any[];

  const gaps = allTechniques
    .filter(t => !detectedIds.has(t.id) && !mitigatedIds.has(t.id))
    .map(t => {
      const tacticIds: string[] = JSON.parse(t.tactic_ids);
      const tactics = db.prepare(
        `SELECT name FROM attack_tactics WHERE id IN (${tacticIds.map(() => '?').join(',')})`
      ).all(...tacticIds) as any[];

      const d3fend = db.prepare(`
        SELECT d.id, d.name, d.category FROM d3fend_techniques d
        JOIN attack_d3fend ad ON d.id = ad.d3fend_id
        WHERE ad.attack_id = ?
        ORDER BY d.category
      `).all(t.id);

      const mitigations = db.prepare(`
        SELECT m.id, m.name FROM attack_mitigations m
        JOIN technique_mitigations tm ON m.id = tm.mitigation_id
        WHERE tm.technique_id = ?
      `).all(t.id);

      return {
        ...t,
        tactic_ids: tacticIds,
        tactic_names: tactics.map((ta: any) => ta.name),
        recommended_d3fend: d3fend,
        recommended_mitigations: mitigations,
      };
    });

  res.json(gaps);
});

export default router;
