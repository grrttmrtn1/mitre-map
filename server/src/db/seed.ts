import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { TACTICS, TECHNIQUES, MITIGATIONS, TECHNIQUE_MITIGATIONS } from '../data/attack';
import { D3FEND_TECHNIQUES, ATTACK_D3FEND } from '../data/d3fend';
import { DEMO_TOOLS, DEMO_DETECTIONS } from '../data/demo';
import { THREAT_GROUPS } from '../data/threat-groups';
import { COMPLIANCE_FRAMEWORKS, COMPLIANCE_CONTROLS, TECHNIQUE_COMPLIANCE, DEMO_TAGS } from '../data/compliance';
import { DATA_SOURCES, TECHNIQUE_DATA_SOURCES } from '../data/data-sources';
import { ART_TESTS } from '../data/atomic-tests';

const SEED_MOTIVATIONS = [
  { name: 'Espionage',              color: '#3b82f6' },
  { name: 'Financial',              color: '#10b981' },
  { name: 'Destructive',            color: '#ef4444' },
  { name: 'Hacktivism',            color: '#f59e0b' },
  { name: 'Espionage, Financial',   color: '#8b5cf6' },
  { name: 'Destructive, Espionage', color: '#dc2626' },
];

const SEED_COUNTRIES = [
  { name: 'Russia',       color: '#dc2626', flag: '🇷🇺' },
  { name: 'China',        color: '#dc2626', flag: '🇨🇳' },
  { name: 'North Korea',  color: '#7c3aed', flag: '🇰🇵' },
  { name: 'Iran',         color: '#d97706', flag: '🇮🇷' },
  { name: 'Vietnam',      color: '#dc2626', flag: '🇻🇳' },
  { name: 'Pakistan',     color: '#16a34a', flag: '🇵🇰' },
  { name: 'India',        color: '#f97316', flag: '🇮🇳' },
  { name: 'UAE',          color: '#16a34a', flag: '🇦🇪' },
  { name: 'Palestine',    color: '#16a34a', flag: '🇵🇸' },
  { name: 'USA',          color: '#3b82f6', flag: '🇺🇸' },
  { name: 'South Korea',  color: '#3b82f6', flag: '🇰🇷' },
  { name: 'Unknown',      color: '#6b7280', flag: '🌐' },
];

