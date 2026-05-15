import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('attack_update_settings', t => {
    t.increments('id').primary();
    t.integer('enabled').notNullable().defaultTo(0);
    t.string('schedule').notNullable().defaultTo('0 3 * * *');
    t.integer('auto_apply').notNullable().defaultTo(0);
    t.timestamp('last_checked_at').nullable();
    t.string('last_checked_version').nullable();
    t.string('last_check_status').nullable();
    t.string('last_check_error').nullable();
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Seed the singleton settings row
  await knex.raw(`INSERT OR IGNORE INTO attack_update_settings (id, enabled, schedule, auto_apply) VALUES (1, 0, '0 3 * * *', 0)`);

  await knex.schema.createTableIfNotExists('attack_update_batches', t => {
    t.increments('id').primary();
    t.string('batch_id').notNullable().unique();
    t.string('from_version').notNullable();
    t.string('to_version').notNullable();
    t.string('status').notNullable().defaultTo('pending'); // pending | approved | rejected | auto_applied
    t.integer('added_count').notNullable().defaultTo(0);
    t.integer('removed_count').notNullable().defaultTo(0);
    t.integer('renamed_count').notNullable().defaultTo(0);
    t.integer('mitigation_count').notNullable().defaultTo(0);
    t.string('reviewed_by').nullable();
    t.timestamp('reviewed_at').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTableIfNotExists('attack_update_items', t => {
    t.increments('id').primary();
    t.string('batch_id').notNullable().references('batch_id').inTable('attack_update_batches').onDelete('CASCADE');
    t.string('change_type').notNullable(); // add_technique | remove_technique | rename_technique | add_mitigation | add_mit_rel
    t.string('item_id').notNullable();
    t.string('item_name').nullable();
    t.text('old_data').nullable();  // JSON
    t.text('new_data').nullable();  // JSON
    t.string('status').notNullable().defaultTo('pending'); // pending | approved | rejected
    t.string('reviewed_by').nullable();
    t.timestamp('reviewed_at').nullable();
  });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_attack_update_items_batch ON attack_update_items(batch_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_attack_update_batches_status ON attack_update_batches(status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('attack_update_items');
  await knex.schema.dropTableIfExists('attack_update_batches');
  await knex.schema.dropTableIfExists('attack_update_settings');
}
