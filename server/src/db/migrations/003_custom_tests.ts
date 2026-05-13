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
  const isSqlite = knex.client.config.client === 'better-sqlite3';
  if (!isSqlite) {
    await knex.schema.alterTable('art_tests', t => {
      t.dropColumn('source');
    });
  }
}
