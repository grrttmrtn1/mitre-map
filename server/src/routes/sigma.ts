import { Router } from 'express';
import { getKnex, rawGet, rawAll, rawInsert, logAudit } from '../db/database';

const router = Router();

// ── YAML parsing ──────────────────────────────────────────────────────────────

interface ParsedSigma {
  title?: string; id?: string; status?: string; level?: string;
  author?: string; date?: string; description?: string;
  tags?: string[]; references?: string[]; falsepositives?: string[];
  logsource?: Record<string, string>; detection_raw?: string;
}

function parseSigmaYaml(text: string): ParsedSigma {
  const lines = text.split('\n');
  const result: Record<string, any> = {};
  let i = 0;

  const isIndented = (l: string) => /^\s/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    const topMatch = trimmed.match(/^(\w+)\s*:\s*(.*)/);
    if (!topMatch) { i++; continue; }

    const [, rawKey, rest] = topMatch;
    const key = rawKey.toLowerCase();
    const v = rest.trim();

    if (['title', 'id', 'status', 'level', 'author', 'date'].includes(key)) {
      result[key] = v.replace(/^['"]|['"]$/g, '');
      i++; continue;
    }

    if (key === 'description') {
      if (v === '|' || v === '>') {
        const parts: string[] = []; i++;
        while (i < lines.length) {
          const dl = lines[i];
          if (dl.trim() && !isIndented(dl)) break;
          parts.push(dl.replace(/^    |^  /, '')); i++;
        }
        result[key] = parts.join('\n').trim();
      } else {
        result[key] = v.replace(/^['"]|['"]$/g, ''); i++;
      }
      continue;
    }

    if (['tags', 'references', 'falsepositives'].includes(key)) {
      const items: string[] = []; i++;
      while (i < lines.length) {
        const li = lines[i];
        if (!li.trim()) { i++; continue; }
        if (li.trim() && !isIndented(li)) break;
        const m = li.match(/^\s+-\s+(.*)/);
        if (m) items.push(m[1].trim().replace(/^['"]|['"]$/g, ''));
        i++;
      }
      result[key] = items; continue;
    }

    if (key === 'logsource') {
      const block: Record<string, string> = {}; i++;
      while (i < lines.length) {
        const bl = lines[i];
        if (!bl.trim()) { i++; continue; }
        if (!isIndented(bl)) break;
        const m = bl.match(/^\s+(\w+)\s*:\s*(.*)/);
        if (m) block[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
        i++;
      }
      result[key] = block; continue;
    }

    if (key === 'detection') {
      const parts: string[] = []; i++;
      while (i < lines.length) {
        const dl = lines[i];
        if (dl.trim() && !isIndented(dl)) break;
        parts.push(dl); i++;
      }
      result['detection_raw'] = parts.join('\n').trimEnd(); continue;
    }

    i++;
  }

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

// ── Template generation ───────────────────────────────────────────────────────

const DS_LOGSOURCE: Array<{ keywords: string[]; category: string; product?: string }> = [
  { keywords: ['process', 'command', 'execution'], category: 'process_creation', product: 'windows' },
  { keywords: ['script', 'powershell'], category: 'ps_script', product: 'windows' },
  { keywords: ['registry'], category: 'registry_event', product: 'windows' },
  { keywords: ['module', 'library', 'dll'], category: 'image_load', product: 'windows' },
  { keywords: ['wmi'], category: 'wmi_event', product: 'windows' },
  { keywords: ['network', 'dns', 'http', 'smtp', 'traffic'], category: 'network_connection' },
  { keywords: ['file'], category: 'file_event' },
  { keywords: ['logon', 'login', 'authentication', 'credential', 'user'], category: 'authentication' },
  { keywords: ['web', 'proxy'], category: 'webserver' },
];

const TACTIC_LEVEL: Record<string, string> = {
  'TA0001': 'high', 'TA0002': 'high', 'TA0004': 'high',
  'TA0006': 'high', 'TA0008': 'high', 'TA0010': 'high',
  'TA0040': 'critical', 'TA0042': 'high', 'TA0003': 'medium',
  'TA0005': 'medium', 'TA0009': 'medium', 'TA0011': 'medium',
  'TA0007': 'low', 'TA0043': 'low',
};

function deriveLogsource(dsNames: string[]): { category: string; product?: string } {
  const text = dsNames.join(' ').toLowerCase();
  for (const e of DS_LOGSOURCE) {
    if (e.keywords.some(k => text.includes(k))) return { category: e.category, product: e.product };
  }
  return { category: 'process_creation', product: 'windows' };
}

function buildTemplateYaml(
  tech: { id: string; name: string },
  tacticNames: string[],
  tacticIds: string[],
  logsource: { category: string; product?: string },
  level: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const techniqueTag = `    - attack.${tech.id.toLowerCase()}`;
  const tacticTags = tacticNames.map(t => `    - attack.${t.toLowerCase().replace(/\s+/g, '_')}`).join('\n');
  const logsourceYaml = [
    `    category: ${logsource.category}`,
    logsource.product ? `    product: ${logsource.product}` : '',
  ].filter(Boolean).join('\n');

  return `title: Detect ${tech.name} (${tech.id})
id: template-${tech.id.toLowerCase()}
status: experimental
description: |
    Starter template for detecting ${tech.name} (${tech.id}).
    Customize the detection logic for your environment before activating.
references:
    - https://attack.mitre.org/techniques/${tech.id}/
author: MitreMap Templates
date: ${today}
tags:
${techniqueTag}
${tacticTags}
logsource:
${logsourceYaml}
detection:
    selection:
        # TODO: Add detection conditions specific to your environment
        # Example: CommandLine|contains: 'suspicious_string'
        # Example: Image|endswith: '\\malware.exe'
    condition: selection
falsepositives:
    - Legitimate administrative activity
    - Review and document known-good exceptions for your environment
level: ${level}
`.trimEnd();
}

// ── GitHub search cache ───────────────────────────────────────────────────────

const _cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 20 * 60 * 1000;

function cacheGet(key: string) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key: string, data: any) { _cache.set(key, { data, ts: Date.now() }); }

// ── Routes ────────────────────────────────────────────────────────────────────

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
  const { rules, source, default_status } = req.body;
  if (!Array.isArray(rules) || rules.length === 0) {
    return res.status(400).json({ error: 'rules array is required' });
  }
  const db = getKnex();
  const imported: number[] = [];
  const skipped: string[] = [];
  const levelMap: Record<string, string> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', informational: 'low' };
  const detectionSource = source ?? 'sigma';

  await db.transaction(async trx => {
    for (const rule_text of rules) {
      const parsed = parseSigmaYaml(rule_text);
      if (!parsed.title) { skipped.push('(no title)'); continue; }
      const allIds = extractTechniqueIds(parsed.tags ?? []);
      const technique_ids: string[] = [];
      for (const id of allIds) {
        if (await rawGet(trx, 'SELECT 1 FROM attack_techniques WHERE id=?', [id])) technique_ids.push(id);
      }
      const sigmaStatus = parsed.status;
      let status: string;
      if (default_status) {
        status = default_status;
      } else if (sigmaStatus === 'stable') {
        status = 'active';
      } else if (sigmaStatus === 'deprecated') {
        status = 'disabled';
      } else {
        status = 'active';
      }
      const id = await rawInsert(trx, `
        INSERT INTO detections (name, description, rule_id, source, technique_ids, status, severity, confidence, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
      `, [parsed.title, parsed.description ?? null, parsed.id ?? null, detectionSource,
        JSON.stringify(technique_ids), status,
        levelMap[parsed.level ?? ''] ?? 'medium', 'medium',
        `Imported from ${detectionSource === 'template' ? 'MitreMap detection template' : `SIGMA rule${parsed.id ? ` ${parsed.id}` : ''}`}`]);
      await logAudit(trx, 'detection', String(id), 'imported', 'system', { source: detectionSource, title: parsed.title });
      imported.push(id);
    }
  });
  res.json({ imported: imported.length, skipped: skipped.length, detection_ids: imported });
});

async function getGithubToken(): Promise<string | null> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const db = getKnex();
    const row = await rawGet<{ value: string }>(db, "SELECT value FROM settings WHERE key='github_token'");
    return row?.value ?? null;
  } catch { return null; }
}

router.get('/library', async (req, res) => {
  const technique = (req.query.technique as string)?.trim()?.toUpperCase();
  if (!technique || !technique.match(/^T\d{4}(\.\d{3})?$/)) {
    return res.status(400).json({ error: 'technique must be a valid ATT&CK ID like T1059 or T1059.001' });
  }

  const cacheKey = `library:${technique}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const token = await getGithubToken();
  if (!token) {
    return res.status(401).json({
      error: 'GitHub token required. Configure a Personal Access Token in Settings → Integrations.',
      needs_token: true,
    });
  }

  const tag = `attack.${technique.toLowerCase()}`;
  const headers: Record<string, string> = {
    'User-Agent': 'mitremap/1.0',
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(`${tag} repo:SigmaHQ/sigma extension:yml in:file`)}&per_page=50&sort=indexed`;
    const ghRes = await fetch(searchUrl, { headers });

    if (ghRes.status === 403) {
      const retryAfter = ghRes.headers.get('Retry-After');
      return res.status(429).json({
        error: 'GitHub API rate limit exceeded. Wait a minute and try again.',
        retry_after: retryAfter ? parseInt(retryAfter) : 60,
        rate_limited: true,
      });
    }
    if (!ghRes.ok) {
      return res.status(502).json({ error: `GitHub API returned ${ghRes.status}` });
    }

    const data = await ghRes.json();
    const remaining = ghRes.headers.get('X-RateLimit-Remaining');

    const result = {
      total_count: data.total_count ?? 0,
      rate_limit_remaining: remaining ? parseInt(remaining) : null,
      items: (data.items ?? []).map((item: any) => ({
        name: item.name.replace(/\.yml$/i, ''),
        path: item.path,
        category: item.path.split('/').slice(1, 3).join('/'),
        raw_url: `https://raw.githubusercontent.com/SigmaHQ/sigma/master/${item.path}`,
        html_url: item.html_url,
      })),
    };

    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: `Network error: ${err.message}` });
  }
});

