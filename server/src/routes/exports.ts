import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

// ATT&CK Navigator layer JSON
router.get('/navigator', (_req, res) => {
  const db = getDb();
  const techniques = db.prepare('SELECT * FROM attack_techniques').all() as any[];
  const detections = db.prepare("SELECT technique_ids, status FROM detections WHERE status != 'archived'").all() as any[];

  const scoreMap: Record<string, number> = {};
  for (const d of detections) {
    const ids: string[] = JSON.parse(d.technique_ids);
    const score = d.status === 'active' ? 3 : d.status === 'tuning' ? 2 : 1;
    for (const id of ids) scoreMap[id] = Math.max(scoreMap[id] ?? 0, score);
  }

  const colorMap: Record<number, string> = { 3: '#4ade80', 2: '#facc15', 1: '#94a3b8' };

  const layer = {
    version: '4.5',
    name: 'MitreMap Coverage',
    description: 'Detection coverage exported from MitreMap',
    domain: 'enterprise-attack',
    techniques: techniques
      .filter(t => scoreMap[t.id])
      .map(t => ({
        techniqueID: t.id,
        score: scoreMap[t.id],
        color: colorMap[scoreMap[t.id]],
        comment: scoreMap[t.id] === 3 ? 'Active detection' : scoreMap[t.id] === 2 ? 'Tuning' : 'Planned',
        enabled: true,
      })),
    gradient: { colors: ['#ffffff', '#4ade80'], minValue: 0, maxValue: 3 },
    legendItems: [
      { label: 'Active', color: '#4ade80' },
      { label: 'Tuning', color: '#facc15' },
      { label: 'Planned', color: '#94a3b8' },
    ],
    metadata: [],
    showTacticRowBackground: true,
    tacticRowBackground: '#1e293b',
    selectTechniquesAcrossTactics: true,
  };

  res.setHeader('Content-Disposition', 'attachment; filename="mitremap-navigator.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json(layer);
});

// CSV export of detections
router.get('/detections/csv', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM detections ORDER BY updated_at DESC').all() as any[];
  const cols = ['id', 'name', 'rule_id', 'source', 'technique_ids', 'status', 'severity', 'confidence', 'false_positive_rate', 'notes', 'created_at', 'updated_at'];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename="detections.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// CSV export of tools
router.get('/tools/csv', (_req, res) => {
  const db = getDb();
  const tools = db.prepare('SELECT * FROM tools ORDER BY category, name').all() as any[];
  const withLinks = tools.map(t => {
    const d3 = (db.prepare('SELECT COUNT(*) as c FROM tool_d3fend WHERE tool_id = ?').get(t.id) as any).c;
    const mit = (db.prepare('SELECT COUNT(*) as c FROM tool_mitigations WHERE tool_id = ?').get(t.id) as any).c;
    return { ...t, d3fend_count: d3, mitigation_count: mit };
  });
  const cols = ['id', 'name', 'vendor', 'category', 'status', 'd3fend_count', 'mitigation_count', 'description', 'notes', 'created_at'];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const csv = [cols.join(','), ...withLinks.map(r => cols.map(c => escape((r as any)[c])).join(','))].join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename="tools.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// Coverage matrix JSON — full status per technique
router.get('/coverage/json', (_req, res) => {
  const db = getDb();
  const techniques = db.prepare('SELECT id, name, tactic_ids FROM attack_techniques WHERE is_subtechnique = 0').all() as any[];
  const result = techniques.map(t => {
    const detected = (db.prepare(
      "SELECT COUNT(*) as c FROM detections WHERE status='active' AND technique_ids LIKE ?"
    ).get(`%"${t.id}"%`) as any).c > 0;
    const mitigated = (db.prepare(`
      SELECT COUNT(*) as c FROM technique_mitigations tm
      JOIN tool_mitigations tlm ON tm.mitigation_id = tlm.mitigation_id
      JOIN tools tl ON tlm.tool_id = tl.id WHERE tm.technique_id = ? AND tl.status = 'active'
    `).get(t.id) as any).c > 0;
    return { id: t.id, name: t.name, tactic_ids: JSON.parse(t.tactic_ids), detected, mitigated, status: detected && mitigated ? 'full' : detected ? 'detected' : mitigated ? 'mitigated' : 'gap' };
  });
  res.setHeader('Content-Disposition', 'attachment; filename="coverage-matrix.json"');
  res.json(result);
});

export default router;
