import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('coverage_attribution_log', t => {
    t.increments('id').primary();
    t.string('triggered_by_entity_type').notNullable();
    t.string('triggered_by_entity_id').notNullable();
    t.string('triggered_by_entity_name').nullable();
    t.string('action').notNullable();
    t.string('actor').notNullable().defaultTo('user');
    t.integer('coverage_pct_before').notNullable();
    t.integer('coverage_pct_after').notNullable();
    t.integer('covered_techniques_before').notNullable();
    t.integer('covered_techniques_after').notNullable();
    t.integer('total_techniques').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_coverage_attribution_created ON coverage_attribution_log(created_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('coverage_attribution_log');
}
