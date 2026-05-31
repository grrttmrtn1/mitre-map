import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun } from '../db/database';

const router = Router();

const CVE_RE = /^CVE-\d{4}-\d+$/;

router.get('/gap-summary', async (_req, res) => {
  try {
    const db = getKnex();
    const rows = await rawAll(db, `
      SELECT ct.technique_id,
             COUNT(c.id) as cve_count,
             MAX(c.cvss_score) as max_cvss,
             GROUP_CONCAT(c.id, ',') as cve_ids
      FROM cve_techniques ct
      JOIN cves c ON c.id = ct.cve_id
      GROUP BY ct.technique_id
      ORDER BY max_cvss DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const db = getKnex();
    const { technique_id } = req.query;
    if (!technique_id) {
      const rows = await rawAll(db, 'SELECT * FROM cves ORDER BY cvss_score DESC LIMIT 200');
      return res.json(rows);
    }
    const rows = await rawAll(db, `
      SELECT c.* FROM cves c
      JOIN cve_techniques ct ON ct.cve_id = c.id
      WHERE ct.technique_id = ?
      ORDER BY c.cvss_score DESC
    `, [technique_id]);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/sync-nvd', async (req, res) => {
  try {
    const db = getKnex();
    const { cve_ids } = req.body;
    if (!Array.isArray(cve_ids) || cve_ids.length === 0)
      return res.status(400).json({ error: 'cve_ids array required' });

    const results: Array<{ id: string; ok: boolean; message: string }> = [];
    for (const cveId of cve_ids.slice(0, 50)) {
      if (!CVE_RE.test(cveId)) { results.push({ id: cveId, ok: false, message: 'Invalid CVE ID format' }); continue; }
      try {
        const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`;
        const nvdRes = await fetch(url, {
          headers: {
            'User-Agent': 'MitreMap/1.0',
            ...(process.env.NVD_API_KEY ? { apiKey: process.env.NVD_API_KEY } : {}),
          },
        });
        if (!nvdRes.ok) { results.push({ id: cveId, ok: false, message: `NVD HTTP ${nvdRes.status}` }); continue; }
        const json = await nvdRes.json() as any;
        const vuln = json.vulnerabilities?.[0]?.cve;
        if (!vuln) { results.push({ id: cveId, ok: false, message: 'Not found in NVD' }); continue; }

        const desc = (vuln.descriptions ?? []).find((d: any) => d.lang === 'en')?.value ?? null;
        const metrics = vuln.metrics?.cvssMetricV31?.[0] ?? vuln.metrics?.cvssMetricV30?.[0] ?? vuln.metrics?.cvssMetricV2?.[0];
        const cvssScore = metrics?.cvssData?.baseScore ?? null;
        const severity = metrics?.cvssData?.baseSeverity ?? null;
        const published = vuln.published ?? null;
        const cpes = (vuln.configurations ?? []).flatMap((c: any) =>
          (c.nodes ?? []).flatMap((n: any) => (n.cpeMatch ?? []).map((m: any) => m.criteria))
        ).slice(0, 20);

        await rawRun(db,
          `INSERT OR REPLACE INTO cves (id, description, cvss_score, cvss_severity, affected_products, published_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [cveId, desc, cvssScore, severity, JSON.stringify(cpes), published]
        );
        results.push({ id: cveId, ok: true, message: `CVSS ${cvssScore ?? 'N/A'}` });
      } catch (e: any) {
        results.push({ id: cveId, ok: false, message: e.message });
      }
      if (!process.env.NVD_API_KEY) await new Promise(r => setTimeout(r, 700));
    }
    res.json({ results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = getKnex();
    const { id, description, cvss_score, cvss_severity, affected_products, published_at, technique_ids = [] } = req.body;
    if (!CVE_RE.test(id)) return res.status(400).json({ error: 'id must be a valid CVE ID (CVE-YYYY-NNNNN)' });
    await rawRun(db,
      `INSERT OR REPLACE INTO cves (id, description, cvss_score, cvss_severity, affected_products, published_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, description ?? null, cvss_score ?? null, cvss_severity ?? null,
       affected_products ? JSON.stringify(affected_products) : null, published_at ?? null]
    );
    for (const tid of technique_ids) {
      await rawRun(db, 'INSERT OR IGNORE INTO cve_techniques (cve_id, technique_id) VALUES (?, ?)', [id, tid]);
    }
    res.status(201).json(await rawGet(db, 'SELECT * FROM cves WHERE id = ?', [id]));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/techniques', async (req, res) => {
  try {
    const db = getKnex();
    if (!await rawGet(db, 'SELECT id FROM cves WHERE id = ?', [req.params.id]))
      return res.status(404).json({ error: 'CVE not found' });
    const { technique_id } = req.body;
    if (!technique_id) return res.status(400).json({ error: 'technique_id required' });
    await rawRun(db, 'INSERT OR IGNORE INTO cve_techniques (cve_id, technique_id) VALUES (?, ?)', [req.params.id, technique_id]);
    res.status(201).json({ cve_id: req.params.id, technique_id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/techniques/:technique_id', async (req, res) => {
  try {
    const db = getKnex();
    await rawRun(db, 'DELETE FROM cve_techniques WHERE cve_id = ? AND technique_id = ?', [req.params.id, req.params.technique_id]);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
