import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    // Multi-user auth
    .createTable('users', t => {
      t.increments('id').primary();
      t.string('email').notNullable().unique();
      t.string('name').notNullable();
      t.text('password_hash');
      t.string('role').notNullable().defaultTo('analyst'); // admin | analyst | readonly
      t.string('oidc_provider');
      t.string('oidc_sub');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('last_login');
      t.integer('is_active').notNullable().defaultTo(1);
    })
    .createTable('refresh_tokens', t => {
      t.increments('id').primary();
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('token_hash').notNullable().unique();
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('oidc_providers', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('slug').notNullable().unique();
      t.string('issuer_url').notNullable();
      t.string('client_id').notNullable();
      t.text('client_secret').notNullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    // ATT&CK data sources
    .createTable('data_sources', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('category').notNullable();
      t.text('description');
    })
    .createTable('technique_data_sources', t => {
      t.string('technique_id').notNullable().references('id').inTable('attack_techniques');
      t.integer('data_source_id').notNullable().references('id').inTable('data_sources');
      t.primary(['technique_id', 'data_source_id']);
    })
    .createTable('org_data_sources', t => {
      t.increments('id').primary();
      t.integer('data_source_id').notNullable().unique().references('id').inTable('data_sources');
      t.string('status').notNullable().defaultTo('not_collecting'); // collecting | partial | not_collecting
      t.string('collection_method');
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    // ATT&CK version management
    .createTable('attack_version_info', t => {
      t.increments('id').primary();
      t.string('version').notNullable();
      t.string('name').notNullable();
      t.string('released_at');
      t.text('notes');
      t.integer('is_active').notNullable().defaultTo(1);
    })
    .createTable('deprecated_techniques', t => {
      t.string('technique_id').primary();
      t.string('deprecated_in_version').notNullable();
      t.string('superseded_by');
      t.text('reason');
    })
    // Atomic Red Team tests
    .createTable('art_tests', t => {
      t.increments('id').primary();
      t.string('technique_id').notNullable().references('id').inTable('attack_techniques');
      t.string('test_guid').unique();
      t.string('name').notNullable();
      t.text('description');
      t.string('platform');
      t.string('executor_type');
      t.text('auto_generated_command');
    })
    .createTable('detection_art_results', t => {
      t.increments('id').primary();
      t.integer('detection_id').notNullable().references('id').inTable('detections').onDelete('CASCADE');
      t.integer('art_test_id').notNullable().references('id').inTable('art_tests').onDelete('CASCADE');
      t.string('status').notNullable().defaultTo('untested'); // untested | tested | validated | failed
      t.string('run_at');
      t.string('run_by');
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_art_tests_technique ON art_tests(technique_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_art_results_detection ON detection_art_results(detection_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'detection_art_results', 'art_tests', 'deprecated_techniques',
    'attack_version_info', 'org_data_sources', 'technique_data_sources',
    'data_sources', 'oidc_providers', 'refresh_tokens', 'users',
  ];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
}
