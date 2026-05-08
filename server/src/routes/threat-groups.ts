import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getKnex();
  const groups = await rawAll(db, 'SELECT * FROM threat_groups ORDER BY name');
  res.json(groups.map((g: any) => ({ ...g, aliases: JSON.parse(g.aliases) })));
});

router.post('/', async (req, res) => {
  const db = getKnex();
  const { id, name, aliases = [], description, country, motivation, url, technique_ids = [] } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
  if (await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [id])) {
    return res.status(409).json({ error: 'Threat group with this ID already exists' });
  }
  await db.transaction(async trx => {
    await rawRun(trx, 'INSERT INTO threat_groups (id, name, aliases, description, country, motivation, url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, JSON.stringify(aliases), description ?? null, country ?? null, motivation ?? null, url ?? null]);
    for (const tid of technique_ids) {
      await rawRun(trx, 'INSERT INTO group_techniques (group_id, technique_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [id, tid]);
    }
    await logAudit(trx, 'threat_group', id, 'create', (req as any).actor ?? 'user', { name, country, motivation }, (req as any).sourceIp);
  });
  const group = await rawGet<any>(db, 'SELECT * FROM threat_groups WHERE id=?', [id]);
  res.status(201).json({ ...group, aliases: JSON.parse(group.aliases) });
});

router.get('/:id', async (req, res) => {
  const db = getKnex();
  const group = await rawGet<any>(db, 'SELECT * FROM threat_groups WHERE id=?', [req.params.id]);
  if (!group) return res.status(404).json({ error: 'Not found' });

  const techniques = await rawAll<any>(db, `
    SELECT t.* FROM attack_techniques t JOIN group_techniques gt ON t.id=gt.technique_id
    WHERE gt.group_id=? ORDER BY t.id
  `, [req.params.id]);

  const detectionCoverage = await Promise.all(techniques.map(async (t: any) => {
    const { c } = await rawGet<{ c: number }>(db,
      "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?", [`%"${t.id}"%`]) as any;
    return { technique_id: t.id, technique_name: t.name, detected: c > 0 };
  }));
  const coveredCount = detectionCoverage.filter(t => t.detected).length;

  res.json({
    ...group, aliases: JSON.parse(group.aliases),
    techniques: techniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    coverage: { total: techniques.length, covered: coveredCount, pct: techniques.length ? Math.round((coveredCount / techniques.length) * 100) : 0, details: detectionCoverage },
  });
});

router.put('/:id', async (req, res) => {
  const db = getKnex();
  const group = await rawGet<any>(db, 'SELECT * FROM threat_groups WHERE id=?', [req.params.id]);
  if (!group) return res.status(404).json({ error: 'Not found' });
  const { name, aliases, description, country, motivation, url, technique_ids } = req.body;
  await db.transaction(async trx => {
    await rawRun(trx, `UPDATE threat_groups SET
      name=COALESCE(?,name), aliases=COALESCE(?,aliases), description=?, country=?, motivation=?, url=? WHERE id=?`,
      [name ?? null, aliases !== undefined ? JSON.stringify(aliases) : null,
        description !== undefined ? description : group.description,
        country !== undefined ? country : group.country,
        motivation !== undefined ? motivation : group.motivation,
        url !== undefined ? url : group.url, req.params.id]);
    if (Array.isArray(technique_ids)) {
      await rawRun(trx, 'DELETE FROM group_techniques WHERE group_id=?', [req.params.id]);
      for (const tid of technique_ids) {
        await rawRun(trx, 'INSERT INTO group_techniques (group_id, technique_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.params.id, tid]);
      }
    }
    await logAudit(trx, 'threat_group', req.params.id, 'update', (req as any).actor ?? 'user', req.body, (req as any).sourceIp);
  });
  const updated = await rawGet<any>(db, 'SELECT * FROM threat_groups WHERE id=?', [req.params.id]);
  res.json({ ...updated, aliases: JSON.parse(updated.aliases) });
});

router.delete('/:id', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  await db.transaction(async trx => {
    await rawRun(trx, 'DELETE FROM group_techniques WHERE group_id=?', [req.params.id]);
    await rawRun(trx, 'DELETE FROM threat_groups WHERE id=?', [req.params.id]);
    await logAudit(trx, 'threat_group', req.params.id, 'delete', (req as any).actor ?? 'user', undefined, (req as any).sourceIp);
  });
  res.status(204).end();
});

router.post('/:id/techniques', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { technique_ids = [] } = req.body;
  for (const tid of technique_ids) await rawRun(db, 'INSERT INTO group_techniques (group_id, technique_id) VALUES (?, ?) ON CONFLICT DO NOTHING', [req.params.id, tid]);
  const { c } = await rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM group_techniques WHERE group_id=?', [req.params.id]) as any;
  res.json({ group_id: req.params.id, total_techniques: c });
});