router.get('/library/rule', async (req, res) => {
  const rawUrl = req.query.raw_url as string;
  if (!rawUrl || !rawUrl.startsWith('https://raw.githubusercontent.com/SigmaHQ/sigma/')) {
    return res.status(400).json({ error: 'Invalid raw_url' });
  }

  const cached = cacheGet(`rule:${rawUrl}`);
  if (cached) return res.json(cached);

  try {
    const r = await fetch(rawUrl, { headers: { 'User-Agent': 'mitremap/1.0' } });
    if (!r.ok) return res.status(502).json({ error: 'Failed to fetch rule from GitHub' });
    const text = await r.text();
    const parsed = parseSigmaYaml(text);
    const db = getKnex();
    const technique_ids: string[] = [];
    for (const id of extractTechniqueIds(parsed.tags ?? [])) {
      if (await rawGet(db, 'SELECT 1 FROM attack_techniques WHERE id=?', [id])) technique_ids.push(id);
    }
    const result = { raw: text, parsed: { ...parsed, technique_ids } };
    cacheSet(`rule:${rawUrl}`, result);
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: `Network error: ${err.message}` });
  }
});

router.get('/templates', async (req, res) => {
  const technique_id = (req.query.technique as string)?.trim()?.toUpperCase();
  if (!technique_id || !technique_id.match(/^T\d{4}(\.\d{3})?$/)) {
    return res.status(400).json({ error: 'technique must be a valid ATT&CK ID' });
  }

  const db = getKnex();
  const tech = await rawGet<any>(db, 'SELECT id, name, tactic_ids FROM attack_techniques WHERE id=?', [technique_id]);
  if (!tech) return res.status(404).json({ error: 'Technique not found' });

  const tacticIds: string[] = JSON.parse(tech.tactic_ids);
  const tactics = tacticIds.length > 0
    ? await rawAll<{ id: string; name: string }>(db,
        `SELECT id, name FROM attack_tactics WHERE id IN (${tacticIds.map(() => '?').join(',')})`, tacticIds)
    : [];

  const dataSources = await rawAll<{ name: string; category: string }>(db, `
    SELECT ds.name, ds.category FROM data_sources ds
    JOIN technique_data_sources tds ON ds.id = tds.data_source_id
    WHERE tds.technique_id = ?
  `, [technique_id]);

  const logsource = deriveLogsource(dataSources.map((d: any) => d.name));
  const level = tacticIds.map(id => TACTIC_LEVEL[id]).find(Boolean) ?? 'medium';
  const yaml = buildTemplateYaml(
    { id: tech.id, name: tech.name },
    tactics.map((t: any) => t.name),
    tacticIds,
    logsource,
    level,
  );

  res.json({
    technique_id: tech.id,
    technique_name: tech.name,
    tactic_names: tactics.map((t: any) => t.name),
    logsource,
    level,
    data_sources: dataSources.map((d: any) => d.name),
    yaml,
  });
});

export default router;
