import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import type { Detection, DetectionHistory, DetectionQualityScore, Technique } from '../types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SOURCES = ['Microsoft Sentinel', 'Microsoft Defender for Endpoint', 'Splunk', 'QRadar', 'CrowdStrike', 'Palo Alto NGFW', 'Proofpoint Email Security', 'Other'];
const STATUSES = ['active', 'disabled', 'tuning', 'planned', 'archived'];
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'informational'];
const CONFIDENCES = ['high', 'medium', 'low'];
const FP_RATES = ['low', 'medium', 'high'];

const EMPTY_FORM = {
  name: '', description: '', rule_id: '', source: '', technique_ids: [] as string[],
  status: 'active' as Detection['status'], severity: 'medium' as Detection['severity'],
  confidence: 'medium' as Detection['confidence'], false_positive_rate: 'medium', notes: '',
};

export default function Detections() {
  const { canWrite } = useAuth();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'csv' | 'sigma'>('csv');
  const [editDetection, setEditDetection] = useState<Detection | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [techSearch, setTechSearch] = useState('');
  const [csvText, setCsvText] = useState('');
  const [sigmaText, setSigmaText] = useState('');
  const [sigmaPreview, setSigmaPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [qualityScores, setQualityScores] = useState<Map<number, DetectionQualityScore>>(new Map());
  const [filterQuality, setFilterQuality] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [logFireOpen, setLogFireOpen] = useState(false);
  const [logFireOutcome, setLogFireOutcome] = useState<'true_positive' | 'false_positive' | 'suppressed' | ''>('');
  const [loggingFire, setLoggingFire] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<DetectionHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.getDetections({ status: filterStatus || undefined, severity: filterSeverity || undefined, source: filterSource || undefined })
    .then(setDetections).finally(() => setLoading(false));

  const loadQuality = () => api.getDetectionQualityScores()
    .then(scores => setQualityScores(new Map(scores.map(s => [s.detection_id, s]))));

  useEffect(() => { load(); }, [filterStatus, filterSeverity, filterSource]);
  useEffect(() => { api.getTechniques(undefined, true).then(setTechniques); }, []);
  useEffect(() => { loadQuality(); }, []);

  const openCreate = () => { setEditDetection(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEdit = (d: Detection, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditDetection(d);
    setForm({
      name: d.name, description: d.description ?? '', rule_id: d.rule_id ?? '',
      source: d.source ?? '', technique_ids: d.technique_ids,
      status: d.status, severity: d.severity, confidence: d.confidence,
      false_positive_rate: d.false_positive_rate ?? 'medium', notes: d.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editDetection) {
        await api.updateDetection(editDetection.id, form);
      } else {
        await api.createDetection(form);
      }
      setModalOpen(false);
      load();
      loadQuality();
    } finally { setSaving(false); }
  };

  const del = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Delete this detection?')) return;
    await api.deleteDetection(id);
    if (selectedDetection?.id === id) setSelectedDetection(null);
    load();
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      let rows: Partial<Detection>[] = [];
      if (csvText.trim()) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
          return {
            name: obj['name'] as string,
            rule_id: obj['rule_id'] as string,
            source: obj['source'] as string,
            technique_ids: (obj['technique_ids'] as string)?.split(';').filter(Boolean) ?? [],
            status: (obj['status'] as Detection['status']) || 'active',
            severity: (obj['severity'] as Detection['severity']) || 'medium',
            confidence: (obj['confidence'] as Detection['confidence']) || 'medium',
            notes: obj['notes'] as string,
          };
        }).filter(r => r.name);
      }
      if (rows.length === 0) { alert('No valid rows found.'); return; }
      const { imported } = await api.importDetections(rows);
      alert(`Imported ${imported} detections.`);
      setImportModalOpen(false);
      setCsvText('');
      load();
    } finally { setImporting(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const parseSigmaPreview = async () => {
    if (!sigmaText.trim()) return;
    const preview = await api.parseSigmaRule(sigmaText);
    setSigmaPreview(preview);
  };

  const importSigma = async () => {
    if (!sigmaText.trim()) return;
    setImporting(true);
    try {
      const { imported } = await api.importSigmaRules([sigmaText]);
      alert(`Imported ${imported} detection(s) from SIGMA rule.`);
      setImportModalOpen(false);
      setSigmaText('');
      setSigmaPreview(null);
      load();
    } finally { setImporting(false); }
  };

  const toggleSelect = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(displayed.length > 0 && selectedIds.size === displayed.length ? new Set() : new Set(displayed.map((d: Detection) => d.id)));
  };

  const bulkUpdate = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    await api.bulkUpdateDetections([...selectedIds], bulkStatus);
    setSelectedIds(new Set());
    setBulkStatus('');
    load();
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} detection(s)?`)) return;
    await api.bulkDeleteDetections([...selectedIds]);
    setSelectedIds(new Set());
    if (selectedDetection && selectedIds.has(selectedDetection.id)) setSelectedDetection(null);
    load();
  };

  const logFire = async (detectionId: number) => {
    if (!logFireOutcome) return;
    setLoggingFire(true);
    try {
      const updated = await api.logDetectionFire(detectionId, logFireOutcome);
      setSelectedDetection(updated);
      setLogFireOpen(false);
      setLogFireOutcome('');
      load();
      loadQuality();
    } finally { setLoggingFire(false); }
  };

  const markReviewed = async (detectionId: number) => {
    const updated = await api.reviewDetection(detectionId);
    setSelectedDetection(updated);
    load();
  };

  const openHistory = async (detectionId: number) => {
    setHistoryOpen(true);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const data = await api.getDetectionHistory(detectionId);
      setHistoryData(data);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleTechId = (id: string) => {
    setForm(f => ({
      ...f,
      technique_ids: f.technique_ids.includes(id)
        ? f.technique_ids.filter(t => t !== id)
        : [...f.technique_ids, id],
    }));
  };

  const filteredTechs = techniques.filter(t =>
    t.id.toLowerCase().includes(techSearch.toLowerCase()) ||
    t.name.toLowerCase().includes(techSearch.toLowerCase())
  ).slice(0, 150);

  const displayed = detections.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.rule_id?.toLowerCase().includes(q) &&
          !d.technique_ids.some(t => t.toLowerCase().includes(q))) return false;
    }
    if (filterQuality) {
      const qs = qualityScores.get(d.id);
      if (filterQuality === 'low' && qs && qs.grade !== 'D' && qs.grade !== 'F') return false;
      if (filterQuality === 'unvalidated' && d.last_fired_at !== null) return false;
      if (filterQuality !== 'low' && filterQuality !== 'unvalidated' && qs?.grade !== filterQuality) return false;
    }
    return true;
  });

  const SEVERITY_ORDER: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1 };
  const STATUS_ORDER: Record<string, number> = { active: 5, tuning: 4, planned: 3, disabled: 2, archived: 1 };

  const sorted = [...displayed].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'severity': cmp = (SEVERITY_ORDER[a.severity] ?? 0) - (SEVERITY_ORDER[b.severity] ?? 0); break;
      case 'status': cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0); break;
      case 'quality': cmp = (qualityScores.get(a.id)?.score ?? -1) - (qualityScores.get(b.id)?.score ?? -1); break;
      case 'last_fired_at': cmp = (a.last_fired_at ?? '').localeCompare(b.last_fired_at ?? ''); break;
      case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const sources = [...new Set(detections.map(d => d.source).filter(Boolean))];

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">SIEM Detections</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {detections.length} detections mapped to ATT&CK techniques
                {(() => {
                  const low = [...qualityScores.values()].filter(s => s.grade === 'D' || s.grade === 'F').length;
                  return low > 0 ? <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded">{low} low quality</span> : null;
                })()}
              </p>
            </div>
            {canWrite && <div className="flex gap-2">
              <button onClick={() => setImportModalOpen(true)} className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors">
                Import CSV
              </button>
              <button onClick={openCreate} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                + Add Detection
              </button>
            </div>}
          </div>
          <div className="flex gap-3 mt-3">
            <label className="flex items-center gap-2 flex-shrink-0">
              <input type="checkbox"
                checked={displayed.length > 0 && selectedIds.size === displayed.length}
                onChange={selectAll}
                className="accent-blue-500" />
              <span className="text-xs text-slate-500">All</span>
            </label>
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, rule ID, technique..."
              className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {[{ val: filterStatus, set: setFilterStatus, opts: ['', ...STATUSES], label: 'Status' },
              { val: filterSeverity, set: setFilterSeverity, opts: ['', ...SEVERITIES], label: 'Severity' },
              { val: filterSource, set: setFilterSource, opts: ['', ...sources], label: 'Source' },
            ].map(f => (
              <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
                className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
                <option value="">{f.label}: All</option>
                {f.opts.filter(Boolean).map(o => <option key={o as string} value={o as string}>{o}</option>)}
              </select>
            ))}
            <select value={filterQuality} onChange={e => setFilterQuality(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">Quality: All</option>
              <option value="A">Grade A (80+)</option>
              <option value="B">Grade B (60–79)</option>
              <option value="C">Grade C (40–59)</option>
              <option value="D">Grade D (20–39)</option>
              <option value="F">Grade F (&lt;20)</option>
              <option value="low">Low Quality (D/F)</option>
              <option value="unvalidated">Unvalidated (never fired)</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 mt-2">
            <span className="text-xs text-slate-500 font-medium">Sort by</span>
            <select value={sortField} onChange={e => setSortField(e.target.value)}
              className="px-3 py-1 text-xs bg-slate-800/80 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="name">Name</option>
              <option value="severity">Severity</option>
              <option value="status">Status</option>
              <option value="quality">Quality</option>
              <option value="last_fired_at">Last Fired</option>
              <option value="created_at">Created</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800/80 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              title={sortDir === 'asc' ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
            >
              {sortDir === 'asc' ? (
                <><span>↑</span><span>A–Z</span></>
              ) : (
                <><span>↓</span><span>Z–A</span></>
              )}
            </button>
          </div>
        </div>

        {canWrite && selectedIds.size > 0 && (
          <div className="flex-shrink-0 flex items-center gap-3 px-6 py-2.5 bg-blue-600/10 border-b border-blue-500/20">
            <span className="text-sm text-blue-300 font-medium">{selectedIds.size} selected</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none">
              <option value="">Set status...</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={bulkUpdate} disabled={!bulkStatus}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition-colors">
              Apply
            </button>
            <button onClick={bulkDelete} className="px-3 py-1 text-xs bg-red-600/80 text-white rounded hover:bg-red-600 transition-colors">
              Delete Selected
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-500 hover:text-slate-300 ml-1">Clear</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500">Loading...</div>
          ) : (
            <div className="space-y-2">
              {sorted.map(d => (
                <div
                  key={d.id}
                  onClick={() => { setSelectedDetection(prev => prev?.id === d.id ? null : d); setLogFireOpen(false); setLogFireOutcome(''); }}
                  className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-slate-600 ${
                    selectedDetection?.id === d.id
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : selectedIds.has(d.id)
                      ? 'border-blue-500/20 bg-blue-600/5'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={e => toggleSelect(d.id, e as any)}
                      className="accent-blue-500 mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-200">{d.name}</div>
                          {d.description && (
                            <div className="text-xs text-slate-500 truncate mt-0.5 max-w-xl">{d.description}</div>
                          )}
                        </div>
                        {canWrite && <div className="flex gap-1 flex-shrink-0">
                          <button onClick={e => openEdit(d, e)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded">Edit</button>
                          <button onClick={e => del(d.id, e)} className="px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-slate-800 rounded">Delete</button>
                        </div>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <StatusBadge value={d.status} variant="detection_status" />
                        <StatusBadge value={d.severity} variant="severity" />
                        {qualityScores.get(d.id) && (() => {
                          const qs = qualityScores.get(d.id)!;
                          return (
                            <span className={`px-1.5 py-0.5 text-xs font-semibold border rounded ${GRADE_COLORS[qs.grade]}`}
                              title={`Quality score: ${qs.score}/100`}>
                              {qs.grade} {qs.score}
                            </span>
                          );
                        })()}
                        {!d.last_fired_at && d.status === 'active' && (
                          <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded" title="No fires recorded — effectiveness unvalidated">
                            unvalidated
                          </span>
                        )}
                        {(() => {
                          const totalFires = d.true_positive_count + d.false_positive_count;
                          if (totalFires >= 5 && d.false_positive_count / totalFires > 0.3) {
                            return (
                              <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded"
                                title={`High false positive rate: ${d.false_positive_count}/${totalFires} fires`}>
                                high FP
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {(d.true_positive_count > 0 || d.false_positive_count > 0) && (
                          <span className="text-xs text-slate-500" title="True positive / False positive fires">
                            TP:{d.true_positive_count} FP:{d.false_positive_count}
                          </span>
                        )}
                        {d.rule_id && <span className="font-mono text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{d.rule_id}</span>}
                        {d.source && <span className="text-xs text-slate-500">{d.source}</span>}
                        <span className="text-xs text-slate-600">{d.confidence} confidence</span>
                      </div>
                      {d.technique_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {d.technique_ids.map(t => (
                            <span key={t} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded font-mono text-xs">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {sorted.length === 0 && (
                <div className="text-center py-16 text-slate-500">No detections found.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedDetection && (
        <div className="w-80 flex-shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto">
          <div className="px-4 py-4 border-b border-slate-800 flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <div className="text-sm font-semibold text-slate-200 leading-snug">{selectedDetection.name}</div>
              {selectedDetection.rule_id && (
                <div className="text-xs font-mono text-slate-500 mt-0.5">{selectedDetection.rule_id}</div>
              )}
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <StatusBadge value={selectedDetection.status} variant="detection_status" />
                <StatusBadge value={selectedDetection.severity} variant="severity" />
              </div>
            </div>
            <button onClick={() => setSelectedDetection(null)} className="text-slate-500 hover:text-slate-300 text-lg flex-shrink-0">×</button>
          </div>

          <div className="p-4 space-y-4">
            {qualityScores.get(selectedDetection.id) && (() => {
              const qs = qualityScores.get(selectedDetection.id)!;
              const barColor = qs.grade === 'A' ? 'bg-emerald-500' : qs.grade === 'B' ? 'bg-blue-500' : qs.grade === 'C' ? 'bg-yellow-500' : qs.grade === 'D' ? 'bg-orange-500' : 'bg-red-500';
              const rows: [string, number, number][] = [
                ['Severity', qs.components.severity, 25],
                ['Confidence', qs.components.confidence, 25],
                ['FP Rate', qs.components.fp_rate, 15],
                ['Test Results', qs.components.tests, 30],
                ['Uniqueness', qs.components.uniqueness, 5],
              ];
              return (
                <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">Detection Quality</span>
                    <span className={`px-2 py-0.5 text-sm font-bold border rounded ${GRADE_COLORS[qs.grade]}`}>{qs.grade} — {qs.score}/100</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mb-3">
                    <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${qs.score}%` }} />
                  </div>
                  <div className="space-y-1.5">
                    {rows.map(([label, val, max]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-1">
                          <div className={`h-1 rounded-full ${barColor} opacity-70`} style={{ width: `${(val / max) * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{val}/{max}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Effectiveness</span>
                {selectedDetection.last_reviewed_at && (
                  <span className="text-xs text-slate-500">reviewed {new Date(selectedDetection.last_reviewed_at).toLocaleDateString()}</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                {[['TP', selectedDetection.true_positive_count, 'text-emerald-400'],
                  ['FP', selectedDetection.false_positive_count, 'text-red-400'],
                  ['Sup', selectedDetection.suppressed_count, 'text-slate-400'],
                ].map(([label, count, color]) => (
                  <div key={label as string} className="bg-slate-900 rounded p-1.5">
                    <div className={`text-sm font-bold ${color}`}>{count as number}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
              {selectedDetection.last_fired_at ? (
                <div className="text-xs text-slate-500 mb-2">Last fired: {new Date(selectedDetection.last_fired_at).toLocaleDateString()}</div>
              ) : (
                <div className="text-xs text-yellow-500/80 mb-2">No fires recorded</div>
              )}
              {canWrite && !logFireOpen && (
                <div className="flex gap-1.5">
                  <button onClick={() => setLogFireOpen(true)}
                    className="flex-1 px-2 py-1 text-xs bg-slate-700 text-slate-300 border border-slate-600 rounded hover:bg-slate-600 transition-colors">
                    Log Fire Event
                  </button>
                  <button onClick={() => markReviewed(selectedDetection.id)}
                    className="px-2 py-1 text-xs bg-slate-700 text-slate-300 border border-slate-600 rounded hover:bg-slate-600 transition-colors">
                    Mark Reviewed
                  </button>
                </div>
              )}
              {canWrite && logFireOpen && (
                <div className="space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {(['true_positive', 'false_positive', 'suppressed'] as const).map(o => (
                      <label key={o} className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="fire_outcome" value={o}
                          checked={logFireOutcome === o}
                          onChange={() => setLogFireOutcome(o)}
                          className="accent-blue-500" />
                        <span className="text-xs text-slate-300">{o.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => logFire(selectedDetection.id)} disabled={!logFireOutcome || loggingFire}
                      className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 transition-colors">
                      {loggingFire ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => { setLogFireOpen(false); setLogFireOutcome(''); }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {selectedDetection.source && (
                <div>
                  <div className="text-slate-500 mb-0.5">Source</div>
                  <div className="text-slate-300">{selectedDetection.source}</div>
                </div>
              )}
              <div>
                <div className="text-slate-500 mb-0.5">Confidence</div>
                <div className="text-slate-300">{selectedDetection.confidence}</div>
              </div>
              {selectedDetection.false_positive_rate && (
                <div>
                  <div className="text-slate-500 mb-0.5">FP Rate</div>
                  <div className="text-slate-300">{selectedDetection.false_positive_rate}</div>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">ATT&CK Techniques ({selectedDetection.technique_ids.length})</div>
              {selectedDetection.technique_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedDetection.technique_ids.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded font-mono text-xs border border-blue-500/30">{t}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">None.</p>
              )}
            </div>

            {selectedDetection.description && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-1">Description</div>
                <p className="text-xs text-slate-400 leading-relaxed">{selectedDetection.description}</p>
              </div>
            )}

            {selectedDetection.notes && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-1">Notes</div>
                <p className="text-xs text-slate-400 leading-relaxed">{selectedDetection.notes}</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button
                onClick={e => openEdit(selectedDetection, e)}
                className="flex-1 px-3 py-2 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => openHistory(selectedDetection.id)}
                className="px-3 py-2 text-xs bg-slate-700 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors"
                title="View change history"
              >
                History
              </button>
              <button
                onClick={e => del(selectedDetection.id, e)}
                className="px-3 py-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editDetection ? 'Edit Detection' : 'Add Detection'} width="max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Rule ID</label>
            <input value={form.rule_id} onChange={e => setForm(f => ({ ...f, rule_id: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Source</label>
            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">Select source...</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {[{ key: 'status', opts: STATUSES, label: 'Status' }, { key: 'severity', opts: SEVERITIES, label: 'Severity' },
            { key: 'confidence', opts: CONFIDENCES, label: 'Confidence' }, { key: 'false_positive_rate', opts: FP_RATES, label: 'FP Rate' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
              <select value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500">
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">ATT&CK Techniques *</label>
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-2 border-b border-slate-700">
                <input value={techSearch} onChange={e => setTechSearch(e.target.value)} placeholder="Search techniques..."
                  className="w-full px-2 py-1 bg-slate-800 text-xs text-slate-300 rounded focus:outline-none" />
              </div>
              <div className="max-h-48 overflow-y-auto p-1 bg-slate-900">
                {filteredTechs.map(t => (
                  <label key={t.id} className={`flex items-center gap-2 py-1 rounded hover:bg-slate-800 cursor-pointer ${t.is_subtechnique ? 'pl-5 pr-2' : 'px-2'}`}>
                    <input type="checkbox" checked={form.technique_ids.includes(t.id)} onChange={() => toggleTechId(t.id)} className="accent-blue-500 flex-shrink-0" />
                    <span className={`font-mono text-xs flex-shrink-0 ${t.is_subtechnique ? 'text-slate-500 w-20' : 'text-slate-400 w-14'}`}>{t.id}</span>
                    <span className={`text-xs truncate ${t.is_subtechnique ? 'text-slate-400' : 'text-slate-300'}`}>{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.technique_ids.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.technique_ids.map(id => (
                  <span key={id} className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded font-mono text-xs border border-blue-500/30 flex items-center gap-1">
                    {id}<button onClick={() => toggleTechId(id)} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={save} disabled={saving || !form.name || form.technique_ids.length === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving...' : editDetection ? 'Save Changes' : 'Add Detection'}
          </button>
        </div>
      </Modal>

      <Modal open={importModalOpen} onClose={() => { setImportModalOpen(false); setSigmaPreview(null); }} title="Import Detections" width="max-w-2xl">
        <div className="flex gap-1 mb-4">
          {(['csv', 'sigma'] as const).map(tab => (
            <button key={tab} onClick={() => setImportTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${importTab === tab ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-slate-400 hover:bg-slate-800'}`}>
              {tab === 'csv' ? 'CSV Import' : 'SIGMA Rule'}
            </button>
          ))}
        </div>

        {importTab === 'csv' && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              CSV format: <span className="font-mono text-slate-300">name,rule_id,source,technique_ids,status,severity,confidence,notes</span>
              <br />Use semicolons to separate multiple technique IDs (e.g. <span className="font-mono">T1059;T1078</span>).
            </p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-600">
                Upload File
              </button>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </div>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
              placeholder="name,rule_id,source,technique_ids,status,severity,confidence,notes&#10;Suspicious PowerShell,PS-001,Microsoft Sentinel,T1059,active,high,high,Detects encoded PS"
              rows={7}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500 resize-none" />
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
              <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={handleImport} disabled={importing || !csvText.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors">
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        )}

        {importTab === 'sigma' && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Paste a SIGMA rule (YAML format). ATT&CK technique IDs are extracted from the <span className="font-mono text-slate-300">tags</span> field (e.g. <span className="font-mono">attack.t1059</span>).
            </p>
            <textarea value={sigmaText} onChange={e => { setSigmaText(e.target.value); setSigmaPreview(null); }}
              placeholder={'title: Suspicious PowerShell Execution\nid: abc123\nstatus: stable\nlevel: high\ntags:\n  - attack.t1059\n  - attack.t1059.001\ndescription: Detects suspicious PowerShell...'}
              rows={8}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500 resize-none" />
            {sigmaPreview && (
              <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-xs space-y-1.5">
                <div className="font-medium text-slate-200">{sigmaPreview.title ?? '(no title)'}</div>
                {sigmaPreview.rule_id && <div className="text-slate-500">ID: <span className="font-mono text-slate-400">{sigmaPreview.rule_id}</span></div>}
                <div className="flex gap-2">
                  <span className="text-slate-500">Severity:</span>
                  <span className="text-slate-300">{sigmaPreview.severity}</span>
                  <span className="text-slate-500 ml-2">Status:</span>
                  <span className="text-slate-300">{sigmaPreview.status}</span>
                </div>
                {sigmaPreview.technique_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sigmaPreview.technique_ids.map((id: string) => (
                      <span key={id} className="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded font-mono border border-blue-500/30">{id}</span>
                    ))}
                  </div>
                )}
                {sigmaPreview.unknown_technique_ids.length > 0 && (
                  <div className="text-orange-400">Unknown IDs (skipped): {sigmaPreview.unknown_technique_ids.join(', ')}</div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
              <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={parseSigmaPreview} disabled={!sigmaText.trim()}
                className="px-4 py-2 text-sm bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors">
                Preview
              </button>
              <button onClick={importSigma} disabled={importing || !sigmaText.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors">
                {importing ? 'Importing...' : 'Import Rule'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={historyOpen} onClose={() => { setHistoryOpen(false); setHistoryData(null); }} title="Detection Change History" width="max-w-2xl">
        {historyLoading && (
          <div className="flex items-center justify-center h-24 text-slate-500 text-sm">Loading history...</div>
        )}
        {!historyLoading && historyData && historyData.versions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 text-slate-500">
            <div className="text-sm">No version history yet.</div>
            <div className="text-xs mt-1 text-slate-600">History is recorded from the next save onward.</div>
          </div>
        )}
        {!historyLoading && historyData && historyData.versions.length > 0 && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {historyData.versions.map((v, idx) => (
              <div key={v.id} className="border border-slate-700 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">v{v.version_number}</span>
                    {idx === 0 && <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">current</span>}
                    <span className="text-xs text-slate-400">{v.change_summary ?? 'No summary'}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">{new Date(v.changed_at).toLocaleString()}</div>
                    <div className="text-xs text-slate-600">by {v.changed_by}</div>
                  </div>
                </div>
                {v.diff.length > 0 ? (
                  <div className="divide-y divide-slate-800">
                    {v.diff.map(d => (
                      <div key={d.field} className="px-3 py-2 grid grid-cols-[120px_1fr_1fr] gap-2 text-xs">
                        <span className="text-slate-500 font-medium truncate">{d.field}</span>
                        <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1 text-red-400 font-mono break-all">
                          {Array.isArray(d.from) ? (d.from as string[]).join(', ') || '—' : String(d.from ?? '—')}
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 text-emerald-400 font-mono break-all">
                          {Array.isArray(d.to) ? (d.to as string[]).join(', ') || '—' : String(d.to ?? '—')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-xs text-slate-600 italic">
                    {v.version_number === 1 ? 'Initial creation' : 'No tracked field changes'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
