import { Router } from 'express';
import { getKnex, rawAll, rawGet, buildTechniqueGraph, resolveToParent } from '../db/database';

const router = Router();

router.get('/stats', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);
  const totalTechniques = parentTechIds.size;

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
  for (const d of allDetections) for (const id of JSON.parse(d.technique_ids)) {
    const p = resolveToParent(id, parentTechIds, subtechToParent);
    if (p) detectedTechniqueIds.add(p);
  }

  const mitigatedTechniqueIds = new Set<string>();
  const techsWithMitigations = await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `);
  for (const r of techsWithMitigations) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent);
    if (p) mitigatedTechniqueIds.add(p);
  }

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

  // Raw set of all technique IDs that have active-tool-backed mitigations
  const rawMitigatedRows = await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `);
  const rawMitigatedSet = new Set(rawMitigatedRows.map(r => r.technique_id));

  // Load all subtechniques upfront with names for matrix display
  const allSubtechDetails = await rawAll<{ id: string; name: string; parent_id: string }>(db,
    'SELECT id, name, parent_id FROM attack_techniques WHERE is_subtechnique=1 AND parent_id IS NOT NULL ORDER BY id');
  const subtechsByParent = new Map<string, Array<{ id: string; name: string }>>();
  for (const st of allSubtechDetails) {
    if (!subtechsByParent.has(st.parent_id)) subtechsByParent.set(st.parent_id, []);
    subtechsByParent.get(st.parent_id)!.push({ id: st.id, name: st.name });
  }

  const columns = await Promise.all(tactics.map(async (tactic: any) => {
    const techniques = await rawAll<{ id: string; name: string }>(db,
      'SELECT id, name FROM attack_techniques WHERE is_subtechnique=0 AND tactic_ids LIKE ? ORDER BY id', [`%"${tactic.id}"%`]);

    const cells = techniques.map(tech => {
      const subs = subtechsByParent.get(tech.id) ?? [];

      // Build individual subtechnique cells
      const subtechniques = subs.map(sub => {
        const subDets = parsedDetections.filter(d => d.technique_ids.includes(sub.id));
        const subActive = subDets.filter(d => d.status === 'active');
        const subTuning = subDets.filter(d => d.status === 'tuning');
        const subPlanned = subDets.filter(d => d.status === 'planned');
        const subMitigated = rawMitigatedSet.has(sub.id);
        let subStatus: string;
        if (subActive.length > 0 && subMitigated) subStatus = 'full';
        else if (subActive.length > 0) subStatus = 'detected';
        else if (subMitigated) subStatus = 'mitigated';
        else if (subTuning.length > 0) subStatus = 'tuning';
        else if (subPlanned.length > 0) subStatus = 'planned';
        else subStatus = 'gap';
        return {
          id: sub.id, name: sub.name, status: subStatus,
          detection_count: subActive.length,
          detections: subActive.map(d => ({ id: d.id, name: d.name, severity: d.severity })),
        };
      });

      // Parent-level detections (direct only, not via subtechniques)
      const directDets = parsedDetections.filter(d => d.technique_ids.includes(tech.id));
      const directActive = directDets.filter(d => d.status === 'active');
      const directTuning = directDets.filter(d => d.status === 'tuning');
      const directPlanned = directDets.filter(d => d.status === 'planned');

      // Combined status: aggregate parent + all subtechniques
      const hasActive = directActive.length > 0 || subtechniques.some(s => s.detection_count > 0);
      const hasTuning = directTuning.length > 0 || subtechniques.some(s => s.status === 'tuning');
      const hasPlanned = directPlanned.length > 0 || subtechniques.some(s => s.status === 'planned');
      const isMitigated = rawMitigatedSet.has(tech.id) || subtechniques.some(s => s.status === 'mitigated' || s.status === 'full');

      let status: string;
      if (hasActive && isMitigated) status = 'full';
      else if (hasActive) status = 'detected';
      else if (isMitigated) status = 'mitigated';
      else if (hasTuning) status = 'tuning';
      else if (hasPlanned) status = 'planned';
      else status = 'gap';

      return {
        id: tech.id, name: tech.name, status,
        detection_count: directActive.length + subtechniques.reduce((s, st) => s + st.detection_count, 0),
        detections: directActive.map(d => ({ id: d.id, name: d.name, severity: d.severity })),
        subtechniques,
        subtechnique_count: subs.length,
        subtechnique_covered: subtechniques.filter(s => s.status !== 'gap').length,
      };
    });
    return { tactic, cells };
  }));

  res.json(columns);
});

router.get('/covered', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);

  const techDetections = new Map<string, Set<number>>();
  const techTools = new Map<string, Set<number>>();

  const activeDetections = await rawAll<{ id: number; name: string; severity: string; status: string; technique_ids: string }>(
    db, "SELECT id, name, severity, status, technique_ids FROM detections WHERE status='active'"
  );
  for (const d of activeDetections) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) {
        if (!techDetections.has(p)) techDetections.set(p, new Set());
        techDetections.get(p)!.add(d.id);
      }
    }
  }

  const toolMitigationRows = await rawAll<{ technique_id: string; tool_id: number }>(db, `
    SELECT tm.technique_id, tom.tool_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `);
  for (const r of toolMitigationRows) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent);
    if (p) {
      if (!techTools.has(p)) techTools.set(p, new Set());
      techTools.get(p)!.add(r.tool_id);
    }
  }

  const coveredIds = new Set([...techDetections.keys(), ...techTools.keys()]);
  const detectionMap = new Map(activeDetections.map(d => [d.id, d]));
  const toolRows = await rawAll<{ id: number; name: string; category: string }>(db, "SELECT id, name, category FROM tools WHERE status='active'");
  const toolMap = new Map(toolRows.map(t => [t.id, t]));
  const allTactics = await rawAll<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_tactics');
  const tacticNameMap = new Map(allTactics.map((t: any) => [t.id, t.name]));

  const allTechniques = await rawAll<any>(db, 'SELECT * FROM attack_techniques WHERE is_subtechnique=0');
  const covered = allTechniques
    .filter(t => coveredIds.has(t.id))
    .map(t => {
      const tacticIds: string[] = JSON.parse(t.tactic_ids);
      const detectionIds = techDetections.get(t.id) ?? new Set<number>();
      const toolIds = techTools.get(t.id) ?? new Set<number>();
      const isDetected = detectionIds.size > 0;
      const isMitigated = toolIds.size > 0;
      return {
        ...t, tactic_ids: tacticIds,
        tactic_names: tacticIds.map(id => tacticNameMap.get(id)).filter(Boolean),
        status: isDetected && isMitigated ? 'full' : isDetected ? 'detected' : 'mitigated',
        detections: [...detectionIds].map(id => {
          const d = detectionMap.get(id)!;
          return { id: d.id, name: d.name, severity: d.severity };
        }),
        tools: [...toolIds].map(id => toolMap.get(id)).filter(Boolean).map((t: any) => ({ id: t.id, name: t.name, category: t.category })),
      };
    });

  res.json(covered);
});

router.get('/gaps', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);

  const detectedIds = new Set<string>();
  for (const d of await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'")) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) detectedIds.add(p);
    }
  }

  const mitigatedIds = new Set<string>();
  for (const r of await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tom ON tm.mitigation_id = tom.mitigation_id
    JOIN tools t ON tom.tool_id = t.id WHERE t.status='active'
  `)) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent);
    if (p) mitigatedIds.add(p);
  }

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
