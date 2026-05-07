import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM threat_groups ORDER BY name').all() as any[];
  res.json(groups.map(g => ({ ...g, aliases: JSON.parse(g.aliases) })));
});

router.post('/', (req, res) => {
  const db = getDb();
  const { id, name, aliases = [], description, country, motivation, url, technique_ids = [] } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
  if (db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(id)) {
    return res.status(409).json({ error: 'Threat group with this ID already exists' });
  }
  const insert = db.transaction(() => {
    db.prepare(
      'INSERT INTO threat_groups (id, name, aliases, description, country, motivation, url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, JSON.stringify(aliases), description ?? null, country ?? null, motivation ?? null, url ?? null);

    const insertTech = db.prepare(
      'INSERT OR IGNORE INTO group_techniques (group_id, technique_id) VALUES (?, ?)'
    );
    for (const tid of technique_ids) insertTech.run(id, tid);
    logAudit(db, 'threat_group', id, 'create', (req as any).actor ?? 'user', { name, country, motivation }, (req as any).sourceIp);
  });
  insert();
  const group = db.prepare('SELECT * FROM threat_groups WHERE id = ?').get(id) as any;
  res.status(201).json({ ...group, aliases: JSON.parse(group.aliases) });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT * FROM threat_groups WHERE id = ?').get(req.params.id) as any;
  if (!group) return res.status(404).json({ error: 'Not found' });

  const techniques = db.prepare(`
    SELECT t.* FROM attack_techniques t
    JOIN group_techniques gt ON t.id = gt.technique_id
    WHERE gt.group_id = ?
    ORDER BY t.id
  `).all(req.params.id) as any[];

  const detectionCoverage = techniques.map(t => {
    const detected = (db.prepare(
      "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?"
    ).get(`%"${t.id}"%`) as any).c > 0;
    return { technique_id: t.id, technique_name: t.name, detected };
  });

  const coveredCount = detectionCoverage.filter(t => t.detected).length;

  res.json({
    ...group,
    aliases: JSON.parse(group.aliases),
    techniques: techniques.map(t => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    coverage: {
      total: techniques.length,
      covered: coveredCount,
      pct: techniques.length ? Math.round((coveredCount / techniques.length) * 100) : 0,
      details: detectionCoverage,
    },
  });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const group = db.prepare('SELECT * FROM threat_groups WHERE id = ?').get(req.params.id) as any;
  if (!group) return res.status(404).json({ error: 'Not found' });

  const { name, aliases, description, country, motivation, url, technique_ids } = req.body;
  const update = db.transaction(() => {
    db.prepare(`
      UPDATE threat_groups SET
        name = COALESCE(?, name),
        aliases = COALESCE(?, aliases),
        description = ?,
        country = ?,
        motivation = ?,
        url = ?
      WHERE id = ?
    `).run(
      name ?? null,
      aliases !== undefined ? JSON.stringify(aliases) : null,
      description !== undefined ? description : group.description,
      country !== undefined ? country : group.country,
      motivation !== undefined ? motivation : group.motivation,
      url !== undefined ? url : group.url,
      req.params.id,
    );

    if (Array.isArray(technique_ids)) {
      db.prepare('DELETE FROM group_techniques WHERE group_id = ?').run(req.params.id);
      const insertTech = db.prepare(
        'INSERT OR IGNORE INTO group_techniques (group_id, technique_id) VALUES (?, ?)'
      );
      for (const tid of technique_ids) insertTech.run(req.params.id, tid);
    }
    logAudit(db, 'threat_group', req.params.id, 'update', (req as any).actor ?? 'user', req.body, (req as any).sourceIp);
  });
  update();
  const updated = db.prepare('SELECT * FROM threat_groups WHERE id = ?').get(req.params.id) as any;
  res.json({ ...updated, aliases: JSON.parse(updated.aliases) });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  db.transaction(() => {
    db.prepare('DELETE FROM group_techniques WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM threat_groups WHERE id = ?').run(req.params.id);
    logAudit(db, 'threat_group', req.params.id, 'delete', (req as any).actor ?? 'user', undefined, (req as any).sourceIp);
  })();
  res.status(204).end();
});

router.post('/:id/techniques', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { technique_ids = [] } = req.body;
  const insert = db.prepare('INSERT OR IGNORE INTO group_techniques (group_id, technique_id) VALUES (?, ?)');
  for (const tid of technique_ids) insert.run(req.params.id, tid);
  const count = (db.prepare('SELECT COUNT(*) as c FROM group_techniques WHERE group_id = ?').get(req.params.id) as any).c;
  res.json({ group_id: req.params.id, total_techniques: count });
});

router.delete('/:id/techniques', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { technique_ids = [] } = req.body;
  if (technique_ids.length === 0) {
    db.prepare('DELETE FROM group_techniques WHERE group_id = ?').run(req.params.id);
  } else {
    const del = db.prepare('DELETE FROM group_techniques WHERE group_id = ? AND technique_id = ?');
    for (const tid of technique_ids) del.run(req.params.id, tid);
  }
  res.status(204).end();
});

