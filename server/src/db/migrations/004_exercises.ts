import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTableIfNotExists('exercises', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.string('type').notNullable().defaultTo('purple_team'); // red_team | purple_team | tabletop
      t.string('status').notNullable().defaultTo('planning'); // planning | active | completed | cancelled
      t.string('threat_group_id').references('id').inTable('threat_groups').onDelete('SET NULL');
      t.text('scope_notes');
      t.string('start_date');
      t.string('end_date');
      t.string('lead');
      t.string('created_by');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('exercise_techniques', t => {
      t.integer('exercise_id').notNullable().references('id').inTable('exercises').onDelete('CASCADE');
      t.string('technique_id').notNullable().references('id').inTable('attack_techniques');
      t.primary(['exercise_id', 'technique_id']);
    })
    .createTableIfNotExists('exercise_test_runs', t => {
      t.increments('id').primary();
      t.integer('exercise_id').notNullable().references('id').inTable('exercises').onDelete('CASCADE');
      t.integer('art_test_id').notNullable().references('id').inTable('art_tests').onDelete('CASCADE');
      // detected | not_detected | partial | blocked | n_a | pending
      t.string('outcome').notNullable().defaultTo('pending');
      t.string('ran_at');
      t.string('ran_by');
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTableIfNotExists('exercise_findings', t => {
      t.increments('id').primary();
      t.integer('exercise_id').notNullable().references('id').inTable('exercises').onDelete('CASCADE');
      t.string('technique_id').references('id').inTable('attack_techniques').onDelete('SET NULL');
      t.string('title').notNullable();
      // gap | detection_validated | detection_failed | control_weakness | new_ttp
      t.string('finding_type').notNullable().defaultTo('gap');
      // critical | high | medium | low | informational
      t.string('severity').notNullable().defaultTo('medium');
      t.text('description');
      t.text('recommendation');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_exercises_status ON exercises(status)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_exercise_techniques_exercise ON exercise_techniques(exercise_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_exercise_test_runs_exercise ON exercise_test_runs(exercise_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_exercise_findings_exercise ON exercise_findings(exercise_id)');
}

export async function down(knex: Knex): Promise<void> {
  const tables = ['exercise_findings', 'exercise_test_runs', 'exercise_techniques', 'exercises'];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
}
