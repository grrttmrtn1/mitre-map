import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', t => {
    t.increments('id').primary();
    t.integer('user_id').nullable(); // null = all active analysts see it
    t.string('type').notNullable();  // taxii_batch_ready | deprecated_technique | assignment_due | coverage_alert
    t.string('title').notNullable();
    t.text('message').nullable();
    t.string('entity_type').nullable(); // taxii_batch | detection | assignment
    t.string('entity_id').nullable();
    t.integer('read').notNullable().defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