router.get('/:id/procedures', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const procs = db.prepare(
    'SELECT * FROM group_technique_procedures WHERE group_id = ? ORDER BY technique_id, created_at'
  ).all(req.params.id);
  res.json(procs);
});

router.post('/:id/techniques/:technique_id/procedures', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Group not found' });
  }
  const { type = 'command', content, source } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  const result = db.prepare(
    'INSERT INTO group_technique_procedures (group_id, technique_id, type, content, source) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, req.params.technique_id, type, content.trim(), source?.trim() ?? null);
  const proc = db.prepare('SELECT * FROM group_technique_procedures WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(proc);
});

router.put('/:id/procedures/:proc_id', (req, res) => {
  const db = getDb();
  const proc = db.prepare(
    'SELECT * FROM group_technique_procedures WHERE id = ? AND group_id = ?'
  ).get(req.params.proc_id, req.params.id) as any;
  if (!proc) return res.status(404).json({ error: 'Procedure not found' });
  const { type, content, source } = req.body;
  if (content !== undefined && !content?.trim()) return res.status(400).json({ error: 'content cannot be empty' });
  db.prepare(`
    UPDATE group_technique_procedures SET
      type = COALESCE(?, type),
      content = COALESCE(?, content),
      source = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(type ?? null, content?.trim() ?? null, source !== undefined ? (source?.trim() || null) : proc.source, req.params.proc_id);
  const updated = db.prepare('SELECT * FROM group_technique_procedures WHERE id = ?').get(req.params.proc_id);
  res.json(updated);
});

router.delete('/:id/procedures/:proc_id', (req, res) => {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM group_technique_procedures WHERE id = ? AND group_id = ?'
  ).run(req.params.proc_id, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Procedure not found' });
  res.status(204).end();
});

router.get('/:id/exposure', (req, res) => {
  const db = getDb();
  if (!db.prepare('SELECT id FROM threat_groups WHERE id = ?').get(req.params.id)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const techniques = db.prepare(`
    SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t
    JOIN group_techniques gt ON t.id = gt.technique_id
    WHERE gt.group_id = ?
  `).all(req.params.id) as any[];

  const result = techniques.map(t => {
    const detected = (db.prepare(
      "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?"
    ).get(`%"${t.id}"%`) as any).c > 0;
    const mitigated = (db.prepare(`
      SELECT COUNT(*) as c FROM technique_mitigations tm
      JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
      JOIN tools tl ON tlm.tool_id = tl.id
      WHERE tm.technique_id = ? AND tl.status = 'active'
    `).get(t.id) as any).c > 0;
    return { ...t, tactic_ids: JSON.parse(t.tactic_ids), detected, mitigated, exposed: !detected && !mitigated };
  });

  const exposed = result.filter(t => t.exposed).length;
  res.json({ group_id: req.params.id, techniques: result, exposed_count: exposed, total: result.length });
});

export default router;
