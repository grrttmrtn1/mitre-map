import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTable('siem_integrations', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.text('config').notNullable().defaultTo('{}');
      t.text('credentials_enc').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_push_status').nullable();
      t.string('last_push_error').nullable();
      t.timestamp('last_pushed_at').nullable();
      t.string('last_pull_status').nullable();
      t.string('last_pull_error').nullable();
      t.timestamp('last_pulled_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('siem_sync_log', t => {
      t.increments('id').primary();
      t.integer('integration_id').notNullable()
        .references('id').inTable('siem_integrations').onDelete('CASCADE');
      t.string('direction').notNullable();
      t.string('status').notNullable();
      t.integer('items_affected').notNullable().defaultTo(0);
      t.text('detail').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('github_sync_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('repo_url').notNullable();
      t.string('branch').notNullable().defaultTo('main');
      t.string('path_glob').notNullable().defaultTo('**/*.yml');
      t.text('token_enc').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_sha').nullable();
      t.timestamp('last_synced_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('ticketing_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.string('base_url').notNullable();
      t.text('credentials_enc').nullable();
      t.string('default_project').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists('siem_sync_log')
    .dropTableIfExists('siem_integrations')
    .dropTableIfExists('github_sync_configs')
    .dropTableIfExists('ticketing_configs');
}
