import Knex, { type Knex as KnexType } from 'knex';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

export function createTestDb(): KnexType {
  return Knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
}

// Create the full application schema directly (avoids dynamic .ts migration loading)
export async function setupTestDb(db: KnexType): Promise<void> {
  await db.schema
    .createTableIfNotExists('attack_tactics', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('shortname').notNullable();
      t.text('description');
    })
    .createTableIfNotExists('attack_techniques', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.text('tactic_ids').notNullable().defaultTo('[]');
      t.integer('is_subtechnique').notNullable().defaultTo(0);
      t.string('parent_id');
      t.string('url');
    })
    .createTableIfNotExists('attack_mitigations', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.string('url');
    })
    .createTableIfNotExists('technique_mitigations', t => {
      t.string('technique_id').notNullable();
      t.string('mitigation_id').notNullable();
      t.primary(['technique_id', 'mitigation_id']);
    })
    .createTableIfNotExists('d3fend_techniques', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('description');
      t.string('category').notNullable();
      t.string('subcategory');
      t.string('url');
    })
    .createTableIfNotExists('attack_d3fend', t => {
      t.string('attack_id').notNullable();
      t.string('d3fend_id').notNullable();
      t.primary(['attack_id', 'd3fend_id']);
    })
    .createTableIfNotExists('tools', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('vendor');
      t.text('description');
      t.string('category').notNullable();
      t.string('status').notNullable().defaultTo('active');
      t.text('notes');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('tool_d3fend', t => {
      t.integer('tool_id').notNullable();
      t.string('d3fend_id').notNullable();
      t.text('notes');
      t.primary(['tool_id', 'd3fend_id']);
    })
    .createTableIfNotExists('tool_mitigations', t => {
      t.integer('tool_id').notNullable();
      t.string('mitigation_id').notNullable();
      t.text('notes');
      t.primary(['tool_id', 'mitigation_id']);
    })
    .createTableIfNotExists('detections', t => {
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
      t.timestamp('last_fired_at').nullable();
      t.integer('true_positive_count').notNullable().defaultTo(0);
      t.integer('false_positive_count').notNullable().defaultTo(0);
      t.integer('suppressed_count').notNullable().defaultTo(0);
      t.timestamp('last_reviewed_at').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('tags', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('color').notNullable().defaultTo('#6366f1');
      t.text('description');
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('entity_tags', t => {
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.integer('tag_id').notNullable();
      t.primary(['entity_type', 'entity_id', 'tag_id']);
    })
    .createTableIfNotExists('comments', t => {
      t.increments('id').primary();
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.string('author').notNullable().defaultTo('analyst');
      t.text('body').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('assignments', t => {
      t.increments('id').primary();
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.string('assignee').notNullable();
      t.string('status').notNullable().defaultTo('open');
      t.string('priority').notNullable().defaultTo('medium');
      t.string('due_date');
      t.text('notes');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('audit_log', t => {
      t.increments('id').primary();
      t.string('entity_type').notNullable();
      t.string('entity_id').notNullable();
      t.string('action').notNullable();
      t.string('actor').notNullable().defaultTo('user');
      t.text('changes');
      t.string('source_ip');
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('coverage_snapshots', t => {
      t.increments('id').primary();
      t.timestamp('taken_at').defaultTo(db.fn.now());
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
    .createTableIfNotExists('threat_groups', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.text('aliases').notNullable().defaultTo('[]');
      t.text('description');
      t.string('country');
      t.string('motivation');
      t.string('url');
    })
    .createTableIfNotExists('group_techniques', t => {
      t.string('group_id').notNullable();
      t.string('technique_id').notNullable();
      t.primary(['group_id', 'technique_id']);
    })
    .createTableIfNotExists('group_technique_procedures', t => {
      t.increments('id').primary();
      t.string('group_id').notNullable();
      t.string('technique_id').notNullable();
      t.string('type').notNullable().defaultTo('command');
      t.text('content').notNullable();
      t.string('source');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('motivations', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('color').notNullable().defaultTo('#6366f1');
      t.text('description');
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('countries', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('color').notNullable().defaultTo('#6366f1');
      t.string('flag');
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('api_keys', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('key_hash').notNullable().unique();
      t.string('masked_key').notNullable();
      t.text('scopes').notNullable().defaultTo('["read"]');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('last_used_at');
      t.timestamp('expires_at');
    })
    .createTableIfNotExists('compliance_frameworks', t => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('version');
      t.text('description');
    })
    .createTableIfNotExists('compliance_controls', t => {
      t.string('id').primary();
      t.string('framework_id').notNullable();
      t.string('name').notNullable();
      t.text('description');
      t.string('category');
    })
    .createTableIfNotExists('technique_compliance', t => {
      t.string('technique_id').notNullable();
      t.string('control_id').notNullable();
      t.primary(['technique_id', 'control_id']);
    })
    // Migration 002
    .createTableIfNotExists('users', t => {
      t.increments('id').primary();
      t.string('email').notNullable().unique();
      t.string('name').notNullable();
      t.text('password_hash');
      t.string('role').notNullable().defaultTo('analyst');
      t.string('oidc_provider');
      t.string('oidc_sub');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('last_login');
      t.integer('is_active').notNullable().defaultTo(1);
    })
    .createTableIfNotExists('refresh_tokens', t => {
      t.increments('id').primary();
      t.integer('user_id').notNullable();
      t.string('token_hash').notNullable().unique();
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('oidc_providers', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('slug').notNullable().unique();
      t.string('issuer_url').notNullable();
      t.string('client_id').notNullable();
      t.text('client_secret').notNullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('data_sources', t => {
      t.increments('id').primary();
      t.string('name').notNullable().unique();
      t.string('category').notNullable();
      t.text('description');
    })
    .createTableIfNotExists('technique_data_sources', t => {
      t.string('technique_id').notNullable();
      t.integer('data_source_id').notNullable();
      t.primary(['technique_id', 'data_source_id']);
    })
    .createTableIfNotExists('org_data_sources', t => {
      t.increments('id').primary();
      t.integer('data_source_id').notNullable().unique();
      t.string('status').notNullable().defaultTo('not_collecting');
      t.string('collection_method');
      t.text('notes');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('attack_version_info', t => {
      t.increments('id').primary();
      t.string('version').notNullable();
      t.string('name').notNullable();
      t.string('released_at');
      t.text('notes');
      t.integer('is_active').notNullable().defaultTo(1);
    })
    .createTableIfNotExists('deprecated_techniques', t => {
      t.string('technique_id').primary();
      t.string('deprecated_in_version').notNullable();
      t.string('superseded_by');
      t.text('reason');
    })
    .createTableIfNotExists('art_tests', t => {
      t.increments('id').primary();
      t.string('technique_id').notNullable();
      t.string('test_guid').unique();
      t.string('name').notNullable();
      t.text('description');
      t.string('platform');
      t.string('executor_type');
      t.text('auto_generated_command');
      t.string('source').notNullable().defaultTo('atomic');
    })
    .createTableIfNotExists('detection_art_results', t => {
      t.increments('id').primary();
      t.integer('detection_id').notNullable();
      t.integer('art_test_id').notNullable();
      t.string('status').notNullable().defaultTo('untested');
      t.string('run_at');
      t.string('run_by');
      t.text('notes');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('notifications', t => {
      t.increments('id').primary();
      t.integer('user_id').nullable();
      t.string('type').notNullable();
      t.string('title').notNullable();
      t.text('message').nullable();
      t.string('entity_type').nullable();
      t.string('entity_id').nullable();
      t.integer('read').notNullable().defaultTo(0);
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('compliance_snapshots', t => {
      t.increments('id').primary();
      t.string('framework_id').notNullable();
      t.integer('total_controls').notNullable();
      t.integer('covered_controls').notNullable();
      t.integer('coverage_pct').notNullable();
      t.timestamp('taken_at').defaultTo(db.fn.now());
    })
    // Migration 018
    .createTableIfNotExists('siem_integrations', t => {
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
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('siem_sync_log', t => {
      t.increments('id').primary();
      t.integer('integration_id').notNullable();
      t.string('direction').notNullable();
      t.string('status').notNullable();
      t.integer('items_affected').notNullable().defaultTo(0);
      t.text('detail').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('github_sync_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('repo_url').notNullable();
      t.string('branch').notNullable().defaultTo('main');
      t.string('path_glob').notNullable().defaultTo('**/*.yml');
      t.text('token_enc').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.string('last_sha').nullable();
      t.timestamp('last_synced_at').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    })
    .createTableIfNotExists('ticketing_configs', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('type').notNullable();
      t.string('base_url').notNullable();
      t.text('credentials_enc').nullable();
      t.string('default_project').nullable();
      t.integer('enabled').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
}

// Creates a minimal Express app for route testing (no auth middleware)
export function createTestApp(...routers: Array<[string, express.Router]>): express.Application {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).actor = 'test-user';
    (req as any).sourceIp = '127.0.0.1';
    (req as any).user = { id: 1, email: 'test@test.com', name: 'Test User', role: 'admin', is_active: 1 };
    next();
  });
  for (const [path, router] of routers) {
    app.use(path, router);
  }
  return app;
}