router.delete('/:id/techniques', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const { technique_ids = [] } = req.body;
  if (technique_ids.length === 0) {
    await rawRun(db, 'DELETE FROM group_techniques WHERE group_id=?', [req.params.id]);
  } else {
    for (const tid of technique_ids) await rawRun(db, 'DELETE FROM group_techniques WHERE group_id=? AND technique_id=?', [req.params.id, tid]);
  }
  res.status(204).end();
});

router.get('/:id/procedures', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  res.json(await rawAll(db, 'SELECT * FROM group_technique_procedures WHERE group_id=? ORDER BY technique_id, created_at', [req.params.id]));
});

router.post('/:id/techniques/:technique_id/procedures', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Group not found' });
  const { type = 'command', content, source } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  const id = await rawInsert(db, `
    INSERT INTO group_technique_procedures (group_id, technique_id, type, content, source) VALUES (?, ?, ?, ?, ?) RETURNING id
  `, [req.params.id, req.params.technique_id, type, content.trim(), source?.trim() ?? null]);
  res.status(201).json(await rawGet(db, 'SELECT * FROM group_technique_procedures WHERE id=?', [id]));
});

router.put('/:id/procedures/:proc_id', async (req, res) => {
  const db = getKnex();
  const proc = await rawGet<any>(db, 'SELECT * FROM group_technique_procedures WHERE id=? AND group_id=?', [req.params.proc_id, req.params.id]);
  if (!proc) return res.status(404).json({ error: 'Procedure not found' });
  const { type, content, source } = req.body;
  if (content !== undefined && !content?.trim()) return res.status(400).json({ error: 'content cannot be empty' });
  await rawRun(db, `UPDATE group_technique_procedures SET
    type=COALESCE(?,type), content=COALESCE(?,content), source=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [type ?? null, content?.trim() ?? null, source !== undefined ? (source?.trim() || null) : proc.source, req.params.proc_id]);
  res.json(await rawGet(db, 'SELECT * FROM group_technique_procedures WHERE id=?', [req.params.proc_id]));
});

router.delete('/:id/procedures/:proc_id', async (req, res) => {
  const db = getKnex();
  const proc = await rawGet(db, 'SELECT id FROM group_technique_procedures WHERE id=? AND group_id=?', [req.params.proc_id, req.params.id]);
  if (!proc) return res.status(404).json({ error: 'Procedure not found' });
  await rawRun(db, 'DELETE FROM group_technique_procedures WHERE id=?', [req.params.proc_id]);
  res.status(204).end();
});

router.get('/:id/exposure', async (req, res) => {
  const db = getKnex();
  if (!await rawGet(db, 'SELECT id FROM threat_groups WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  const techniques = await rawAll<any>(db, `
    SELECT t.id, t.name, t.tactic_ids FROM attack_techniques t
    JOIN group_techniques gt ON t.id=gt.technique_id WHERE gt.group_id=?
  `, [req.params.id]);
  const result = await Promise.all(techniques.map(async (t: any) => {
    const [{ c: dCount }, { c: mCount }] = await Promise.all([
      rawGet<{ c: number }>(db, "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?", [`%"${t.id}"%`]),
      rawGet<{ c: number }>(db, `SELECT COUNT(*) as c FROM technique_mitigations tm JOIN tool_mitigations tlm ON tm.mitigation_id=tlm.mitigation_id JOIN tools tl ON tlm.tool_id=tl.id WHERE tm.technique_id=? AND tl.status='active'`, [t.id]),
    ]) as any[];
    return { ...t, tactic_ids: JSON.parse(t.tactic_ids), detected: dCount > 0, mitigated: mCount > 0, exposed: dCount === 0 && mCount === 0 };
  }));
  res.json({ group_id: req.params.id, techniques: result, exposed_count: result.filter(t => t.exposed).length, total: result.length });
});

export default router;
