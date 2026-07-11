import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTable('taxii_servers', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('url').notNullable();
      t.string('api_root');
      t.string('collection_id');
      // none | basic | bearer
      t.string('auth_type').notNullable().defaultTo('none');
      t.string('username');
      t.text('password');
      t.text('token');
      t.integer('ssl_verify').notNullable().defaultTo(1);
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('taxii_ingest_jobs', t => {
      t.increments('id').primary();
      t.integer('server_id').notNullable().references('id').inTable('taxii_servers').onDelete('CASCADE');
      t.string('name').notNullable();
      t.string('schedule').notNullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('last_run');
      // success | error | running | pending
      t.string('last_status');
      t.text('last_error');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('taxii_pending_ingests', t => {
      t.increments('id').primary();
      t.integer('job_id');
      t.integer('server_id').notNullable().references('id').inTable('taxii_servers').onDelete('CASCADE');
      t.string('batch_id').notNullable();
      t.string('stix_id').notNullable();
      // intrusion-set | attack-pattern | relationship
      t.string('stix_type').notNullable();
      t.string('name');
      // create_group | update_group | link_technique | create_technique
      t.string('proposed_action').notNullable();
      t.text('proposed_data').notNullable();
      // pending | approved | rejected
      t.string('status').notNullable().defaultTo('pending');
      t.integer('reviewed_by');
      t.timestamp('reviewed_at');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_taxii_pending_batch ON taxii_pending_ingests(batch_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_taxii_pending_status ON taxii_pending_ingests(status)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_taxii_jobs_server ON taxii_ingest_jobs(server_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists('taxii_pending_ingests')
    .dropTableIfExists('taxii_ingest_jobs')
    .dropTableIfExists('taxii_servers');
}
