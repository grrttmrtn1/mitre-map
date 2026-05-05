import type Database from 'better-sqlite3';
import { TACTICS, TECHNIQUES, MITIGATIONS, TECHNIQUE_MITIGATIONS } from '../data/attack';
import { D3FEND_TECHNIQUES, ATTACK_D3FEND } from '../data/d3fend';
import { DEMO_TOOLS, DEMO_DETECTIONS } from '../data/demo';
import { THREAT_GROUPS } from '../data/threat-groups';
import { COMPLIANCE_FRAMEWORKS, COMPLIANCE_CONTROLS, TECHNIQUE_COMPLIANCE, DEMO_TAGS } from '../data/compliance';

export function seedDatabase(db: Database.Database): void {
  const existingTactics = db.prepare('SELECT COUNT(*) as count FROM attack_tactics').get() as { count: number };
  if (existingTactics.count > 0) {
    seedNewTables(db);
    return;
  }

  console.log('Seeding MITRE ATT&CK + D3FEND data...');

  const insertTactic = db.prepare('INSERT OR IGNORE INTO attack_tactics (id, name, shortname, description) VALUES (?, ?, ?, ?)');
  const insertTechnique = db.prepare('INSERT OR IGNORE INTO attack_techniques (id, name, description, tactic_ids) VALUES (?, ?, ?, ?)');
  const insertMitigation = db.prepare('INSERT OR IGNORE INTO attack_mitigations (id, name, description) VALUES (?, ?, ?)');
  const insertTechMit = db.prepare('INSERT OR IGNORE INTO technique_mitigations (technique_id, mitigation_id) VALUES (?, ?)');
  const insertD3fend = db.prepare('INSERT OR IGNORE INTO d3fend_techniques (id, name, description, category, subcategory, url) VALUES (?, ?, ?, ?, ?, ?)');
  const insertAttackD3 = db.prepare('INSERT OR IGNORE INTO attack_d3fend (attack_id, d3fend_id) VALUES (?, ?)');
  const insertTool = db.prepare('INSERT INTO tools (name, vendor, description, category, status) VALUES (?, ?, ?, ?, ?)');
  const insertToolD3 = db.prepare('INSERT OR IGNORE INTO tool_d3fend (tool_id, d3fend_id) VALUES (?, ?)');
  const insertToolMit = db.prepare('INSERT OR IGNORE INTO tool_mitigations (tool_id, mitigation_id) VALUES (?, ?)');
  const insertDetection = db.prepare('INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, false_positive_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  const seedAll = db.transaction(() => {
    for (const t of TACTICS) insertTactic.run(t.id, t.name, t.shortname, t.description);
    for (const t of TECHNIQUES) insertTechnique.run(t.id, t.name, t.description, JSON.stringify(t.tactic_ids));
    for (const m of MITIGATIONS) insertMitigation.run(m.id, m.name, m.description);
    for (const tm of TECHNIQUE_MITIGATIONS) insertTechMit.run(tm.technique_id, tm.mitigation_id);
    for (const d of D3FEND_TECHNIQUES) insertD3fend.run(d.id, d.name, d.description, d.category, d.subcategory, d.url);
    for (const m of ATTACK_D3FEND) insertAttackD3.run(m.attack_id, m.d3fend_id);
    for (const tool of DEMO_TOOLS) {
      const result = insertTool.run(tool.name, tool.vendor, tool.description, tool.category, tool.status);
      const toolId = result.lastInsertRowid;
      for (const d3Id of tool.d3fend_ids) insertToolD3.run(toolId, d3Id);
      for (const mitId of tool.mitigation_ids) insertToolMit.run(toolId, mitId);
    }
    for (const det of DEMO_DETECTIONS) {
      insertDetection.run(det.name, det.description, det.rule_id ?? null, det.source,
        JSON.stringify(det.technique_ids), det.status, det.severity,
        det.confidence, det.false_positive_rate ?? null, det.notes ?? null);
    }
  });
  seedAll();

  seedNewTables(db);
  console.log(`Seeded: ${TACTICS.length} tactics, ${TECHNIQUES.length} techniques, ${THREAT_GROUPS.length} groups`);
}

