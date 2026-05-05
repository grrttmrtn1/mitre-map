import { Router } from 'express';
import { getDb, logAudit } from '../db/database';

const router = Router();

// Minimal SIGMA-like YAML parser (no external dep needed for key fields)
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
    // attack.t1234 or attack.t1234.001
    const m = tag.match(/attack\.(t\d{4}(?:\.\d{3})?)/i);
    if (m) ids.add(m[1].toUpperCase());
  }
  return [...ids];
}

// POST /api/sigma/parse — parse a SIGMA rule text and return structured preview
router.post('/parse', (req, res) => {
  const { rule_text } = req.body;
  if (!rule_text) return res.status(400).json({ error: 'rule_text is required' });

  const parsed = parseSigmaYaml(rule_text);
  const technique_ids = extractTechniqueIds(parsed.tags ?? []);

  const db = getDb();
  const knownTechniques = technique_ids.filter(id =>
    db.prepare('SELECT 1 FROM attack_techniques WHERE id = ?').get(id)
  );
  const unknownTechniques = technique_ids.filter(id => !knownTechniques.includes(id));

  res.json({
    title: parsed.title,
    rule_id: parsed.id,
    description: parsed.description,
    status: parsed.status ?? 'active',
    severity: parsed.level ?? 'medium',
    technique_ids: knownTechniques,
    unknown_technique_ids: unknownTechniques,
    raw_tags: parsed.tags ?? [],
  });
});

// POST /api/sigma/import — import one or more SIGMA rule texts as detections
router.post('/import', (req, res) => {
  const { rules } = req.body; // array of rule_text strings
  if (!Array.isArray(rules) || rules.length === 0) {
    return res.status(400).json({ error: 'rules array is required' });
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const imported: number[] = [];
  const skipped: string[] = [];

  const doImport = db.transaction(() => {
    for (const rule_text of rules) {
      const parsed = parseSigmaYaml(rule_text);
      if (!parsed.title) { skipped.push('(no title)'); continue; }
      const technique_ids = extractTechniqueIds(parsed.tags ?? []).filter(id =>
        db.prepare('SELECT 1 FROM attack_techniques WHERE id = ?').get(id)
      );
      const levelMap: Record<string, string> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', informational: 'low' };
      const result = insert.run(
        parsed.title, parsed.description ?? null, parsed.id ?? null, 'sigma',
        JSON.stringify(technique_ids),
        parsed.status === 'stable' ? 'active' : (parsed.status ?? 'active'),
        levelMap[parsed.level ?? ''] ?? 'medium',
        'medium', `Imported from SIGMA rule${parsed.id ? ` ${parsed.id}` : ''}`
      );
      logAudit(db, 'detection', String(result.lastInsertRowid), 'imported', 'system', { source: 'sigma', title: parsed.title });
      imported.push(Number(result.lastInsertRowid));
    }
  });
  doImport();

  res.json({ imported: imported.length, skipped: skipped.length, detection_ids: imported });
});

export default router;
