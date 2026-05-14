import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('detections', t => {
    t.timestamp('last_fired_at').nullable();
    t.integer('true_positive_count').notNullable().defaultTo(0);
    t.integer('false_positive_count').notNullable().defaultTo(0);
    t.integer('suppressed_count').notNullable().defaultTo(0);
    t.timestamp('last_reviewed_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('detections', t => {
    t.dropColumn('last_fired_at');
    t.dropColumn('true_positive_count');
    t.dropColumn('false_positive_count');
    t.dropColumn('suppressed_count');
    t.dropColumn('last_reviewed_at');
  });
}
