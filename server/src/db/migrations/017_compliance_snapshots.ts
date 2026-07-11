import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('compliance_snapshots', t => {
    t.increments('id').primary();
    t.string('framework_id').notNullable();
    t.integer('total_controls').notNullable();
    t.integer('covered_controls').notNullable();
    t.integer('coverage_pct').notNullable();
    t.timestamp('taken_at').defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_fw_time ON compliance_snapshots(framework_id, taken_at DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('compliance_snapshots');
}
