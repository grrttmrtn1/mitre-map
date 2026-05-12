import { Router } from 'express';
import { getKnex, rawAll, rawGet, logAudit } from '../db/database';
import { fetchAndParseStix, GITHUB_RELEASES_API, GH_HEADERS } from '../data/stix-fetch';

const router = Router();

router.get('/tactics', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM attack_tactics ORDER BY id'));
});

router.get('/techniques', async (req, res) => {
  const db = getKnex();
  const { tactic, include_subtechniques } = req.query;
  const withSubs = include_subtechniques === 'true' || include_subtechniques === '1';
  const rows = tactic
    ? await rawAll(db, 'SELECT * FROM attack_techniques WHERE tactic_ids LIKE ? ORDER BY id', [`%"${tactic}"%`])
    : withSubs
      ? await rawAll(db, 'SELECT * FROM attack_techniques ORDER BY id')
      : await rawAll(db, 'SELECT * FROM attack_techniques WHERE is_subtechnique = 0 ORDER BY id');
  res.json(rows.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })));
});

router.get('/techniques/:id', async (req, res) => {
  const db = getKnex();
  const technique = await rawGet<any>(db, 'SELECT * FROM attack_techniques WHERE id = ?', [req.params.id]);
  if (!technique) return res.status(404).json({ error: 'Not found' });

  const [mitigations, d3fend, detections] = await Promise.all([
    rawAll(db, `SELECT m.* FROM attack_mitigations m JOIN technique_mitigations tm ON m.id = tm.mitigation_id WHERE tm.technique_id = ?`, [req.params.id]),
    rawAll(db, `SELECT d.* FROM d3fend_techniques d JOIN attack_d3fend ad ON d.id = ad.d3fend_id WHERE ad.attack_id = ?`, [req.params.id]),
    rawAll(db, `SELECT * FROM detections WHERE technique_ids LIKE ? AND status != 'deleted'`, [`%"${req.params.id}"%`]),
  ]);

  res.json({
    ...technique,
    tactic_ids: JSON.parse(technique.tactic_ids),
    mitigations,
    d3fend_countermeasures: d3fend,
    detections: detections.map((d: any) => ({ ...d, technique_ids: JSON.parse(d.technique_ids) })),
  });
});

router.get('/mitigations', async (_req, res) => {
  const db = getKnex();
  res.json(await rawAll(db, 'SELECT * FROM attack_mitigations ORDER BY id'));
});

router.get('/mitigations/:id', async (req, res) => {
  const db = getKnex();
  const mitigation = await rawGet(db, 'SELECT * FROM attack_mitigations WHERE id = ?', [req.params.id]);
  if (!mitigation) return res.status(404).json({ error: 'Not found' });

  const [techniques, tools] = await Promise.all([
    rawAll(db, `SELECT t.* FROM attack_techniques t JOIN technique_mitigations tm ON t.id = tm.technique_id WHERE tm.mitigation_id = ?`, [req.params.id]),
    rawAll(db, `SELECT t.* FROM tools t JOIN tool_mitigations tm ON t.id = tm.tool_id WHERE tm.mitigation_id = ?`, [req.params.id]),
  ]);

  res.json({
    ...mitigation,
    techniques: techniques.map((t: any) => ({ ...t, tactic_ids: JSON.parse(t.tactic_ids) })),
    covered_by_tools: tools,
  });
});

function requireAdmin(req: any, res: any): boolean {
  const user = req.user;
  if (user && user.role !== 'admin') {
    res.status(403).json({ error: 'Admin required' });
    return false;
  }
  return true;
}

router.get('/check-updates', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getKnex();
  const current = await rawGet<any>(db, 'SELECT version FROM attack_version_info WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  const currentVersion = current?.version ?? 'unknown';

  try {
    const ghRes = await fetch(GITHUB_RELEASES_API, { headers: GH_HEADERS });
    if (!ghRes.ok) return res.status(502).json({ error: 'GitHub API unavailable', status: ghRes.status });
    const release = await ghRes.json() as any;
    const latestVersion = (release.tag_name as string).replace(/^(?:ATT&CK-v|v)/, '');
    res.json({
      current_version: currentVersion,
      latest_version: latestVersion,
      latest_name: `ATT&CK v${latestVersion}`,
      up_to_date: currentVersion === latestVersion,
      published_at: release.published_at,
      release_url: release.html_url,
    });
  } catch {
    res.status(502).json({ error: 'Failed to reach GitHub API' });
  }
});