function seedNewTables(db: Database.Database): void {
  const existingGroups = (db.prepare('SELECT COUNT(*) as c FROM threat_groups').get() as any).c;
  if (existingGroups === 0) {
    const insertGroup = db.prepare('INSERT OR IGNORE INTO threat_groups (id, name, aliases, description, country, motivation, url) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertGT = db.prepare('INSERT OR IGNORE INTO group_techniques (group_id, technique_id) VALUES (?, ?)');
    const seedGroups = db.transaction(() => {
      for (const g of THREAT_GROUPS) {
        insertGroup.run(g.id, g.name, JSON.stringify(g.aliases), g.description, g.country, g.motivation, g.url);
        for (const tid of g.technique_ids) {
          const exists = db.prepare('SELECT 1 FROM attack_techniques WHERE id = ?').get(tid);
          if (exists) insertGT.run(g.id, tid);
        }
      }
    });
    seedGroups();
  }

  const existingFrameworks = (db.prepare('SELECT COUNT(*) as c FROM compliance_frameworks').get() as any).c;
  if (existingFrameworks === 0) {
    const insertFW = db.prepare('INSERT OR IGNORE INTO compliance_frameworks (id, name, version, description) VALUES (?, ?, ?, ?)');
    const insertCtrl = db.prepare('INSERT OR IGNORE INTO compliance_controls (id, framework_id, name, description, category) VALUES (?, ?, ?, ?, ?)');
    const insertTC = db.prepare('INSERT OR IGNORE INTO technique_compliance (technique_id, control_id) VALUES (?, ?)');
    const seedCompliance = db.transaction(() => {
      for (const f of COMPLIANCE_FRAMEWORKS) insertFW.run(f.id, f.name, f.version, f.description);
      for (const c of COMPLIANCE_CONTROLS) insertCtrl.run(c.id, c.framework_id, c.name, c.description, c.category);
      for (const m of TECHNIQUE_COMPLIANCE) {
        const exists = db.prepare('SELECT 1 FROM attack_techniques WHERE id = ?').get(m.technique_id);
        if (exists) insertTC.run(m.technique_id, m.control_id);
      }
    });
    seedCompliance();
  }

  const existingTags = (db.prepare('SELECT COUNT(*) as c FROM tags').get() as any).c;
  if (existingTags === 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, color, description) VALUES (?, ?, ?)');
    const seedTags = db.transaction(() => {
      for (const t of DEMO_TAGS) insertTag.run(t.name, t.color, t.description);
    });
    seedTags();
    // Assign some demo tags to detections
    const detections = db.prepare('SELECT id FROM detections LIMIT 8').all() as any[];
    const tagIds = db.prepare('SELECT id, name FROM tags').all() as any[];
    const tagMap = Object.fromEntries(tagIds.map(t => [t.name, t.id]));
    const assignments: Array<[number, number]> = [
      [detections[0]?.id, tagMap['high-fidelity']], [detections[0]?.id, tagMap['identity']],
      [detections[1]?.id, tagMap['critical-asset']], [detections[1]?.id, tagMap['high-fidelity']],
      [detections[2]?.id, tagMap['identity']], [detections[3]?.id, tagMap['ransomware']],
      [detections[4]?.id, tagMap['critical-asset']], [detections[7]?.id, tagMap['lateral-movement']],
      [detections[12]?.id, tagMap['exfiltration']], [detections[8]?.id, tagMap['needs-review']],
    ];
    const insertET = db.prepare('INSERT OR IGNORE INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)');
    const seedET = db.transaction(() => {
      for (const [eid, tid] of assignments) {
        if (eid && tid) insertET.run('detection', String(eid), tid);
      }
    });
    seedET();
  }

  // Seed initial coverage snapshot
  const existingSnaps = (db.prepare('SELECT COUNT(*) as c FROM coverage_snapshots').get() as any).c;
  if (existingSnaps === 0) {
    const total = (db.prepare('SELECT COUNT(*) as c FROM attack_techniques WHERE is_subtechnique=0').get() as any).c;
    const active = (db.prepare("SELECT technique_ids FROM detections WHERE status='active'").all() as any[]);
    const covered = new Set<string>();
    for (const d of active) for (const id of JSON.parse(d.technique_ids)) covered.add(id);
    db.prepare(`INSERT INTO coverage_snapshots (taken_at, total_techniques, covered_techniques, detected_techniques,
      mitigated_techniques, gap_techniques, coverage_pct, active_detections, total_tools, notes)
      VALUES (datetime('now','-30 days'), ?, ?, ?, 12, ?, ?, ?, ?, 'Initial baseline')`).run(
      total, Math.max(0, covered.size - 8), Math.max(0, covered.size - 8),
      total - Math.max(0, covered.size - 8),
      Math.round(((covered.size - 8) / total) * 100),
      (db.prepare("SELECT COUNT(*) as c FROM detections WHERE status='active'").get() as any).c - 3,
      (db.prepare("SELECT COUNT(*) as c FROM tools").get() as any).c
    );
  }
}
