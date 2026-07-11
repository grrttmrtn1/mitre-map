import { randomUUID } from 'crypto';
import type { DB } from '../db/database';
import { getKnex, rawAll, rawGet, rawRun } from '../db/database';
import { TaxiiClient } from './client';
import { parseStixBundle } from './parser';
import { decryptSecretValue } from '../security';
import { validateBaseUrl } from '../integrations/url-validator';

export interface PendingItem {
  id: number;
  job_id: number | null;
  server_id: number;
  batch_id: string;
  stix_id: string;
  stix_type: string;
  name: string | null;
  proposed_action: string;
  proposed_data: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface IngestResult {
  batch_id: string;
  items_created: number;
  groups_found: number;
  techniques_found: number;
  relationships_found: number;
  skipped: number;
}

export async function runFetch(serverId: number, jobId: number | null = null): Promise<IngestResult> {
  const db = getKnex();
  const server = await rawGet<any>(db, 'SELECT * FROM taxii_servers WHERE id=?', [serverId]);
  if (!server) throw new Error(`TAXII server ${serverId} not found`);
  await validateBaseUrl(server.url);
  const autoMerge = server.auto_merge === 1;

  const client = new TaxiiClient({
    url: server.url,
    api_root: server.api_root,
    collection_id: server.collection_id,
    auth_type: server.auth_type,
    username: server.username,
    password: decryptSecretValue(server.password),
    token: decryptSecretValue(server.token),
    ssl_verify: server.ssl_verify === 1,
  });

  const rawObjects = await client.fetchObjects();
  const { groups, techniques, relationships, skipped } = parseStixBundle(rawObjects);

  // Load existing groups and techniques from DB for cross-referencing
  const dbGroups = await rawAll<{ id: string }>(db, 'SELECT id FROM threat_groups', []);
  const dbTechniques = await rawAll<{ id: string }>(db, 'SELECT id FROM attack_techniques', []);
  const existingGroupIds = new Set(dbGroups.map(g => g.id));
  const existingTechIds = new Set(dbTechniques.map(t => t.id));

  // Build STIX-ID → ATT&CK ID maps for cross-referencing relationships
  const stixToGroupAttackId = new Map<string, string | null>();
  const stixToTechAttackId = new Map<string, string | null>();
  for (const g of groups) stixToGroupAttackId.set(g.stix_id, g.attack_id);
  for (const t of techniques) stixToTechAttackId.set(t.stix_id, t.attack_id);

  // Include groups being staged in this batch so their links aren't dropped
  const batchGroupAttackIds = new Set(groups.map(g => g.attack_id).filter(Boolean) as string[]);
  const knownGroupIds = new Set([...existingGroupIds, ...batchGroupAttackIds]);

  // Pre-load existing group→technique links to avoid N+1 queries inside the transaction
  const existingLinks = await rawAll<{ group_id: string; technique_id: string }>(
    db, 'SELECT group_id, technique_id FROM group_techniques', [],
  );
  const existingLinkSet = new Set(existingLinks.map(r => `${r.group_id}::${r.technique_id}`));

  const batch_id = randomUUID();
  let items_created = 0;

  await db.transaction(async trx => {
    // Propose creating/updating groups
    for (const group of groups) {
      const existsById = group.attack_id ? existingGroupIds.has(group.attack_id) : false;
      const action = existsById ? 'update_group' : 'create_group';
      const data = {
        id: group.attack_id ?? `EXT-G-${group.stix_id.slice(-8).toUpperCase()}`,
        name: group.name,
        aliases: group.aliases,
        description: group.description,
        url: group.url,
        stix_id: group.stix_id,
      };
      await insertPending(trx, serverId, jobId, batch_id, group.stix_id, 'intrusion-set', group.name, action, data);
      items_created++;
    }

    // Propose creating techniques that have no MITRE ATT&CK ID (external/vendor-specific only).
    // Standard MITRE techniques (any with an ATT&CK ID) are already in DB or belong to the
    // MITRE data loader — never shadow-create them here.
    for (const tech of techniques) {
      if (tech.attack_id) continue;
      const data = {
        id: `EXT-T-${tech.stix_id.slice(-8).toUpperCase()}`,
        name: tech.name,
        description: tech.description,
        url: tech.url,
        stix_id: tech.stix_id,
      };
      await insertPending(trx, serverId, jobId, batch_id, tech.stix_id, 'attack-pattern', tech.name, 'create_technique', data);
      items_created++;
    }

    // Propose group→technique links from "uses" relationships
    for (const rel of relationships) {
      if (rel.relationship_type !== 'uses') continue;

      const groupAttackId = stixToGroupAttackId.get(rel.source_ref);
      const techAttackId = stixToTechAttackId.get(rel.target_ref);
      if (!groupAttackId || !techAttackId) continue;
      if (!knownGroupIds.has(groupAttackId) || !existingTechIds.has(techAttackId)) continue;
      if (existingLinkSet.has(`${groupAttackId}::${techAttackId}`)) continue;

      const data = { group_id: groupAttackId, technique_id: techAttackId };
      const label = `${groupAttackId} → ${techAttackId}`;
      await insertPending(trx, serverId, jobId, batch_id, rel.stix_id, 'relationship', label, 'link_technique', data);
      items_created++;
    }

    // Auto-merge: immediately apply all staged items within the same transaction
    // so they land as approved without requiring manual review.
    if (autoMerge && items_created > 0) {
      const staged = await rawAll<any>(trx,
        `SELECT * FROM taxii_pending_ingests WHERE batch_id=? AND status='pending'`,
        [batch_id],
      );
      for (const item of staged) {
        await applyItemInTrx(trx, item);
      }
    }
  });

  return {
    batch_id,
    items_created,
    groups_found: groups.length,
    techniques_found: techniques.length,
    relationships_found: relationships.length,
    skipped,
  };
}

async function applyItemInTrx(trx: DB, item: any): Promise<void> {
  const data = JSON.parse(item.proposed_data);
  switch (item.proposed_action as string) {
    case 'create_group':
      await rawRun(trx,
        `INSERT INTO threat_groups (id, name, aliases, description, url)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        [data.id, data.name, JSON.stringify(data.aliases ?? []), data.description ?? null, data.url ?? null],
      );
      break;
    case 'update_group':
      await rawRun(trx,
        `UPDATE threat_groups SET name=COALESCE(?,name), aliases=COALESCE(?,aliases), description=COALESCE(?,description), url=COALESCE(?,url)
         WHERE id=?`,
        [data.name ?? null, data.aliases ? JSON.stringify(data.aliases) : null, data.description ?? null, data.url ?? null, data.id],
      );
      break;
    case 'create_technique':
      await rawRun(trx,
        `INSERT INTO attack_techniques (id, name, description, tactic_ids, is_subtechnique, url)
         VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT DO NOTHING`,
        [data.id, data.name, data.description ?? null, JSON.stringify([]), data.url ?? null],
      );
      break;
    case 'link_technique':
      await rawRun(trx,
        'INSERT INTO group_techniques (group_id, technique_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [data.group_id, data.technique_id],
      );
      break;
  }
  await rawRun(trx,
    `UPDATE taxii_pending_ingests SET status='approved', reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
    [item.id],
  );
}

async function insertPending(
  trx: DB,
  serverId: number,
  jobId: number | null,
  batchId: string,
  stixId: string,
  stixType: string,
  name: string,
  action: string,
  data: object,
): Promise<void> {
  await rawRun(trx,
    `INSERT INTO taxii_pending_ingests (server_id, job_id, batch_id, stix_id, stix_type, name, proposed_action, proposed_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [serverId, jobId, batchId, stixId, stixType, name, action, JSON.stringify(data)],
  );
}

export async function applyPendingItem(itemId: number, reviewerId: number | null): Promise<void> {
  const db = getKnex();
  const item = await rawGet<any>(db, 'SELECT * FROM taxii_pending_ingests WHERE id=?', [itemId]);
  if (!item) throw new Error('Pending item not found');
  if (item.status !== 'pending') throw new Error('Item already reviewed');

  const data = JSON.parse(item.proposed_data);

  await db.transaction(async trx => {
    switch (item.proposed_action as string) {
      case 'create_group':
        await rawRun(trx,
          `INSERT INTO threat_groups (id, name, aliases, description, url)
           VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [data.id, data.name, JSON.stringify(data.aliases ?? []), data.description ?? null, data.url ?? null],
        );
        break;

      case 'update_group':
        await rawRun(trx,
          `UPDATE threat_groups SET name=COALESCE(?,name), aliases=COALESCE(?,aliases), description=COALESCE(?,description), url=COALESCE(?,url)
           WHERE id=?`,
          [data.name ?? null, data.aliases ? JSON.stringify(data.aliases) : null, data.description ?? null, data.url ?? null, data.id],
        );
        break;

      case 'create_technique': {
        await rawRun(trx,
          `INSERT INTO attack_techniques (id, name, description, tactic_ids, is_subtechnique, url)
           VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT DO NOTHING`,
          [data.id, data.name, data.description ?? null, JSON.stringify([]), data.url ?? null],
        );
        break;
      }

      case 'link_technique':
        await rawRun(trx,
          'INSERT INTO group_techniques (group_id, technique_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
          [data.group_id, data.technique_id],
        );
        break;
    }

    await rawRun(trx,
      `UPDATE taxii_pending_ingests SET status='approved', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
      [reviewerId, itemId],
    );
  });
}

export async function rejectPendingItem(itemId: number, reviewerId: number | null): Promise<void> {
  const db = getKnex();
  await rawRun(db,
    `UPDATE taxii_pending_ingests SET status='rejected', reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
    [reviewerId, itemId],
  );
}
