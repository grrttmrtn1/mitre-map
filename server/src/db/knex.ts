import Knex from 'knex';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'mitremap.db');

const isPg = (process.env.DATABASE_URL ?? '').startsWith('postgres');

const _knex = Knex({
  client: isPg ? 'pg' : 'sqlite3',
  connection: isPg ? process.env.DATABASE_URL : { filename: DB_PATH },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    loadExtensions: ['.ts', '.js'],
  },
  ...(isPg
    ? {}
    : {
        pool: {
          afterCreate: (conn: any, cb: Function) => {
            conn.run('PRAGMA journal_mode=WAL;', (err: any) => {
              if (err) { cb(err, conn); return; }
              conn.run('PRAGMA foreign_keys=ON;', cb);
            });
          },
        },
      }),
});

export default _knex;
export { isPg };
