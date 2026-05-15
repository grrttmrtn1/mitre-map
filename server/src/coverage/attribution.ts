import { computeCoverageSummary, type DB, type CoverageSummary } from '../db/database';

export async function trackCoverageChange(
  db: DB,
  entityType: string,
  entityId: string,
  entityName: string | null,
  action: string,
  actor: string,
  mutate: () => Promise<void>
): Promise<void> {
  const before = await computeCoverageSummary(db);
  await mutate();
  const after = await computeCoverageSummary(db);
  if (before.covered !== after.covered) {
    await db.raw(
      `INSERT INTO coverage_attribution_log
        (triggered_by_entity_type, triggered_by_entity_id, triggered_by_entity_name, action, actor,
         coverage_pct_before, coverage_pct_after, covered_techniques_before, covered_techniques_after, total_techniques)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entityType, entityId, entityName, action, actor,
       before.pct, after.pct, before.covered, after.covered, after.total]
    );
  }
}

export async function recordCoverageChangeDirect(
  db: DB,
  entityType: string,
  entityId: string,
  entityName: string | null,
  action: string,
  actor: string,
  before: CoverageSummary,
  after: CoverageSummary
): Promise<void> {
  if (before.covered === after.covered) return;
  await db.raw(
    `INSERT INTO coverage_attribution_log
      (triggered_by_entity_type, triggered_by_entity_id, triggered_by_entity_name, action, actor,
       coverage_pct_before, coverage_pct_after, covered_techniques_before, covered_techniques_after, total_techniques)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entityType, entityId, entityName, action, actor,
     before.pct, after.pct, before.covered, after.covered, after.total]
  );
}
