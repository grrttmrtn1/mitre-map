import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('taxii_servers', t => {
    t.integer('last_fetch_skipped');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('taxii_servers', t => {
    t.dropColumn('last_fetch_skipped');
  });
}
