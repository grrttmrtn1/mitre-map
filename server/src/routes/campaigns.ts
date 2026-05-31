import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert, logAudit } from '../db/database';

const router = Router();

router.get('/', async (req, res) => {
  const db = getKnex();
  const { group_id } = req.query;
  if (!group_id) return res.status(400).json({ error: 'group_id required' });
  const campaigns = await rawAll(db,
    "SELECT * FROM group_campaigns WHERE group_id = ? ORDER BY start_date DESC NULLS LAST",
    [group_id]
  );
  for (const c of campaigns as any[]) {
    const techs = await rawAll(db, 'SELECT technique_id FROM campaign_techniques WHERE campaign_id = ?', [c.id]);
    c.technique_ids = techs.map((t: any) => t.technique_id);
  }
  res.json(campaigns);
});

router.post('/', async (req, res) => {
  try {
    const db = getKnex();
    const { group_id, name, description, start_date, end_date, source_url, technique_ids = [] } = req.body;
    if (!group_id || !name?.trim()) return res.status(400).json({ error: 'group_id and name required' });
    const group = await rawGet(db, 'SELECT id FROM threat_groups WHERE id = ?', [group_id]);
    if (!group) return res.status(404).json({ error: 'Threat group not found' });
    const id = await rawInsert(db,
      'INSERT INTO group_campaigns (group_id, name, description, start_date, end_date, source_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [group_id, name.trim(), description ?? null, start_date ?? null, end_date ?? null, source_url ?? null]
    );
    for (const tid of technique_ids) {
      await rawRun(db, 'INSERT OR IGNORE INTO campaign_techniques (campaign_id, technique_id) VALUES (?, ?)', [id, tid]);
    }
    await logAudit(db, 'campaign', String(id), 'create', (req as any).actor ?? 'user', { group_id, name });
    const campaign = await rawGet(db, 'SELECT * FROM group_campaigns WHERE id = ?', [id]);
    (campaign as any).technique_ids = technique_ids;
    res.status(201).json(campaign);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const existing = await rawGet(db, 'SELECT id FROM group_campaigns WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name, description, start_date, end_date, source_url, technique_ids } = req.body;
    await rawRun(db,
      `UPDATE group_campaigns SET
        name=COALESCE(?,name), description=COALESCE(?,description),
        start_date=COALESCE(?,start_date), end_date=COALESCE(?,end_date),
        source_url=COALESCE(?,source_url), updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [name ?? null, description ?? null, start_date ?? null, end_date ?? null, source_url ?? null, id]
    );
    if (Array.isArray(technique_ids)) {
      await rawRun(db, 'DELETE FROM campaign_techniques WHERE campaign_id = ?', [id]);
      for (const tid of technique_ids) {
        await rawRun(db, 'INSERT OR IGNORE INTO campaign_techniques (campaign_id, technique_id) VALUES (?, ?)', [id, tid]);
      }
    }
    const updated = await rawGet(db, 'SELECT * FROM group_campaigns WHERE id = ?', [id]);
    const techs = await rawAll(db, 'SELECT technique_id FROM campaign_techniques WHERE campaign_id = ?', [id]);
    (updated as any).technique_ids = techs.map((t: any) => t.technique_id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!await rawGet(db, 'SELECT id FROM group_campaigns WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Not found' });
    await rawRun(db, 'DELETE FROM group_campaigns WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
