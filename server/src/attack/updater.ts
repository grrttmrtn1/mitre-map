import { randomUUID } from 'crypto';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit, type DB } from '../db/database';
import { fetchAndParseStix, GITHUB_RELEASES_API, GH_HEADERS } from '../data/stix-fetch';

export interface UpdateSettings {
  id: number;
  enabled: number;
  schedule: string;
  auto_apply: number;
  last_checked_at: string | null;
  last_checked_version: string | null;
  last_check_status: string | null;
  last_check_error: string | null;
  updated_at: string;
}

export interface UpdateBatch {
  id: number;
  batch_id: string;
  from_version: string;
  to_version: string;
  status: 'pending' | 'approved' | 'rejected' | 'auto_applied';
  added_count: number;
  removed_count: number;
  renamed_count: number;
  mitigation_count: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  pending_count?: number;
}

export interface UpdateItem {
  id: number;
  batch_id: string;
  change_type: 'add_technique' | 'remove_technique' | 'rename_technique' | 'add_mitigation' | 'add_mit_rel';
  item_id: string;
  item_name: string | null;
  old_data: any;
  new_data: any;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export async function getSettings(): Promise<UpdateSettings> {
  const db = getKnex();
  return rawGet<UpdateSettings>(db, 'SELECT * FROM attack_update_settings WHERE id=1') as Promise<UpdateSettings>;
}

export async function updateSettings(patch: Partial<Pick<UpdateSettings, 'enabled' | 'schedule' | 'auto_apply'>>): Promise<UpdateSettings> {
  const db = getKnex();
  const fields: string[] = [];
  const vals: any[] = [];
  if (patch.enabled !== undefined) { fields.push('enabled=?'); vals.push(patch.enabled ? 1 : 0); }
  if (patch.schedule !== undefined) { fields.push('schedule=?'); vals.push(patch.schedule); }
  if (patch.auto_apply !== undefined) { fields.push('auto_apply=?'); vals.push(patch.auto_apply ? 1 : 0); }
  if (fields.length > 0) {
    fields.push('updated_at=CURRENT_TIMESTAMP');
    await rawRun(db, `UPDATE attack_update_settings SET ${fields.join(', ')} WHERE id=1`, vals);
  }
  return getSettings();
}

export async function checkForUpdate(): Promise<{ up_to_date: boolean; latest_version: string; current_version: string } | null> {
  const db = getKnex();
  try {
    const ghRes = await fetch(GITHUB_RELEASES_API, { headers: GH_HEADERS });
    if (!ghRes.ok) return null;
    const release = await ghRes.json() as any;
    const latestVersion = (release.tag_name as string).replace(/^(?:ATT&CK-v|v)/, '');
    const current = await rawGet<any>(db, 'SELECT version FROM attack_version_info WHERE is_active=1 ORDER BY id DESC LIMIT 1');
    const currentVersion: string = current?.version ?? '0';
    return { up_to_date: currentVersion === latestVersion, latest_version: latestVersion, current_version: currentVersion };
  } catch {
    return null;
  }
}

// Compute diff between current DB state and a new STIX version, then stage it as a pending batch.
// Returns null if already up-to-date or a batch for this version already exists.
export async function stageUpdate(targetVersion?: string, actor = 'system'): Promise<UpdateBatch | null> {
  const db = getKnex();

  const stix = await fetchAndParseStix(targetVersion);
  if (!stix) throw new Error('Failed to fetch STIX data from GitHub');

  const { version: toVersion, tactics, techniques, mitigations, mitRelationships, stixIdToTechId } = stix;

  // Check current version
  const current = await rawGet<any>(db, 'SELECT version FROM attack_version_info WHERE is_active=1 ORDER BY id DESC LIMIT 1');
  const fromVersion: string = current?.version ?? '0';

  if (fromVersion === toVersion) return null; // already up to date

  // Check if a batch for this version already exists (pending or approved)
  const existing = await rawGet<any>(db, `SELECT id FROM attack_update_batches WHERE to_version=? AND status IN ('pending','approved','auto_applied')`, [toVersion]);
  if (existing) return null; // already staged

  // Load current DB state for diffing
  const [dbTechs, dbMits, dbMitRels] = await Promise.all([
    rawAll<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_techniques'),
    rawAll<{ id: string; name: string }>(db, 'SELECT id, name FROM attack_mitigations'),
    rawAll<{ technique_id: string; mitigation_id: string }>(db, 'SELECT technique_id, mitigation_id FROM technique_mitigations'),
  ]);

  const dbTechMap = new Map(dbTechs.map(t => [t.id, t.name]));
  const dbMitIds = new Set(dbMits.map(m => m.id));
  const dbMitRelSet = new Set(dbMitRels.map(r => `${r.mitigation_id}::${r.technique_id}`));
  const liveTechIds = new Set(techniques.map(t => t.id));
  const liveMitIds = new Set(mitigations.map(m => m.id));
  const shortnameToTacticId = new Map(tactics.map(t => [t.shortname, t.id]));

  const batchId = randomUUID();
  let addedCount = 0, removedCount = 0, renamedCount = 0, mitigationCount = 0;

  await db.transaction(async trx => {
    // New techniques not in DB
    for (const t of techniques) {
      if (!dbTechMap.has(t.id)) {
        const tacticIds = t.phase_names.map((p: string) => shortnameToTacticId.get(p)).filter(Boolean);
        await insertItem(trx, batchId, 'add_technique', t.id, t.name, null,
          { id: t.id, name: t.name, description: t.description, tactic_ids: tacticIds, is_subtechnique: t.is_subtechnique, parent_id: t.parent_id, url: t.url });
        addedCount++;
      }
    }

    // Techniques in DB but not in live (deprecated/removed)
    for (const [id, name] of dbTechMap) {
      if (!liveTechIds.has(id) && !id.startsWith('EXT-')) {
        await insertItem(trx, batchId, 'remove_technique', id, name, { id, name }, null);
        removedCount++;
      }
    }

    // Renamed techniques
    for (const t of techniques) {
      const oldName = dbTechMap.get(t.id);
      if (oldName && oldName !== t.name) {
        await insertItem(trx, batchId, 'rename_technique', t.id, t.name, { name: oldName }, { name: t.name });
        renamedCount++;
      }
    }

    // New mitigations
    for (const m of mitigations) {
      if (!dbMitIds.has(m.id)) {
        await insertItem(trx, batchId, 'add_mitigation', m.id, m.name, null,
          { id: m.id, name: m.name, description: m.description, url: m.url });
        mitigationCount++;
      }
    }

    // New mitigation→technique relationships
    for (const rel of mitRelationships) {
      const techId = stixIdToTechId.get(rel.stix_tech_id);
      if (!techId || !liveTechIds.has(techId)) continue;
      const key = `${rel.mitigation_id}::${techId}`;
      if (!dbMitRelSet.has(key)) {
        await insertItem(trx, batchId, 'add_mit_rel', key, `${rel.mitigation_id} → ${techId}`,
          null, { mitigation_id: rel.mitigation_id, technique_id: techId });
        mitigationCount++;
      }
    }

    // Record the batch
    await rawRun(trx,
      `INSERT INTO attack_update_batches (batch_id, from_version, to_version, status, added_count, removed_count, renamed_count, mitigation_count)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [batchId, fromVersion, toVersion, addedCount, removedCount, renamedCount, mitigationCount],
    );

    // Record the check timestamp
    await rawRun(trx,
      `UPDATE attack_update_settings SET last_checked_at=CURRENT_TIMESTAMP, last_checked_version=?, last_check_status='success', last_check_error=NULL WHERE id=1`,
      [toVersion],
    );

    await logAudit(trx, 'attack_update', batchId, 'staged', actor,
      { from_version: fromVersion, to_version: toVersion, added: addedCount, removed: removedCount, renamed: renamedCount, mitigation_changes: mitigationCount },
    );
  });

  return rawGet<UpdateBatch>(db, 'SELECT * FROM attack_update_batches WHERE batch_id=?', [batchId]) as Promise<UpdateBatch>;
}

async function insertItem(
  trx: DB,
  batchId: string,
  changeType: string,
  itemId: string,
  itemName: string | null,
  oldData: object | null,
  newData: object | null,
): Promise<void> {
  await rawRun(trx,
    `INSERT INTO attack_update_items (batch_id, change_type, item_id, item_name, old_data, new_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [batchId, changeType, itemId, itemName, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null],
  );
}

export async function approveBatch(batchId: string, reviewer: string | null): Promise<void> {
  const db = getKnex();
  const batch = await rawGet<UpdateBatch>(db, 'SELECT * FROM attack_update_batches WHERE batch_id=?', [batchId]);
  if (!batch) throw new Error('Batch not found');
  if (batch.status !== 'pending') throw new Error('Batch already reviewed');

  const items = await rawAll<UpdateItem>(db, `SELECT * FROM attack_update_items WHERE batch_id=? AND status='pending'`, [batchId]);

  await db.transaction(async trx => {
    for (const item of items) {
      await applyItemInTrx(trx, item);
    }

    // Bump version info
    await trx.raw('UPDATE attack_version_info SET is_active=0');
    await trx.raw(
      `INSERT INTO attack_version_info (version, name, released_at, is_active, notes)
       VALUES (?, ?, ?, 1, ?)`,
      [batch.to_version, `ATT&CK v${batch.to_version}`, new Date().toISOString().split('T')[0],
       `ATT&CK v${batch.to_version} — applied from staged update (${items.length} changes)`],
    );

    await rawRun(trx,
      `UPDATE attack_update_batches SET status='approved', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE batch_id=?`,
      [reviewer, batchId],
    );
    await logAudit(trx, 'attack_update', batchId, 'approved', reviewer ?? 'user',
      { to_version: batch.to_version, items_applied: items.length });
  });
}

export async function rejectBatch(batchId: string, reviewer: string | null): Promise<void> {
  const db = getKnex();
  const batch = await rawGet<UpdateBatch>(db, 'SELECT * FROM attack_update_batches WHERE batch_id=?', [batchId]);
  if (!batch) throw new Error('Batch not found');
  if (batch.status !== 'pending') throw new Error('Batch already reviewed');

  await db.transaction(async trx => {
    await rawRun(trx,
      `UPDATE attack_update_items SET status='rejected', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE batch_id=? AND status='pending'`,
      [reviewer, batchId],
    );
    await rawRun(trx,
      `UPDATE attack_update_batches SET status='rejected', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE batch_id=?`,
      [reviewer, batchId],
    );
    await logAudit(trx, 'attack_update', batchId, 'rejected', reviewer ?? 'user', {});
  });
}

export async function approveItem(itemId: number, reviewer: string | null): Promise<void> {
  const db = getKnex();
  const item = await rawGet<UpdateItem>(db, 'SELECT * FROM attack_update_items WHERE id=?', [itemId]);
  if (!item) throw new Error('Item not found');
  if (item.status !== 'pending') throw new Error('Item already reviewed');

  await db.transaction(async trx => {
    await applyItemInTrx(trx, item);
  });
}

export async function rejectItem(itemId: number, reviewer: string | null): Promise<void> {
  const db = getKnex();
  await rawRun(db,
    `UPDATE attack_update_items SET status='rejected', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
    [reviewer, itemId],
  );
}

async function applyItemInTrx(trx: DB, item: UpdateItem): Promise<void> {
  const newData = item.new_data ? (typeof item.new_data === 'string' ? JSON.parse(item.new_data) : item.new_data) : null;
  const oldData = item.old_data ? (typeof item.old_data === 'string' ? JSON.parse(item.old_data) : item.old_data) : null;

  switch (item.change_type) {
    case 'add_technique':
      if (newData) {
        await rawRun(trx,
          `INSERT INTO attack_techniques (id, name, description, tactic_ids, is_subtechnique, parent_id, url)
           VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, tactic_ids=excluded.tactic_ids, is_subtechnique=excluded.is_subtechnique, parent_id=excluded.parent_id, url=excluded.url`,
          [newData.id, newData.name, newData.description ?? null, JSON.stringify(newData.tactic_ids ?? []), newData.is_subtechnique ?? 0, newData.parent_id ?? null, newData.url ?? null],
        );
      }
      break;

    case 'remove_technique':
      if (oldData) {
        await rawRun(trx,
          `INSERT INTO deprecated_techniques (technique_id, deprecated_in_version, reason) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
          [item.item_id, 'auto-update', 'Removed in ATT&CK update'],
        );
      }
      break;

    case 'rename_technique':
      if (newData?.name) {
        await rawRun(trx, `UPDATE attack_techniques SET name=? WHERE id=?`, [newData.name, item.item_id]);
      }
      break;

    case 'add_mitigation':
      if (newData) {
        await rawRun(trx,
          `INSERT INTO attack_mitigations (id, name, description, url) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, url=excluded.url`,
          [newData.id, newData.name, newData.description ?? null, newData.url ?? null],
        );
      }
      break;

    case 'add_mit_rel':
      if (newData) {
        await rawRun(trx,
          `INSERT INTO technique_mitigations (technique_id, mitigation_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
          [newData.technique_id, newData.mitigation_id],
        );
      }
      break;
  }

  await rawRun(trx,
    `UPDATE attack_update_items SET status='approved', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
    [null, item.id],
  );
}

// Used by the scheduler for auto-apply — stages AND immediately approves.
export async function stageAndAutoApply(actor = 'system'): Promise<void> {
  const batch = await stageUpdate(undefined, actor);
  if (!batch) return; // already up-to-date or batch already exists

  const db = getKnex();
  const items = await rawAll<UpdateItem>(db, `SELECT * FROM attack_update_items WHERE batch_id=?`, [batch.batch_id]);

  await db.transaction(async trx => {
    for (const item of items) {
      await applyItemInTrx(trx, item);
    }

    await trx.raw('UPDATE attack_version_info SET is_active=0');
    await trx.raw(
      `INSERT INTO attack_version_info (version, name, released_at, is_active, notes) VALUES (?, ?, ?, 1, ?)`,
      [batch.to_version, `ATT&CK v${batch.to_version}`, new Date().toISOString().split('T')[0],
       `ATT&CK v${batch.to_version} — auto-applied by scheduler (${items.length} changes)`],
    );

    await rawRun(trx,
      `UPDATE attack_update_batches SET status='auto_applied', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE batch_id=?`,
      [actor, batch.batch_id],
    );
    await logAudit(trx, 'attack_update', batch.batch_id, 'auto_applied', actor,
      { to_version: batch.to_version, items_applied: items.length });
  });
}
