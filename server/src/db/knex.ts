import Knex from 'knex';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'mitremap.db');

const isPg = (process.env.DATABASE_URL ?? '').startsWith('postgres');

const _knex = Knex({
  client: isPg ? 'pg' : 'better-sqlite3',
  connection: isPg ? process.env.DATABASE_URL : { filename: DB_PATH },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.ts', '.js'],
  },
  pool: isPg
    ? {
        min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
        max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
        acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT ?? '30000', 10),
        createTimeoutMillis: 30_000,
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT ?? '30000', 10),
      }
    : {
        afterCreate: (conn: any, cb: Function) => {
          conn.pragma('journal_mode = WAL');
          conn.pragma('foreign_keys = ON');
          cb(null, conn);
        },
      },
});

export default _knex;
export { isPg };
