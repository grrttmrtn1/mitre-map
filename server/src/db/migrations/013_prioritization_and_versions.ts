import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Full snapshots of detection fields at each create/update for diff history
  await knex.schema.createTable('detection_versions', t => {
    t.increments('id').primary();
    t.integer('detection_id').notNullable();
    t.integer('version_number').notNullable();
    t.text('snapshot').notNullable();
    t.string('changed_by').notNullable().defaultTo('user');
    t.timestamp('changed_at').notNullable().defaultTo(knex.fn.now());
    t.string('change_summary').nullable();
  });
  await knex.schema.raw('CREATE INDEX idx_detection_versions_detection ON detection_versions(detection_id)');

  // Industry sector targeting for threat groups (JSON array of sector strings)
  const hasSectors = await knex.schema.hasColumn('threat_groups', 'targeted_sectors');
  if (!hasSectors) {
    await knex.schema.raw(`ALTER TABLE threat_groups ADD COLUMN targeted_sectors TEXT NOT NULL DEFAULT '[]'`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('detection_versions');
}
