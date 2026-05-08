import { Router } from 'express';
import { getKnex, rawAll, rawGet, rawRun, logAudit } from '../db/database';

const router = Router();

const PURGEABLE: Record<string, { tables: string[]; label: string }> = {
  detections: { tables: ['detections'], label: 'All detections' },
  audit: { tables: ['audit_log'], label: 'Audit log' },
  snapshots: { tables: ['coverage_snapshots'], label: 'Coverage snapshots' },
  comments: { tables: ['comments'], label: 'All comments' },
  assignments: { tables: ['assignments'], label: 'All assignments' },
  threat_groups: { tables: ['group_techniques', 'threat_groups'], label: 'Threat groups' },
  tags: { tables: ['entity_tags', 'tags'], label: 'Tags and entity tag associations' },
  tools: { tables: ['tool_d3fend', 'tool_mitigations', 'tools'], label: 'Tools' },
};

const COUNT_QUERIES: Record<string, string> = {
  detections: 'SELECT COUNT(*) as c FROM detections',
  audit: 'SELECT COUNT(*) as c FROM audit_log',
  snapshots: 'SELECT COUNT(*) as c FROM coverage_snapshots',
  comments: 'SELECT COUNT(*) as c FROM comments',
  assignments: 'SELECT COUNT(*) as c FROM assignments',
  threat_groups: 'SELECT COUNT(*) as c FROM threat_groups',
  tags: 'SELECT COUNT(*) as c FROM tags',
  tools: 'SELECT COUNT(*) as c FROM tools',
};

router.get('/purgeable', async (_req, res) => {
  const db = getKnex();
  const counts = await Promise.all(
    Object.entries(COUNT_QUERIES).map(async ([key, q]) => {
      const row = await rawGet<{ c: number }>(db, q) as any;
      return [key, row.c] as [string, number];
    })
  );
  const summary = Object.fromEntries(counts);
  res.json({ datasets: Object.entries(PURGEABLE).map(([key, cfg]) => ({ key, label: cfg.label, count: summary[key] ?? 0 })) });
});

router.delete('/purge/:dataset', async (req, res) => {
  const cfg = PURGEABLE[req.params.dataset];
  if (!cfg) return res.status(400).json({ error: 'Unknown dataset' });
  const db = getKnex();
  let totalDeleted = 0;
  await db.transaction(async trx => {
    for (const table of cfg.tables) {
      const rows = await rawAll(trx, `SELECT COUNT(*) as c FROM ${table}`);
      totalDeleted += (rows[0] as any).c;
      await rawRun(trx, `DELETE FROM ${table}`);
    }
    await logAudit(trx, 'admin', req.params.dataset, 'purge', (req as any).actor ?? 'user',
      { dataset: req.params.dataset, rows_deleted: totalDeleted }, (req as any).sourceIp);
  });
  res.json({ purged: req.params.dataset, rows_deleted: totalDeleted });
});

router.delete('/purge-all', async (req, res) => {
  const db = getKnex();
  let totalDeleted = 0;
  const orderedTables = [
    'entity_tags', 'tool_d3fend', 'tool_mitigations', 'group_techniques',
    'detections', 'tools', 'threat_groups', 'tags', 'comments',
    'assignments', 'coverage_snapshots', 'audit_log',
  ];
  await db.transaction(async trx => {
    for (const table of orderedTables) {
      const rows = await rawAll(trx, `SELECT COUNT(*) as c FROM ${table}`);
      totalDeleted += (rows[0] as any).c;
      await rawRun(trx, `DELETE FROM ${table}`);
    }
    await logAudit(trx, 'admin', 'all', 'purge_all', (req as any).actor ?? 'user', { rows_deleted: totalDeleted }, (req as any).sourceIp);
  });
  res.json({ purged: 'all', rows_deleted: totalDeleted });
});

export default router;
