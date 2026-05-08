import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasSource = await knex.schema.hasColumn('art_tests', 'source');
  if (!hasSource) {
    await knex.schema.alterTable('art_tests', t => {
      t.string('source').notNullable().defaultTo('atomic');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // SQLite doesn't support DROP COLUMN before 3.35 — no-op on down
}
