import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('taxii_servers', t => {
    t.string('last_fetch_status');   // 'running' | 'success' | 'error'
    t.text('last_fetch_error');
    t.integer('last_fetch_items');
    t.timestamp('last_fetch_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('taxii_servers', t => {
    t.dropColumn('last_fetch_status');
    t.dropColumn('last_fetch_error');
    t.dropColumn('last_fetch_items');
    t.dropColumn('last_fetch_at');
  });
}
