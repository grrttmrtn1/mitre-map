import { DB, computeCoverageSummary, rawAll, rawGet } from '../db/database';

export const REPORT_TYPES = ['executive', 'trends', 'threats', 'gaps', 'compliance'] as const;
export type ReportType = typeof REPORT_TYPES[number];

/**
 * Generate scheduled-report data in-process. This deliberately avoids calling
 * the application's authenticated HTTP API from its own scheduler.
 */
export async function buildScheduledReportData(db: DB, type: ReportType, frameworkId?: string | null): Promise<any> {
  if (type === 'executive') {
    const coverage = await computeCoverageSummary(db);
    const [detections, tools, tacticBreakdown] = await Promise.all([
      rawGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM detections WHERE status='active'"),
      rawGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM tools WHERE status='active'"),
      rawAll<any>(db, `SELECT id AS tactic_id, name AS tactic_name FROM attack_tactics ORDER BY name`),
    ]);
    return {
      coverage_pct: coverage.pct,
      covered_techniques: coverage.covered,
      total_techniques: coverage.total,
      gap_techniques: coverage.total - coverage.covered,
      active_detections: Number(detections?.c ?? 0),
      active_tools: Number(tools?.c ?? 0),
      tactic_breakdown: tacticBreakdown,
    };
  }

  if (type === 'trends') {
    return { snapshots: await rawAll<any>(db,
      'SELECT taken_at, coverage_pct, covered_techniques, total_techniques, active_detections, notes FROM coverage_snapshots ORDER BY taken_at DESC LIMIT 90') };
  }

  if (type === 'threats') {
    return { groups: await rawAll<any>(db, `
      SELECT tg.id, tg.name, tg.country, tg.motivation,
             COUNT(DISTINCT gt.technique_id) AS total_techniques
      FROM threat_groups tg
      LEFT JOIN group_techniques gt ON gt.group_id=tg.id
      GROUP BY tg.id, tg.name, tg.country, tg.motivation
      ORDER BY total_techniques DESC, tg.name LIMIT 50`) };
  }

  if (type === 'gaps') {
    return { gaps: await rawAll<any>(db, `
      SELECT t.id, t.name, t.tactic_ids,
             COUNT(DISTINCT gt.group_id) AS group_count,
             COUNT(DISTINCT tc.control_id) AS compliance_impact,
             COUNT(DISTINCT gt.group_id) * 8 + COUNT(DISTINCT tc.control_id) * 2 AS priority_score
      FROM attack_techniques t
      LEFT JOIN group_techniques gt ON gt.technique_id=t.id
      LEFT JOIN technique_compliance tc ON tc.technique_id=t.id
      WHERE t.is_subtechnique=0
        AND NOT EXISTS (
          SELECT 1 FROM detections d
          WHERE d.status='active' AND d.technique_ids LIKE '%"' || t.id || '"%'
        )
      GROUP BY t.id, t.name, t.tactic_ids
      ORDER BY priority_score DESC, t.id LIMIT 50`) };
  }

  const frameworkWhere = frameworkId ? 'WHERE f.id=?' : '';
  const params = frameworkId ? [frameworkId] : [];
  return { frameworks: await rawAll<any>(db, `
    SELECT f.id, f.name, COUNT(DISTINCT c.id) AS total_controls
    FROM compliance_frameworks f
    LEFT JOIN compliance_controls c ON c.framework_id=f.id
    ${frameworkWhere}
    GROUP BY f.id, f.name ORDER BY f.name`, params) };
}
