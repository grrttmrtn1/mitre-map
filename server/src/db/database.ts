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
