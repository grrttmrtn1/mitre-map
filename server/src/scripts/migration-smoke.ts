import Knex from 'knex';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'mitremap-migrations-'));
  const dbPath = path.join(temp, 'smoke.db');
  const knex = Knex({
    client: 'better-sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
    migrations: { directory: path.join(__dirname, '../db/migrations'), loadExtensions: ['.ts', '.js'] },
  });
  try {
    const [, applied] = await knex.migrate.latest();
    const [completed, pending] = await knex.migrate.list();
    if (pending.length) throw new Error(`${pending.length} migrations remain pending`);
    console.log(`Migration smoke test passed: ${applied.length} applied, ${completed.length} complete`);
  } finally {
    await knex.destroy();
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
