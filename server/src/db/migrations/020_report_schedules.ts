import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('report_schedules', t => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('report_type').notNullable();
    t.string('schedule').notNullable();
    t.text('recipients').notNullable();
    t.string('format').notNullable().defaultTo('pdf');
    t.string('framework_id').nullable();
    t.integer('enabled').notNullable().defaultTo(1);
    t.timestamp('last_run_at').nullable();
    t.string('last_run_status').nullable();
    t.string('last_run_error').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('report_schedules');
}
