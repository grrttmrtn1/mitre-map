import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, rawInsert } from '../db/database';

const router = Router();

const VALID_TYPES = ['ip', 'domain', 'hash', 'url', 'email'] as const;

router.get('/export/stix', async (req, res) => {
  try {
    const db = getKnex();
    const { group_id } = req.query;
    const indicators = await rawAll(db,
      group_id
        ? 'SELECT * FROM indicators WHERE group_id = ? ORDER BY created_at DESC'
        : 'SELECT * FROM indicators ORDER BY created_at DESC LIMIT 500',
      group_id ? [group_id] : []
    );
    const stixObjects = (indicators as any[]).map(ioc => ({
      type: 'indicator',
      spec_version: '2.1',
      id: `indicator--${Buffer.from(String(ioc.id)).toString('hex').padStart(36, '0').slice(0, 36)}`,
      created: new Date(ioc.created_at).toISOString(),
      modified: new Date(ioc.created_at).toISOString(),
      name: `${ioc.type}:${ioc.value}`,
      indicator_types: [ioc.type === 'hash' ? 'compromised' : 'malicious-activity'],
      pattern: ioc.type === 'ip' ? `[ipv4-addr:value = '${ioc.value}']`
        : ioc.type === 'domain' ? `[domain-name:value = '${ioc.value}']`
        : ioc.type === 'hash' ? `[file:hashes.'SHA-256' = '${ioc.value}']`
        : ioc.type === 'url' ? `[url:value = '${ioc.value}']`
        : `[email-message:from_ref.value = '${ioc.value}']`,
      pattern_type: 'stix',
      valid_from: ioc.first_seen ?? new Date(ioc.created_at).toISOString(),
      confidence: ioc.confidence === 'high' ? 85 : ioc.confidence === 'low' ? 30 : 60,
    }));
    const bundle = { type: 'bundle', id: 'bundle--mitremap-ioc-export', spec_version: '2.1', objects: stixObjects };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="mitremap-iocs.stix.json"');
    res.json(bundle);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const db = getKnex();
    const { group_id, technique_id } = req.query;
    let sql = 'SELECT * FROM indicators WHERE 1=1';
    const params: any[] = [];
    if (group_id) { sql += ' AND group_id = ?'; params.push(group_id); }
    if (technique_id) { sql += ' AND technique_id = ?'; params.push(technique_id); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    res.json(await rawAll(db, sql, params));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = getKnex();
    const { type, value, group_id, technique_id, confidence = 'medium', notes, first_seen, last_seen } = req.body;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    if (!value?.trim()) return res.status(400).json({ error: 'value is required' });
    const id = await rawInsert(db,
      'INSERT INTO indicators (type, value, group_id, technique_id, confidence, notes, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [type, value.trim(), group_id ?? null, technique_id ?? null, confidence, notes ?? null, first_seen ?? null, last_seen ?? null]
    );
    res.status(201).json(await rawGet(db, 'SELECT * FROM indicators WHERE id = ?', [id]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!await rawGet(db, 'SELECT id FROM indicators WHERE id = ?', [id]))
      return res.status(404).json({ error: 'Not found' });
    const { type, value, group_id, technique_id, confidence, notes, first_seen, last_seen } = req.body;
    await rawRun(db,
      `UPDATE indicators SET type=COALESCE(?,type), value=COALESCE(?,value), group_id=COALESCE(?,group_id),
       technique_id=COALESCE(?,technique_id), confidence=COALESCE(?,confidence), notes=COALESCE(?,notes),
       first_seen=COALESCE(?,first_seen), last_seen=COALESCE(?,last_seen) WHERE id=?`,
      [type ?? null, value ?? null, group_id ?? null, technique_id ?? null, confidence ?? null,
       notes ?? null, first_seen ?? null, last_seen ?? null, id]
    );
    res.json(await rawGet(db, 'SELECT * FROM indicators WHERE id = ?', [id]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const db = getKnex();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    await rawRun(db, 'DELETE FROM indicators WHERE id = ?', [id]);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
