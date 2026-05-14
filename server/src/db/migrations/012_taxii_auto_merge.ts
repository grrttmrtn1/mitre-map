import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('taxii_servers', t => {
    t.integer('auto_merge').notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('taxii_servers', t => {
    t.dropColumn('auto_merge');
  });
}
