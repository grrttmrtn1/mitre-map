import { Router } from 'express';
import { getKnex, rawAll, rawGet, buildTechniqueGraph, resolveToParent } from '../db/database';

const router = Router();

router.get('/queue', async (_req, res) => {
  const db = getKnex();
  const { parentTechIds, subtechToParent } = await buildTechniqueGraph(db);

  // Org sector for industry targeting weight
  const orgSectorRow = await rawGet<{ value: string | null }>(db, "SELECT value FROM settings WHERE key='org_sector'");
  const orgSector = orgSectorRow?.value ?? null;

  // Techniques with active detections
  const detectedIds = new Set<string>();
  for (const d of await rawAll<{ technique_ids: string }>(db, "SELECT technique_ids FROM detections WHERE status='active'")) {
    for (const id of JSON.parse(d.technique_ids)) {
      const p = resolveToParent(id, parentTechIds, subtechToParent);
      if (p) detectedIds.add(p);
    }
  }

  // Techniques with active-tool-backed mitigations
  const mitigatedIds = new Set<string>();
  for (const r of await rawAll<{ technique_id: string }>(db, `
    SELECT DISTINCT tm.technique_id FROM technique_mitigations tm
    JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
    JOIN tools t ON tlm.tool_id = t.id WHERE t.status = 'active'
  `)) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent);
    if (p) mitigatedIds.add(p);
  }

  // Group usage per technique (batch)
  const groupRows = await rawAll<{ technique_id: string; group_id: string; group_name: string; country: string | null; motivation: string | null; targeted_sectors: string }>(db, `
    SELECT gt.technique_id, tg.id as group_id, tg.name as group_name, tg.country, tg.motivation, tg.targeted_sectors
    FROM group_techniques gt
    JOIN threat_groups tg ON gt.group_id = tg.id
  `);

  const techGroupMap = new Map<string, Array<{ id: string; name: string; country: string | null; motivation: string | null; in_sector: boolean }>>();
  for (const r of groupRows) {
    const p = resolveToParent(r.technique_id, parentTechIds, subtechToParent) ?? r.technique_id;
    if (!techGroupMap.has(p)) techGroupMap.set(p, []);
    let sectors: string[] = [];
    try { sectors = JSON.parse(r.targeted_sectors || '[]'); } catch { /* ignore */ }
    const in_sector = orgSector ? sectors.includes(orgSector) : false;
    const list = techGroupMap.get(p)!;
    if (!list.find(g => g.id === r.group_id)) {
      list.push({ id: r.group_id, name: r.group_name, country: r.country, motivation: r.motivation, in_sector });
    }
  }

  // Data source readiness per technique (batch)
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

  // Source name lookups for display
  const dsNameRows = await rawAll<{ technique_id: string; ds_name: string; org_status: string | null }>(db, `
    SELECT tds.technique_id, d.name as ds_name, ods.status as org_status
    FROM technique_data_sources tds
    JOIN data_sources d ON tds.data_source_id = d.id
    LEFT JOIN org_data_sources ods ON tds.data_source_id = ods.data_source_id
    ORDER BY tds.technique_id
  `);
  const techDsNamesMap = new Map<string, Array<{ name: string; status: string | null }>>();
  for (const r of dsNameRows) {
    if (!techDsNamesMap.has(r.technique_id)) techDsNamesMap.set(r.technique_id, []);
    techDsNamesMap.get(r.technique_id)!.push({ name: r.ds_name, status: r.org_status });
  }

  // Compliance counts per technique
  const complianceRows = await rawAll<{ technique_id: string; cnt: number }>(db,
    'SELECT technique_id, COUNT(*) as cnt FROM technique_compliance GROUP BY technique_id');
  const complianceMap = new Map(complianceRows.map(r => [r.technique_id, Number(r.cnt)]));

  // Mitigation guidance
  const mitigationGuidanceRows = await rawAll<{ technique_id: string }>(db,
    'SELECT DISTINCT technique_id FROM technique_mitigations');
  const hasMitigationGuidance = new Set(mitigationGuidanceRows.map(r => r.technique_id));

  // Build queue from all parent techniques that have ≥1 threat group and no active detection
  const allTechniques = await rawAll<{ id: string; name: string; tactic_ids: string }>(
    db, 'SELECT id, name, tactic_ids FROM attack_techniques WHERE is_subtechnique = 0');

  const tacticRows = await rawAll<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_tactics');
  const tacticNameMap = new Map(tacticRows.map(t => [t.id, t.name]));

  const queueItems: any[] = [];

  for (const tech of allTechniques) {
    if (detectedIds.has(tech.id)) continue; // Already has active detection — not in queue

    const groups = techGroupMap.get(tech.id) ?? [];
    if (groups.length === 0) continue; // No threat actor uses this — skip

    const industryGroups = groups.filter(g => g.in_sector);
    const required = dsRequiredMap.get(tech.id) ?? 0;
    const collecting = dsCollectingMap.get(tech.id) ?? 0;
    const dsRatio = required > 0 ? collecting / required : 0;
    const complianceCount = complianceMap.get(tech.id) ?? 0;
    const isMitigated = mitigatedIds.has(tech.id);

    // Scoring
    const industryScore = Math.min(40, industryGroups.length * 10);
    const groupScore = Math.min(20, groups.length * 4);
    const dsScore = Math.round(dsRatio * 20);
    const gapScore = isMitigated ? 5 : 10;
    const complianceScore = Math.min(10, complianceCount * 2);
    const priorityScore = industryScore + groupScore + dsScore + gapScore + complianceScore;

    const tacticIds: string[] = JSON.parse(tech.tactic_ids);
    const tacticNames = tacticIds.map(id => tacticNameMap.get(id)).filter(Boolean) as string[];

    const dsDetails = techDsNamesMap.get(tech.id) ?? [];
    const availableSources = dsDetails.filter(d => d.status === 'collecting').map(d => d.name);
    const missingSources = dsDetails.filter(d => d.status !== 'collecting').map(d => d.name);

    const dsStatus = required === 0 ? 'unknown' : dsRatio >= 0.75 ? 'ready' : dsRatio > 0 ? 'partial' : 'blind';

    queueItems.push({
      technique_id: tech.id,
      technique_name: tech.name,
      tactic_ids: tacticIds,
      tactic_names: tacticNames,
      priority_score: priorityScore,
      priority_components: {
        industry: industryScore,
        group: groupScore,
        data_sources: dsScore,
        gap_severity: gapScore,
        compliance: complianceScore,
      },
      coverage_status: isMitigated ? 'mitigated_only' : 'gap',
      action: isMitigated ? 'add_detection' : 'build_detection',
      groups,
      industry_group_count: industryGroups.length,
      group_count: groups.length,
      data_readiness: {
        available: collecting,
        required,
        ratio: dsRatio,
        status: dsStatus,
      },
      available_sources: availableSources,
      missing_sources: missingSources,
      has_mitigation_guidance: hasMitigationGuidance.has(tech.id),
      compliance_count: complianceCount,
    });
  }

  queueItems.sort((a, b) => b.priority_score - a.priority_score);
  queueItems.forEach((item, i) => { item.rank = i + 1; });

  const summary = {
    total_items: queueItems.length,
    gaps: queueItems.filter(i => i.coverage_status === 'gap').length,
    mitigated_only: queueItems.filter(i => i.coverage_status === 'mitigated_only').length,
    data_ready: queueItems.filter(i => i.data_readiness.status === 'ready').length,
    org_sector: orgSector,
  };

  res.json({ summary, queue: queueItems });
});

export default router;
