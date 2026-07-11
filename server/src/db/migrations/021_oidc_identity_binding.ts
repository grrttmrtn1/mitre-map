import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // NULL values remain valid for local-password accounts. The composite unique
  // index prevents one external identity from being attached to two users.
  await knex.schema.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc_identity ON users(oidc_provider, oidc_sub)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_users_oidc_identity');
}
