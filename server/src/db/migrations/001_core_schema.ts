import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .createTable('attack_tactics', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('shortname').notNullable();
      t.text('description');
    })
    .createTable('attack_techniques', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.text('tactic_ids').notNullable().defaultTo('[]');
      t.integer('is_subtechnique').notNullable().defaultTo(0);
      t.string('parent_id');
      t.string('url');
    })
    .createTable('attack_mitigations', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.string('url');
    })
    .createTable('technique_mitigations', t => {
      t.string('technique_id').notNullable().references('id').inTable('attack_techniques');
      t.string('mitigation_id').notNullable().references('id').inTable('attack_mitigations');
      t.primary(['technique_id', 'mitigation_id']);
    })
    .createTable('d3fend_techniques', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.string('category').notNullable();
      t.string('subcategory');
      t.string('url');
    })
    .createTable('attack_d3fend', t => {
      t.string('attack_id').notNullable().references('id').inTable('attack_techniques');
      t.string('d3fend_id').notNullable().references('id').inTable('d3fend_techniques');
      t.primary(['attack_id', 'd3fend_id']);
    })
    .createTable('tools', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('vendor');
      t.text('description');
      t.string('category').notNullable();
      t.string('status').notNullable().defaultTo('active');
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('tool_d3fend', t => {
      t.integer('tool_id').notNullable().references('id').inTable('tools').onDelete('CASCADE');
      t.string('d3fend_id').notNullable().references('id').inTable('d3fend_techniques');
      t.text('notes');
      t.primary(['tool_id', 'd3fend_id']);
    })
    .createTable('tool_mitigations', t => {
      t.integer('tool_id').notNullable().references('id').inTable('tools').onDelete('CASCADE');
      t.string('mitigation_id').notNullable().references('id').inTable('attack_mitigations');
      t.text('notes');
      t.primary(['tool_id', 'mitigation_id']);
    })
    .createTable('detections', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.string('rule_id');
      t.string('source');
      t.text('technique_ids').notNullable().defaultTo('[]');
      t.string('status').notNullable().defaultTo('active');
      t.string('severity').notNullable().defaultTo('medium');
      t.string('confidence').notNullable().defaultTo('medium');
      t.string('false_positive_rate');
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('tags', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('color').notNullable().defaultTo('#6366f1');
      t.text('description');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('entity_tags', t => {
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.integer('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE');
      t.primary(['entity_type', 'entity_id', 'tag_id']);
    })
    .createTable('comments', t => {
      t.increments('id').primary();
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.string('author').notNullable().defaultTo('analyst');
      t.text('body').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('assignments', t => {
      t.increments('id').primary();
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.string('assignee').notNullable();
      t.string('status').notNullable().defaultTo('open');
      t.string('priority').notNullable().defaultTo('medium');
      t.string('due_date');
      t.text('notes');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('audit_log', t => {
      t.increments('id').primary();
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.string('action').notNullable();
      t.string('actor').notNullable().defaultTo('user');
      t.text('changes');
      t.string('source_ip');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('coverage_snapshots', t => {
      t.increments('id').primary();
      t.timestamp('taken_at').defaultTo(knex.fn.now());
      t.integer('total_techniques').notNullable();
      t.integer('covered_techniques').notNullable();
      t.integer('detected_techniques').notNullable();
      t.integer('mitigated_techniques').notNullable();
      t.integer('gap_techniques').notNullable();
      t.integer('coverage_pct').notNullable();
      t.integer('active_detections').notNullable();
      t.integer('total_tools').notNullable();
      t.text('notes');
    })
    .createTable('threat_groups', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('aliases').notNullable().defaultTo('[]');
      t.text('description');
      t.string('country');
      t.string('motivation');
      t.string('url');
    })
    .createTable('group_techniques', t => {
      t.string('group_id').notNullable().references('id').inTable('threat_groups');
      t.string('technique_id').notNullable();
      t.primary(['group_id', 'technique_id']);
    })
    .createTable('group_technique_procedures', t => {
      t.increments('id').primary();
      t.string('group_id').notNullable().references('id').inTable('threat_groups').onDelete('CASCADE');
      t.string('technique_id').notNullable();
      t.string('type').notNullable().defaultTo('command');
      t.text('content').notNullable();
      t.string('source');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('motivations', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('color').notNullable().defaultTo('#6366f1');
      t.text('description');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('countries', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('color').notNullable().defaultTo('#6366f1');
      t.string('flag');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('api_keys', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('key_hash').notNullable().unique();
      t.string('masked_key').notNullable();
      t.text('scopes').notNullable().defaultTo('["read"]');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('last_used_at');
      t.timestamp('expires_at');
    })
    .createTable('compliance_frameworks', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('version');
      t.text('description');
    })
    .createTable('compliance_controls', t => {
      t.string('id').primary();
      t.string('framework_id').notNullable().references('id').inTable('compliance_frameworks');
      t.string('name').notNullable();
      t.text('description');
      t.string('category');
    })
    .createTable('technique_compliance', t => {
      t.string('technique_id').notNullable();
      t.string('control_id').notNullable();
      t.primary(['technique_id', 'control_id']);
    });

  // Indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_detections_status ON detections(status)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_detections_source ON detections(source)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_attack_techniques_parent ON attack_techniques(parent_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assignments_entity ON assignments(entity_type, entity_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_procedures_group_tech ON group_technique_procedures(group_id, technique_id)');
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'technique_compliance', 'compliance_controls', 'compliance_frameworks',
    'api_keys', 'countries', 'motivations', 'group_technique_procedures',
    'group_techniques', 'threat_groups', 'coverage_snapshots', 'audit_log',
    'assignments', 'comments', 'entity_tags', 'tags', 'detections',
    'tool_mitigations', 'tool_d3fend', 'tools', 'attack_d3fend',
    'd3fend_techniques', 'technique_mitigations', 'attack_mitigations',
    'attack_techniques', 'attack_tactics',
  ];
  for (const t of tables) await knex.schema.dropTableIfExists(t);
}
