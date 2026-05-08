import { Router } from 'express';
import { getKnex, rawGet, rawInsert, logAudit } from '../db/database';

const router = Router();

function parseSigmaYaml(text: string): { title?: string; id?: string; description?: string; tags?: string[]; status?: string; level?: string } {
  const result: Record<string, any> = {};
  const lines = text.split('\n');
  let inTags = false;
  const tags: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (inTags) {
      const tagMatch = line.match(/^\s+-\s+(.+)/);
      if (tagMatch) { tags.push(tagMatch[1].trim()); continue; }
      inTags = false;
    }
    if (line.match(/^tags\s*:/)) { inTags = true; continue; }
    const kv = line.match(/^(\w+)\s*:\s*(.+)/);
    if (kv) result[kv[1].toLowerCase()] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  if (tags.length) result.tags = tags;
  return result;
}

function extractTechniqueIds(tags: string[]): string[] {
  const ids = new Set<string>();
  for (const tag of tags) {
    const m = tag.match(/attack\.(t\d{4}(?:\.\d{3})?)/i);
    if (m) ids.add(m[1].toUpperCase());
  }
  return [...ids];
}

router.post('/parse', async (req, res) => {
  const { rule_text } = req.body;
  if (!rule_text) return res.status(400).json({ error: 'rule_text is required' });
  const parsed = parseSigmaYaml(rule_text);
  const technique_ids = extractTechniqueIds(parsed.tags ?? []);
  const db = getKnex();
  const knownTechniques: string[] = [];
  for (const id of technique_ids) {
    if (await rawGet(db, 'SELECT 1 FROM attack_techniques WHERE id=?', [id])) knownTechniques.push(id);
  }
  res.json({
    title: parsed.title, rule_id: parsed.id, description: parsed.description,
    status: parsed.status ?? 'active', severity: parsed.level ?? 'medium',
    technique_ids: knownTechniques,
    unknown_technique_ids: technique_ids.filter(id => !knownTechniques.includes(id)),
    raw_tags: parsed.tags ?? [],
  });
});

router.post('/import', async (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules) || rules.length === 0) {
    return res.status(400).json({ error: 'rules array is required' });
  }
  const db = getKnex();
  const imported: number[] = [];
  const skipped: string[] = [];
  const levelMap: Record<string, string> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', informational: 'low' };

  await db.transaction(async trx => {
    for (const rule_text of rules) {
      const parsed = parseSigmaYaml(rule_text);
      if (!parsed.title) { skipped.push('(no title)'); continue; }
      const allIds = extractTechniqueIds(parsed.tags ?? []);
      const technique_ids: string[] = [];
      for (const id of allIds) {
        if (await rawGet(trx, 'SELECT 1 FROM attack_techniques WHERE id=?', [id])) technique_ids.push(id);
      }
      const id = await rawInsert(trx, `
        INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
      `, [parsed.title, parsed.description ?? null, parsed.id ?? null, 'sigma',
        JSON.stringify(technique_ids),
        parsed.status === 'stable' ? 'active' : (parsed.status ?? 'active'),
        levelMap[parsed.level ?? ''] ?? 'medium', 'medium',
        `Imported from SIGMA rule${parsed.id ? ` ${parsed.id}` : ''}`]);
      await logAudit(trx, 'detection', String(id), 'imported', 'system', { source: 'sigma', title: parsed.title });
      imported.push(id);
    }
  });
  res.json({ imported: imported.length, skipped: skipped.length, detection_ids: imported });
});

export default router;
