import { Router } from 'express';
import { getKnex, rawAll, rawGet, computeCoverageState } from '../db/database';
import PptxGenJS from 'pptxgenjs';

const router = Router();

router.get('/navigator', async (_req, res) => {
  const db = getKnex();
  const techniques = await rawAll<any>(db, 'SELECT * FROM attack_techniques', []);
  const detections = await rawAll<any>(db, "SELECT technique_ids, status FROM detections WHERE status != 'archived'", []);

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

router.get('/detections/csv', async (_req, res) => {
  const db = getKnex();
  const rows = await rawAll<any>(db, 'SELECT * FROM detections ORDER BY updated_at DESC', []);
  const cols = ['id', 'name', 'rule_id', 'source', 'technique_ids', 'status', 'severity', 'confidence', 'false_positive_rate', 'notes', 'created_at', 'updated_at'];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const raw = String(v);
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    const s = safe.replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename="detections.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/tools/csv', async (_req, res) => {
  const db = getKnex();
  const tools = await rawAll<any>(db, 'SELECT * FROM tools ORDER BY category, name', []);
  const withLinks = await Promise.all(tools.map(async t => {
    const d3 = (await rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM tool_d3fend WHERE tool_id = ?', [t.id]) as any).c;
    const mit = (await rawGet<{ c: number }>(db, 'SELECT COUNT(*) as c FROM tool_mitigations WHERE tool_id = ?', [t.id]) as any).c;
    return { ...t, d3fend_count: d3, mitigation_count: mit };
  }));
  const cols = ['id', 'name', 'vendor', 'category', 'status', 'd3fend_count', 'mitigation_count', 'description', 'notes', 'created_at'];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const raw = String(v);
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    const s = safe.replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const csv = [cols.join(','), ...withLinks.map(r => cols.map(c => escape((r as any)[c])).join(','))].join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename="tools.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

router.get('/coverage/json', async (_req, res) => {
  const db = getKnex();
  const coverage = await computeCoverageState(db);
  const detectedParents = coverage.detectedIds;
  const mitigatedParents = coverage.mitigatedIds;

  const techniques = await rawAll<any>(db, 'SELECT id, name, tactic_ids FROM attack_techniques WHERE is_subtechnique = 0', []);
  const result = techniques.map(t => {
    const detected = detectedParents.has(t.id);
    const mitigated = mitigatedParents.has(t.id);
    return {
      id: t.id, name: t.name, tactic_ids: JSON.parse(t.tactic_ids), detected, mitigated,
      status: detected && mitigated ? 'full' : detected ? 'detected' : mitigated ? 'mitigated' : 'gap',
    };
  });
  res.setHeader('Content-Disposition', 'attachment; filename="coverage-matrix.json"');
  res.setHeader('X-Mitremap-Coverage-Methodology', coverage.methodology);
  res.json(result);
});

router.get('/report/pptx', async (_req, res) => {
  const db = getKnex();
  const coverage = await computeCoverageState(db);
  const { coveredIds } = coverage;

  const [techniques, detections, tools, threatGroups] = await Promise.all([
    rawAll<any>(db, 'SELECT id, name, tactic_ids FROM attack_techniques WHERE is_subtechnique=0', []),
    rawAll<any>(db, "SELECT technique_ids, status, severity FROM detections WHERE status != 'archived'", []),
    rawAll<any>(db, "SELECT * FROM tools WHERE status='active'", []),
    rawAll<any>(db, 'SELECT * FROM threat_groups', []),
  ]);

  const activeDetections = detections.filter((d: any) => d.status === 'active');
  const coveragePct = coverage.pct;

  const tacticOrder = ['initial-access', 'execution', 'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'impact'];
  const tacticCoverage: Record<string, { total: number; covered: number }> = {};
  for (const t of techniques) {
    const tids: string[] = JSON.parse(t.tactic_ids);
    for (const tactic of tids) {
      if (!tacticCoverage[tactic]) tacticCoverage[tactic] = { total: 0, covered: 0 };
      tacticCoverage[tactic].total++;
      if (coveredIds.has(t.id)) tacticCoverage[tactic].covered++;
    }
  }

  const gaps = techniques.filter(t => !coveredIds.has(t.id)).slice(0, 10);

  const groupExposures = await Promise.all(threatGroups.slice(0, 5).map(async (g: any) => {
    const gTechs = await rawAll<any>(db, `SELECT t.id FROM attack_techniques t JOIN group_techniques gt ON t.id=gt.technique_id WHERE gt.group_id=?`, [g.id]);
    const exposed = gTechs.filter((t: any) => !coveredIds.has(t.id)).length;
    return { name: g.name, exposed, total: gTechs.length, pct: gTechs.length ? Math.round((exposed / gTechs.length) * 100) : 0 };
  }));

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'MitreMap Security Coverage Report';

  const BG = '#0f172a';
  const FG = '#f1f5f9';
  const ACCENT = '#6366f1';
  const GREEN = '#4ade80';
  const RED = '#f87171';
  const YELLOW = '#facc15';

  const addSlide = (title: string) => {
    const slide = pptx.addSlide();
    slide.background = { color: BG };
    slide.addText(title, { x: 0.4, y: 0.2, w: 12, h: 0.6, fontSize: 24, bold: true, color: FG, fontFace: 'Calibri' });
    slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.82, w: 1.5, h: 0.04, fill: { color: ACCENT }, line: { color: ACCENT } });
    return slide;
  };

  // Slide 1: Title
  {
    const slide = pptx.addSlide();
    slide.background = { color: BG };
    slide.addText('Security Coverage Report', { x: 1, y: 2.5, w: 11, h: 1, fontSize: 40, bold: true, color: FG, align: 'center', fontFace: 'Calibri' });
    slide.addText(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { x: 1, y: 3.6, w: 11, h: 0.4, fontSize: 16, color: '#94a3b8', align: 'center', fontFace: 'Calibri' });
    slide.addText('MitreMap', { x: 1, y: 4.2, w: 11, h: 0.4, fontSize: 14, color: ACCENT, align: 'center', fontFace: 'Calibri' });
  }

  // Slide 2: Executive Overview
  {
    const slide = addSlide('Executive Overview');
    const stats = [
      { label: 'Coverage', value: `${coveragePct}%`, color: coveragePct >= 60 ? GREEN : coveragePct >= 30 ? YELLOW : RED },
      { label: 'Active Detections', value: String(activeDetections.length), color: FG },
      { label: 'Active Tools', value: String(tools.length), color: FG },
      { label: 'Threat Groups', value: String(threatGroups.length), color: FG },
    ];
    stats.forEach((s, i) => {
      const x = 0.4 + i * 3.15;
      slide.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: 2.9, h: 1.8, fill: { color: '#1e293b' }, line: { color: '#334155' } });
      slide.addText(s.value, { x, y: 1.4, w: 2.9, h: 0.9, fontSize: 36, bold: true, color: s.color, align: 'center', fontFace: 'Calibri' });
      slide.addText(s.label, { x, y: 2.3, w: 2.9, h: 0.4, fontSize: 13, color: '#94a3b8', align: 'center', fontFace: 'Calibri' });
    });
  }

  // Slide 3: Coverage by Tactic
  {
    const slide = addSlide('Coverage by Tactic');
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: 'Tactic', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11 } },
        { text: 'Coverage %', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11, align: 'center' } },
        { text: 'Detected', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11, align: 'center' } },
        { text: 'Total', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11, align: 'center' } },
      ],
    ];
    for (const tactic of tacticOrder) {
      const data = tacticCoverage[tactic];
      if (!data) continue;
      const pct = data.total ? Math.round((data.covered / data.total) * 100) : 0;
      const color = pct >= 60 ? GREEN : pct >= 30 ? YELLOW : RED;
      rows.push([
        { text: tactic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), options: { color: FG, fontSize: 10 } },
        { text: `${pct}%`, options: { color, align: 'center', fontSize: 10, bold: true } },
        { text: String(data.covered), options: { color: FG, align: 'center', fontSize: 10 } },
        { text: String(data.total), options: { color: FG, align: 'center', fontSize: 10 } },
      ]);
    }
    slide.addTable(rows, { x: 0.4, y: 1.1, w: 12.2, colW: [5, 2.5, 2.5, 2.2], border: { color: '#334155', pt: 0.5 }, fill: { color: BG } });
  }

  // Slide 4: Top 10 Critical Gaps
  {
    const slide = addSlide('Top 10 Critical Gaps');
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: 'Technique ID', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11 } },
        { text: 'Name', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11 } },
        { text: 'Tactics', options: { bold: true, color: FG, fill: { color: '#1e293b' }, fontSize: 11 } },
      ],
    ];
    for (const t of gaps) {
      const tactics: string[] = JSON.parse(t.tactic_ids);
      rows.push([
        { text: t.id, options: { color: RED, fontSize: 10, bold: true } },
        { text: t.name, options: { color: FG, fontSize: 10 } },
        { text: tactics.map((s: string) => s.replace(/-/g, ' ')).join(', '), options: { color: '#94a3b8', fontSize: 9 } },
      ]);
    }
    slide.addTable(rows, { x: 0.4, y: 1.1, w: 12.2, colW: [2.2, 6, 4], border: { color: '#334155', pt: 0.5 }, fill: { color: BG } });
  }

  // Slide 5: Threat Group Exposure
  {
    const slide = addSlide('Threat Group Exposure');
    groupExposures.forEach((g, i) => {
      const y = 1.2 + i * 0.75;
      slide.addText(g.name, { x: 0.4, y, w: 3.5, h: 0.5, fontSize: 12, color: FG, fontFace: 'Calibri' });
      const barW = 7;
      slide.addShape(pptx.ShapeType.rect, { x: 4, y: y + 0.1, w: barW, h: 0.3, fill: { color: '#1e293b' }, line: { color: '#334155' } });
      if (g.pct > 0) {
        const color = g.pct >= 60 ? RED : g.pct >= 30 ? YELLOW : GREEN;
        slide.addShape(pptx.ShapeType.rect, { x: 4, y: y + 0.1, w: (g.pct / 100) * barW, h: 0.3, fill: { color }, line: { color } });
      }
      slide.addText(`${g.pct}% exposed (${g.exposed}/${g.total})`, { x: 11.2, y, w: 1.8, h: 0.5, fontSize: 10, color: '#94a3b8', fontFace: 'Calibri' });
    });
  }

  // Slide 6: Compliance Status
  {
    const slide = addSlide('Compliance & Framework Alignment');
    const frameworks = [
      { name: 'NIST CSF', description: 'Based on detection + tool coverage across all technique categories' },
      { name: 'CIS Controls v8', description: 'Mapped via D3FEND artifacts and active tool deployment' },
    ];
    frameworks.forEach((f, i) => {
      const x = 0.4 + i * 6.3;
      slide.addShape(pptx.ShapeType.rect, { x, y: 1.2, w: 5.8, h: 2, fill: { color: '#1e293b' }, line: { color: '#334155' } });
      slide.addText(f.name, { x, y: 1.35, w: 5.8, h: 0.5, fontSize: 18, bold: true, color: ACCENT, align: 'center', fontFace: 'Calibri' });
      slide.addText(`${coveragePct}%`, { x, y: 1.9, w: 5.8, h: 0.7, fontSize: 32, bold: true, color: coveragePct >= 60 ? GREEN : YELLOW, align: 'center', fontFace: 'Calibri' });
      slide.addText(f.description, { x, y: 2.7, w: 5.8, h: 0.4, fontSize: 9, color: '#94a3b8', align: 'center', fontFace: 'Calibri', wrap: true });
    });
  }

  // Slide 7: Recommendations
  {
    const slide = addSlide('Recommendations');
    const recs: string[] = [];
    if (coveragePct < 30) recs.push('Critical: Less than 30% ATT&CK coverage — prioritize detection engineering across high-frequency tactics.');
    if (coveragePct < 60) recs.push('Expand detection coverage — target techniques in Initial Access, Execution, and Persistence first.');
    if (gaps.length > 0) recs.push(`Address the top ${gaps.length} undetected techniques: focus on ${gaps.slice(0, 3).map(g => g.name).join(', ')}.`);
    if (groupExposures.some(g => g.pct > 50)) recs.push('High threat group exposure detected — tune detection rules against the most active group TTPs.');
    if (tools.length < 5) recs.push('Expand tool coverage — fewer than 5 active tools limits mitigation breadth.');
    recs.push('Schedule quarterly ATT&CK layer reviews to track detection coverage trends.');
    recs.push('Run Atomic Red Team tests to validate detection fidelity for top-priority techniques.');

    recs.forEach((rec, i) => {
      slide.addText(`• ${rec}`, { x: 0.6, y: 1.1 + i * 0.55, w: 12, h: 0.5, fontSize: 12, color: FG, fontFace: 'Calibri', wrap: true });
    });
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  res.setHeader('Content-Disposition', `attachment; filename="mitremap-report-${new Date().toISOString().slice(0, 10)}.pptx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.send(buffer);
});

export default router;
