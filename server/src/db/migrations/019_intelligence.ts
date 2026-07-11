import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTable('group_campaigns', t => {
      t.increments('id').primary();
      t.string('group_id').notNullable()
        .references('id').inTable('threat_groups').onDelete('CASCADE');
      t.string('name').notNullable();
      t.text('description').nullable();
      t.string('start_date').nullable();
      t.string('end_date').nullable();
      t.string('source_url').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('campaign_techniques', t => {
      t.integer('campaign_id').notNullable()
        .references('id').inTable('group_campaigns').onDelete('CASCADE');
      t.string('technique_id').notNullable();
      t.primary(['campaign_id', 'technique_id']);
    })
    .createTable('cves', t => {
      t.string('id').primary();
      t.text('description').nullable();
      t.float('cvss_score').nullable();
      t.string('cvss_severity').nullable();
      t.text('affected_products').nullable();
      t.string('published_at').nullable();
      t.string('modified_at').nullable();
      t.integer('patch_available').notNullable().defaultTo(0);
      t.timestamp('synced_at').defaultTo(knex.fn.now());
    })
    .createTable('cve_techniques', t => {
      t.string('cve_id').notNullable()
        .references('id').inTable('cves').onDelete('CASCADE');
      t.string('technique_id').notNullable();
      t.primary(['cve_id', 'technique_id']);
    })
    .createTable('indicators', t => {
      t.increments('id').primary();
      t.string('type').notNullable();
      t.string('value').notNullable();
      t.string('group_id').nullable()
        .references('id').inTable('threat_groups').onDelete('SET NULL');
      t.string('technique_id').nullable();
      t.string('confidence').notNullable().defaultTo('medium');
      t.text('notes').nullable();
      t.string('first_seen').nullable();
      t.string('last_seen').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_cve_techniques_tech ON cve_techniques(technique_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_indicators_group ON indicators(group_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists('campaign_techniques')
    .dropTableIfExists('group_campaigns')
    .dropTableIfExists('cve_techniques')
    .dropTableIfExists('cves')
    .dropTableIfExists('indicators');
}