router.post('/apply-update', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const stix = await fetchAndParseStix(req.body?.version);
    if (!stix) return res.status(502).json({ error: req.body?.version ? `Failed to fetch STIX bundle for v${req.body.version}` : 'Failed to reach GitHub API' });

    const { version: targetVersion, tactics, techniques, mitigations, mitRelationships, revokedByMap, stixIdToTechId } = stix;
    const shortnameToTacticId = new Map(tactics.map(t => [t.shortname, t.id]));

    const db = getKnex();
    const existingTechIds = new Set((await rawAll<{ id: string }>(db, 'SELECT id FROM attack_techniques')).map(r => r.id));
    const newTechCount = techniques.filter(t => !existingTechIds.has(t.id)).length;
    const updatedTechCount = techniques.filter(t => existingTechIds.has(t.id)).length;

    // Find newly deprecated: in DB but not in live techniques, and not already in deprecated_techniques
    const liveTechIds = new Set(techniques.map(t => t.id));
    const existingDeprecated = new Set((await rawAll<{ technique_id: string }>(db, 'SELECT technique_id FROM deprecated_techniques')).map(r => r.technique_id));
    const newlyDeprecated = [...existingTechIds].filter(id => !liveTechIds.has(id) && !existingDeprecated.has(id));

    await db.transaction(async trx => {
      // Upsert tactics
      for (const t of tactics) {
        await trx.raw(
          'INSERT INTO attack_tactics (id, name, shortname, description) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, shortname=excluded.shortname, description=excluded.description',
          [t.id, t.name, t.shortname, t.description]
        );
      }

      // Upsert techniques
      for (const t of techniques) {
        const tacticIds = t.phase_names.map((p: string) => shortnameToTacticId.get(p)).filter(Boolean);
        await trx.raw(
          'INSERT INTO attack_techniques (id, name, description, tactic_ids, is_subtechnique, parent_id, url) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, tactic_ids=excluded.tactic_ids, is_subtechnique=excluded.is_subtechnique, parent_id=excluded.parent_id, url=excluded.url',
          [t.id, t.name, t.description, JSON.stringify(tacticIds), t.is_subtechnique, t.parent_id, t.url]
        );
      }

      // Upsert mitigations
      for (const m of mitigations) {
        await trx.raw(
          'INSERT INTO attack_mitigations (id, name, description, url) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, url=excluded.url',
          [m.id, m.name, m.description, m.url]
        );
      }

      // Insert new mitigation→technique relationships
      for (const rel of mitRelationships) {
        const techId = stixIdToTechId.get(rel.stix_tech_id);
        if (!techId || !liveTechIds.has(techId)) continue;
        await trx.raw(
          'INSERT INTO technique_mitigations (technique_id, mitigation_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
          [techId, rel.mitigation_id]
        );
      }

      // Mark newly deprecated techniques
      for (const techId of newlyDeprecated) {
        const revokedByStixId = [...revokedByMap.entries()].find(([src]) => stixIdToTechId.get(src) === techId)?.[1];
        const supersededById = revokedByStixId ? stixIdToTechId.get(revokedByStixId) ?? null : null;
        await trx.raw(
          'INSERT INTO deprecated_techniques (technique_id, deprecated_in_version, superseded_by, reason) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
          [techId, targetVersion, supersededById, supersededById ? 'Revoked and superseded' : 'Removed in update']
        );
      }

      // Update version info
      await trx.raw('UPDATE attack_version_info SET is_active = 0');
      await trx.raw(
        'INSERT INTO attack_version_info (version, name, released_at, is_active, notes) VALUES (?, ?, ?, 1, ?)',
        [targetVersion, `ATT&CK v${targetVersion}`, new Date().toISOString().split('T')[0],
          `Enterprise ATT&CK v${targetVersion} — ${tactics.length} tactics, ${techniques.length} techniques`]
      );
      await logAudit(trx, 'attack', targetVersion, 'framework_updated', (req as any).actor ?? 'user',
        { version: targetVersion, tactics: tactics.length, techniques_new: newTechCount, techniques_updated: updatedTechCount, deprecated_added: newlyDeprecated.length },
        (req as any).sourceIp);
    });

    res.json({
      success: true,
      version: targetVersion,
      tactics: tactics.length,
      techniques_total: techniques.length,
      techniques_new: newTechCount,
      techniques_updated: updatedTechCount,
      mitigations: mitigations.length,
      deprecated_added: newlyDeprecated.length,
    });
  } catch (err: any) {
    console.error('ATT&CK update error:', err);
    res.status(500).json({ error: err?.message ?? 'Update failed' });
  }
});

// ATT&CK version management endpoints
router.get('/version', async (_req, res) => {
  const db = getKnex();
  const version = await rawGet(db, 'SELECT * FROM attack_version_info WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  res.json(version ?? { version: 'unknown', name: 'ATT&CK (version unknown)' });
});

router.get('/deprecated', async (_req, res) => {
  const db = getKnex();
  const deprecated = await rawAll(db, `
    SELECT dt.*, t.name as technique_name, s.name as superseded_by_name
    FROM deprecated_techniques dt
    JOIN attack_techniques t ON dt.technique_id = t.id
    LEFT JOIN attack_techniques s ON dt.superseded_by = s.id
    ORDER BY dt.deprecated_in_version, dt.technique_id
  `);
  res.json(deprecated);
});

router.get('/migration-scan', async (_req, res) => {
  const db = getKnex();
  const deprecated = await rawAll<{ technique_id: string; superseded_by: string | null; reason: string }>(
    db, 'SELECT technique_id, superseded_by, reason FROM deprecated_techniques'
  );
  if (deprecated.length === 0) { return res.json({ detections_affected: [], total: 0 }); }

  const deprecatedIds = new Set(deprecated.map(d => d.technique_id));
  const deprecatedMap = Object.fromEntries(deprecated.map(d => [d.technique_id, d]));

  const allDetections = await rawAll<{ id: number; name: string; technique_ids: string }>(
    db, 'SELECT id, name, technique_ids FROM detections'
  );

  const affected = allDetections.flatMap(det => {
    const ids: string[] = JSON.parse(det.technique_ids);
    const hits = ids.filter(id => deprecatedIds.has(id));
    if (hits.length === 0) return [];
    return hits.map(id => ({
      detection_id: det.id,
      detection_name: det.name,
      deprecated_technique_id: id,
      superseded_by: deprecatedMap[id]?.superseded_by ?? null,
      reason: deprecatedMap[id]?.reason ?? null,
    }));
  });

  res.json({ detections_affected: affected, total: affected.length });
});

export default router;