export async function seedDatabase(db: Knex): Promise<void> {
  const { count: existingTactics } = await db('attack_tactics').count('id as count').first() as any;
  const isFirstRun = Number(existingTactics) === 0;

  // Create default admin on first run if env vars are set
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await db('users').where('email', adminEmail.toLowerCase().trim()).first();
    if (!existing) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await db('users').insert({ email: adminEmail.toLowerCase().trim(), name: 'Admin', password_hash: hash, role: 'admin' });
      console.log(`Default admin created: ${adminEmail}`);
    }
  }

  // Always seed ATT&CK + D3FEND (ON CONFLICT DO NOTHING is idempotent)
  await db.transaction(async trx => {
    for (const t of TACTICS) {
      await trx.raw(
        'INSERT INTO attack_tactics (id, name, shortname, description) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [t.id, t.name, t.shortname, t.description]
      );
    }
    for (const t of TECHNIQUES) {
      await trx.raw(
        'INSERT INTO attack_techniques (id, name, description, tactic_ids) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [t.id, t.name, t.description, JSON.stringify(t.tactic_ids)]
      );
    }
    for (const m of MITIGATIONS) {
      await trx.raw(
        'INSERT INTO attack_mitigations (id, name, description) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        [m.id, m.name, m.description]
      );
    }
    for (const tm of TECHNIQUE_MITIGATIONS) {
      await trx.raw(
        'INSERT INTO technique_mitigations (technique_id, mitigation_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [tm.technique_id, tm.mitigation_id]
      );
    }
    for (const d of D3FEND_TECHNIQUES) {
      await trx.raw(
        'INSERT INTO d3fend_techniques (id, name, description, category, subcategory, url) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [d.id, d.name, d.description, d.category, d.subcategory, d.url]
      );
    }
    for (const m of ATTACK_D3FEND) {
      await trx.raw(
        'INSERT INTO attack_d3fend (attack_id, d3fend_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [m.attack_id, m.d3fend_id]
      );
    }
  });

  if (isFirstRun) {
    console.log(`Seeded: ${TACTICS.length} tactics, ${TECHNIQUES.length} techniques`);
    await db.transaction(async trx => {
      for (const tool of DEMO_TOOLS) {
        const [toolId] = await trx('tools').insert({
          name: tool.name, vendor: tool.vendor, description: tool.description,
          category: tool.category, status: tool.status,
        });
        for (const d3Id of tool.d3fend_ids) {
          await trx.raw('INSERT INTO tool_d3fend (tool_id, d3fend_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [toolId, d3Id]);
        }
        for (const mitId of tool.mitigation_ids) {
          await trx.raw('INSERT INTO tool_mitigations (tool_id, mitigation_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [toolId, mitId]);
        }
      }
      for (const det of DEMO_DETECTIONS) {
        await trx('detections').insert({
          name: det.name, description: det.description, rule_id: det.rule_id ?? null,
          source: det.source, technique_ids: JSON.stringify(det.technique_ids),
          status: det.status, severity: det.severity, confidence: det.confidence,
          false_positive_rate: det.false_positive_rate ?? null, notes: det.notes ?? null,
        });
      }
    });
  }

  await seedNewTables(db, isFirstRun);
}

async function seedNewTables(db: Knex, isFirstRun: boolean): Promise<void> {
  // Threat groups (idempotent via ON CONFLICT DO NOTHING)
  await db.transaction(async trx => {
    for (const g of THREAT_GROUPS) {
      await trx.raw(
        'INSERT INTO threat_groups (id, name, aliases, description, country, motivation, url) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
        [g.id, g.name, JSON.stringify(g.aliases), g.description, g.country, g.motivation, g.url]
      );
      for (const tid of g.technique_ids) {
        const exists = await trx('attack_techniques').where('id', tid).first();
        if (exists) {
          await trx.raw('INSERT INTO group_techniques (group_id, technique_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [g.id, tid]);
        }
      }
    }
  });

  // Compliance (first run only)
  const { count: fwCount } = await db('compliance_frameworks').count('id as count').first() as any;
  if (Number(fwCount) === 0) {
    await db.transaction(async trx => {
      for (const f of COMPLIANCE_FRAMEWORKS) {
        await trx.raw('INSERT INTO compliance_frameworks (id, name, version, description) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING', [f.id, f.name, f.version, f.description]);
      }
      for (const c of COMPLIANCE_CONTROLS) {
        await trx.raw('INSERT INTO compliance_controls (id, framework_id, name, description, category) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', [c.id, c.framework_id, c.name, c.description, c.category]);
      }
      for (const m of TECHNIQUE_COMPLIANCE) {
        const exists = await trx('attack_techniques').where('id', m.technique_id).first();
        if (exists) {
          await trx.raw('INSERT INTO technique_compliance (technique_id, control_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [m.technique_id, m.control_id]);
        }
      }
    });
  }

  // Tags + entity assignments (first run only)
  const { count: tagCount } = await db('tags').count('id as count').first() as any;
  if (Number(tagCount) === 0) {
    await db.transaction(async trx => {
      for (const t of DEMO_TAGS) {
        await trx.raw('INSERT INTO tags (name, color, description) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [t.name, t.color, t.description]);
      }
    });
    const detections = await db('detections').select('id').limit(8);
    const tagRows = await db('tags').select('id', 'name');
    const tagMap = Object.fromEntries(tagRows.map((t: any) => [t.name, t.id]));
    const etAssignments: Array<[number, number]> = [
      [detections[0]?.id, tagMap['high-fidelity']], [detections[0]?.id, tagMap['identity']],
      [detections[1]?.id, tagMap['critical-asset']], [detections[1]?.id, tagMap['high-fidelity']],
      [detections[2]?.id, tagMap['identity']], [detections[3]?.id, tagMap['ransomware']],
      [detections[4]?.id, tagMap['critical-asset']], [detections[7]?.id, tagMap['lateral-movement']],
      [detections[12]?.id, tagMap['exfiltration']], [detections[8]?.id, tagMap['needs-review']],
    ];
    await db.transaction(async trx => {
      for (const [eid, tid] of etAssignments) {
        if (eid && tid) {
          await trx.raw('INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', ['detection', String(eid), tid]);
        }
      }
    });
  }

  // Motivations + countries (idempotent)
  await db.transaction(async trx => {
    for (const m of SEED_MOTIVATIONS) {
      await trx.raw('INSERT INTO motivations (name, color) VALUES (?, ?) ON CONFLICT DO NOTHING', [m.name, m.color]);
    }
    for (const c of SEED_COUNTRIES) {
      await trx.raw('INSERT INTO countries (name, color, flag) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [c.name, c.color, c.flag]);
    }
  });

  // Initial coverage snapshot (first run only)
  const { count: snapCount } = await db('coverage_snapshots').count('id as count').first() as any;
  if (Number(snapCount) === 0) {
    const { count: total } = await db('attack_techniques').where('is_subtechnique', 0).count('id as count').first() as any;
    const activeDetections = await db('detections').where('status', 'active').select('technique_ids');
    const covered = new Set<string>();
    for (const d of activeDetections) {
      for (const id of JSON.parse(d.technique_ids)) covered.add(id);
    }
    const { count: activeDetCount } = await db('detections').where('status', 'active').count('id as count').first() as any;
    const { count: toolCount } = await db('tools').count('id as count').first() as any;
    const coveredCount = Math.max(0, covered.size - 8);
    const totalNum = Number(total);
    await db('coverage_snapshots').insert({
      taken_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      total_techniques: totalNum,
      covered_techniques: coveredCount,
      detected_techniques: coveredCount,
      mitigated_techniques: 12,
      gap_techniques: totalNum - coveredCount,
      coverage_pct: Math.round((coveredCount / totalNum) * 100),
      active_detections: Math.max(0, Number(activeDetCount) - 3),
      total_tools: Number(toolCount),
      notes: 'Initial baseline',
    });
  }

  // ATT&CK version info (first run only)
  const { count: versionCount } = await db('attack_version_info').count('id as count').first() as any;
  if (Number(versionCount) === 0) {
    await db('attack_version_info').insert({
      version: '14.1',
      name: 'ATT&CK v14.1',
      released_at: '2023-10-31',
      is_active: 1,
      notes: 'Enterprise ATT&CK v14.1 — 14 tactics, 193 techniques',
    });
  }

  // Data sources (idempotent)
  await db.transaction(async trx => {
    for (const ds of DATA_SOURCES) {
      await trx.raw('INSERT INTO data_sources (name, category, description) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', [ds.name, ds.category, ds.description]);
    }
  });
  // Technique → data source mappings
  const { count: tdsCount } = await db('technique_data_sources').count('technique_id as count').first() as any;
  if (Number(tdsCount) === 0) {
    const dsRows = await db('data_sources').select('id', 'name');
    const dsMap = Object.fromEntries(dsRows.map((d: any) => [d.name, d.id]));
    await db.transaction(async trx => {
      for (const { technique_id, source_name } of TECHNIQUE_DATA_SOURCES) {
        const dsId = dsMap[source_name];
        if (!dsId) continue;
        const techExists = await trx('attack_techniques').where('id', technique_id).first();
        if (!techExists) continue;
        await trx.raw('INSERT INTO technique_data_sources (technique_id, data_source_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [technique_id, dsId]);
      }
    });
  }

  // Atomic Red Team tests (idempotent via ON CONFLICT DO NOTHING on test_guid)
  await db.transaction(async trx => {
    for (const test of ART_TESTS) {
      const techExists = await trx('attack_techniques').where('id', test.technique_id).first();
      if (!techExists) continue;
      await trx.raw(
        'INSERT INTO art_tests (technique_id, test_guid, name, description, platform, executor_type, auto_generated_command) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(test_guid) DO NOTHING',
        [test.technique_id, test.test_guid, test.name, test.description ?? null, test.platform ?? null, test.executor_type ?? null, test.auto_generated_command ?? null]
      );
    }
  });
}
