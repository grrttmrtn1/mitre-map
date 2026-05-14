import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTableIfNotExists('webhook_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('url').notNullable();
      t.string('secret').nullable();
      t.text('custom_headers').nullable(); // JSON object of header name → value
      t.boolean('enabled').notNullable().defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('alert_rules', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable(); // coverage_threshold | detection_validation_failed | new_uncovered_group_technique
      t.float('threshold').nullable(); // minimum coverage % for coverage_threshold type
      t.integer('webhook_config_id').notNullable()
        .references('id').inTable('webhook_configs').onDelete('CASCADE');
      t.boolean('enabled').notNullable().defaultTo(true);
      t.timestamp('last_notified_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alert_rules').dropTableIfExists('webhook_configs');
}
