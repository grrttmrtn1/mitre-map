import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'mitremap.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS attack_tactics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortname TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS attack_techniques (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      tactic_ids TEXT NOT NULL DEFAULT '[]',
      is_subtechnique INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS attack_mitigations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS technique_mitigations (
      technique_id TEXT NOT NULL,
      mitigation_id TEXT NOT NULL,
      PRIMARY KEY (technique_id, mitigation_id),
      FOREIGN KEY (technique_id) REFERENCES attack_techniques(id),
      FOREIGN KEY (mitigation_id) REFERENCES attack_mitigations(id)
    );

    CREATE TABLE IF NOT EXISTS d3fend_techniques (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS attack_d3fend (
      attack_id TEXT NOT NULL,
      d3fend_id TEXT NOT NULL,
      PRIMARY KEY (attack_id, d3fend_id),
      FOREIGN KEY (attack_id) REFERENCES attack_techniques(id),
      FOREIGN KEY (d3fend_id) REFERENCES d3fend_techniques(id)
    );

    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vendor TEXT,
      description TEXT,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tool_d3fend (
      tool_id INTEGER NOT NULL,
      d3fend_id TEXT NOT NULL,
      notes TEXT,
      PRIMARY KEY (tool_id, d3fend_id),
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
      FOREIGN KEY (d3fend_id) REFERENCES d3fend_techniques(id)
    );

    CREATE TABLE IF NOT EXISTS tool_mitigations (
      tool_id INTEGER NOT NULL,
      mitigation_id TEXT NOT NULL,
      notes TEXT,
      PRIMARY KEY (tool_id, mitigation_id),
      FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE,
      FOREIGN KEY (mitigation_id) REFERENCES attack_mitigations(id)
    );

    CREATE TABLE IF NOT EXISTS detections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rule_id TEXT,
      source TEXT,
      technique_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      severity TEXT NOT NULL DEFAULT 'medium',
      confidence TEXT NOT NULL DEFAULT 'medium',
      false_positive_rate TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_detections_status ON detections(status);
    CREATE INDEX IF NOT EXISTS idx_detections_source ON detections(source);
    CREATE INDEX IF NOT EXISTS idx_attack_techniques_parent ON attack_techniques(parent_id);

    -- Tags
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entity_tags (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (entity_type, entity_id, tag_id),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    -- Comments
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'analyst',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);

    -- Assignments
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      assignee TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_entity ON assignments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee);

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'user',
      changes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

    -- Coverage snapshots
    CREATE TABLE IF NOT EXISTS coverage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taken_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_techniques INTEGER NOT NULL,
      covered_techniques INTEGER NOT NULL,
      detected_techniques INTEGER NOT NULL,
      mitigated_techniques INTEGER NOT NULL,
      gap_techniques INTEGER NOT NULL,
      coverage_pct INTEGER NOT NULL,
      active_detections INTEGER NOT NULL,
      total_tools INTEGER NOT NULL,
      notes TEXT
    );

    -- Threat groups
    CREATE TABLE IF NOT EXISTS threat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      description TEXT,
      country TEXT,
      motivation TEXT,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS group_techniques (
      group_id TEXT NOT NULL,
      technique_id TEXT NOT NULL,
      PRIMARY KEY (group_id, technique_id),
      FOREIGN KEY (group_id) REFERENCES threat_groups(id)
    );

    -- API Keys
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      masked_key TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '["read"]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      expires_at TEXT
    );

    -- Compliance
    CREATE TABLE IF NOT EXISTS compliance_frameworks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS compliance_controls (
      id TEXT PRIMARY KEY,
      framework_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      FOREIGN KEY (framework_id) REFERENCES compliance_frameworks(id)
    );

    CREATE TABLE IF NOT EXISTS technique_compliance (
      technique_id TEXT NOT NULL,
      control_id TEXT NOT NULL,
      PRIMARY KEY (technique_id, control_id)
    );
  `);
}

export function logAudit(
  db: Database.Database,
  entityType: string,
  entityId: string,
  action: string,
  actor = 'user',
  changes?: Record<string, unknown>
): void {
  db.prepare(
    'INSERT INTO audit_log (entity_type, entity_id, action, actor, changes) VALUES (?, ?, ?, ?, ?)'
  ).run(entityType, entityId, action, actor, changes ? JSON.stringify(changes) : null);
}
