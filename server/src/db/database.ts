import { Knex } from 'knex';
import _knex from './knex';

export type DB = Knex | Knex.Transaction;

let _instance: Knex | null = null;

export function getKnex(): Knex {
  if (!_instance) _instance = _knex;
  return _instance;
}

// Normalize knex.raw results across SQLite and PG drivers.
// SQLite3: db.raw() resolves to the rows array directly: [{...}, {...}, ...]
// PostgreSQL: db.raw() resolves to an object with a rows property: { rows: [{...},...] }
function extractRows<T>(result: any): T[] {
  if (!Array.isArray(result)) return (result.rows ?? []) as T[];
  return result as T[];
}

export async function rawAll<T = any>(db: DB, sql: string, params: any[] = []): Promise<T[]> {
  return extractRows<T>(await db.raw(sql, params));
}

export async function rawGet<T = any>(db: DB, sql: string, params: any[] = []): Promise<T | undefined> {
  return extractRows<T>(await db.raw(sql, params))[0];
}

export async function rawRun(db: DB, sql: string, params: any[] = []): Promise<void> {
  await db.raw(sql, params);
}

// For INSERT ... RETURNING id — works on SQLite 3.35+ and all PG versions
export async function rawInsert(db: DB, sql: string, params: any[] = []): Promise<number> {
  const rows = extractRows<{ id: number }>(await db.raw(sql, params));
  return rows[0].id;
}

export async function logAudit(
  db: DB,
  entityType: string,
  entityId: string,
  action: string,
  actor = 'user',
  changes?: Record<string, unknown>,
  sourceIp?: string | null
): Promise<void> {
  await db.raw(
    'INSERT INTO audit_log (entity_type, entity_id, action, actor, changes, source_ip) VALUES (?, ?, ?, ?, ?, ?)',
    [entityType, entityId, action, actor, changes ? JSON.stringify(changes) : null, sourceIp ?? null]
  );
}

export async function runMigrations(): Promise<void> {
  await _knex.migrate.latest();
}

// Preload parent/subtechnique relationships for efficient coverage computation.
// Returns: parentTechIds (all non-subtechnique IDs), subtechToParent (sub→parent map),
// parentToSubtechs (parent→[sub IDs] map).
export async function buildTechniqueGraph(db: DB): Promise<{
  parentTechIds: Set<string>;
  subtechToParent: Map<string, string>;
  parentToSubtechs: Map<string, string[]>;
}> {
  const [parents, subtechs] = await Promise.all([
    rawAll<{ id: string }>(db, 'SELECT id FROM attack_techniques WHERE is_subtechnique=0'),
    rawAll<{ id: string; parent_id: string }>(db,
      'SELECT id, parent_id FROM attack_techniques WHERE is_subtechnique=1 AND parent_id IS NOT NULL'),
  ]);
  const subtechToParent = new Map(subtechs.map(r => [r.id, r.parent_id]));
  const parentToSubtechs = new Map<string, string[]>();
  for (const { id, parent_id } of subtechs) {
    if (!parentToSubtechs.has(parent_id)) parentToSubtechs.set(parent_id, []);
    parentToSubtechs.get(parent_id)!.push(id);
  }
  return { parentTechIds: new Set(parents.map(r => r.id)), subtechToParent, parentToSubtechs };
}

// Map a technique ID (parent or subtechnique) to its parent technique ID.
// Returns null if the ID is unknown (not a parent, not a known subtechnique).
export function resolveToParent(
  id: string,
  parentTechIds: Set<string>,
  subtechToParent: Map<string, string>
): string | null {
  if (parentTechIds.has(id)) return id;
  const parent = subtechToParent.get(id);
  return (parent && parentTechIds.has(parent)) ? parent : null;
}
