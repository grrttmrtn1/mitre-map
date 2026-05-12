import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isSqlite = knex.client.config.client === 'better-sqlite3';
  if (isSqlite) {
    await knex.schema.raw('ALTER TABLE exercise_test_runs ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0');
  } else {
    await knex.schema.alterTable('exercise_test_runs', t => {
      t.boolean('blocked').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const isSqlite = knex.client.config.client === 'better-sqlite3';
  if (!isSqlite) {
    await knex.schema.alterTable('exercise_test_runs', t => {
      t.dropColumn('blocked');
    });
  }
}
