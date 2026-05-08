import { Router } from 'express';
import { getKnex, rawAll, rawGet } from '../db/database';

const router = Router();

router.get('/stats', async (_req, res) => {
  const db = getKnex();
  const { c: totalTechniques } = await rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique=0') as any;
  const [{ c: totalDetections }, { c: activeDetections }, { c: tuningDetections }, { c: disabledDetections }, { c: plannedDetections }, { c: totalTools }, { c: activeTools }] = await Promise.all([
    rawGet<any>(db, 'SELECT COUNT(*) as c FROM detections'),
    rawGet<any>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active'"),
    rawGet<any>(db, "SELECT COUNT(*) as c FROM detections WHERE status='tuning'"),
    rawGet<any>(db, "SELECT COUNT(*) as c FROM detections WHERE status='disabled'"),
    rawGet<any>(db, "SELECT COUNT(*) as c FROM detections WHERE status='planned'"),
    rawGet<any>(db, "SELECT COUNT(*) as c FROM tools WHERE status!='deprecated'"),
    rawGet<any>(db, "SELECT COUNT(*) as c FROM tools WHERE status='active'"),
  ]);

  const detectedTechniqueIds = new Set<string>();
  const allDetections = await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'");
  for (const d of allDetections) for (const id of JSON.parse(d.technique_ids)) detectedTechniqueIds.add(id);

  const mitigatedTechniqueIds = new Set<string>();
  const techsWithMitigations = await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `);
  for (const r of techsWithMitigations) mitigatedTechniqueIds.add(r.technique_id);

  const coveredCount = new Set([...detectedTechniqueIds, ...mitigatedTechniqueIds]).size;

  const tactics = await rawAll(db, 'SELECT * FROM attack_tactics ORDER BY id');
  const tacticStats = await Promise.all(tactics.map(async (tactic: any) => {
    const techs = await rawAll<{ id: string }>(db,
      'SELECT id FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ?', [`%"${tactic.id}"%`]);
    const techIds = techs.map(t => t.id);
    const detected = techIds.filter(id => detectedTechniqueIds.has(id)).length;
    const mitigated = techIds.filter(id => mitigatedTechniqueIds.has(id)).length;
    const covered = techIds.filter(id => detectedTechniqueIds.has(id) || mitigatedTechniqueIds.has(id)).length;
    return {
      tactic_id: tactic.id, tactic_name: tactic.name,
      total: techIds.length, detected, mitigated, covered,
      gap: techIds.length - covered,
      pct: techIds.length > 0 ? Math.round((covered / techIds.length) * 100) : 0,
    };
  }));

  res.json({
    total_techniques: totalTechniques, detected_techniques: detectedTechniqueIds.size,
    mitigated_techniques: mitigatedTechniqueIds.size, covered_techniques: coveredCount,
    gap_techniques: totalTechniques - coveredCount,
    coverage_pct: Math.round((coveredCount / totalTechniques) * 100),
    detection_pct: Math.round((detectedTechniqueIds.size / totalTechniques) * 100),
    total_detections: totalDetections, active_detections: activeDetections,
    tuning_detections: tuningDetections, disabled_detections: disabledDetections,
    planned_detections: plannedDetections, total_tools: totalTools, active_tools: activeTools,
    tactic_stats: tacticStats,
  });
});

router.get('/matrix', async (_req, res) => {
  const db = getKnex();
  const tactics = await rawAll(db, 'SELECT * FROM attack_tactics ORDER BY id');
  const allDetections = await rawAll<{ id: number; name: string; status: string; severity: string; technique_ids: string }>(
    db, 'SELECT id, name, status, severity, technique_ids FROM detections'
  );
  const parsedDetections = allDetections.map(d => ({ ...d, technique_ids: JSON.parse(d.technique_ids) as string[] }));

  const toolMitigatedTechs = new Set<string>();
  const techsWithMitigations = await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `);
  for (const r of techsWithMitigations) toolMitigatedTechs.add(r.technique_id);

  const columns = await Promise.all(tactics.map(async (tactic: any) => {
    const techniques = await rawAll<{ id: string; name: string }>(db,
      'SELECT id, name FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ? ORDER BY id', [`%"${tactic.id}"%`]);
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
        id: tech.id, name: tech.name, status,
        detection_count: activeDetections.length,
        detections: activeDetections.map(d => ({ id: d.id, name: d.name, severity: d.severity })),
      };
    });
    return { tactic, cells };
  }));

  res.json(columns);
});

router.get('/gaps', async (_req, res) => {
  const db = getKnex();
  const detectedIds = new Set<string>();
  for (const d of await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'")) {
    for (const id of JSON.parse(d.technique_ids)) detectedIds.add(id);
  }
  const mitigatedIds = new Set<string>();
  for (const r of await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `)) mitigatedIds.add(r.technique_id);

  const allTechniques = await rawAll<any>(db, 'SELECT * FROM attack_techniques WHERE is_subtechnique=0');
  const gaps = await Promise.all(
    allTechniques
      .filter(t => !detectedIds.has(t.id) && !mitigatedIds.has(t.id))
      .map(async t => {
        const tacticIds: string[] = JSON.parse(t.tactic_ids);
        const [tactics, d3fend, mitigations] = await Promise.all([
          rawAll(db, `SELECT name FROM attack_tactics WHERE id IN (${tacticIds.map(() => '?').join(',')})`, tacticIds),
          rawAll(db, `SELECT d.id, d.name, d.category FROM d3fend_techniques d JOIN attack_d3fend ad ON d.id = ad.d3fend_id WHERE ad.attack_id = ? ORDER BY d.category`, [t.id]),
          rawAll(db, `SELECT m.id, m.name FROM attack_mitigations m JOIN technique_mitigations tm ON m.id = tm.mitigation_id WHERE tm.technique_id = ?`, [t.id]),
        ]);
        return {
          ...t, tactic_ids: tacticIds,
          tactic_names: tactics.map((ta: any) => ta.name),
          recommended_d3fend: d3fend,
          recommended_mitigations: mitigations,
        };
      })
  );
  res.json(gaps);
});

export default router;
