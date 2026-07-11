import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('refresh_tokens', 'family_id'))) {
    await knex.schema.alterTable('refresh_tokens', t => t.string('family_id'));
  }
  if (!(await knex.schema.hasTable('consumed_refresh_tokens'))) {
    await knex.schema.createTable('consumed_refresh_tokens', t => {
      t.increments('id').primary();
      t.string('token_hash').notNullable().unique();
      t.string('family_id').notNullable();
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.timestamp('expires_at').notNullable();
      t.timestamp('consumed_at').defaultTo(knex.fn.now());
    });
  }
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_consumed_refresh_family ON consumed_refresh_tokens(family_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consumed_refresh_tokens');
  if (await knex.schema.hasColumn('refresh_tokens', 'family_id')) {
    await knex.schema.alterTable('refresh_tokens', t => t.dropColumn('family_id'));
  }
}
