import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import type { Detection, Technique } from '../types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

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
  const [detections, setDetections] = useState<Detection[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');
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
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.getDetections({ status: filterStatus || undefined, severity: filterSeverity || undefined, source: filterSource || undefined })
    .then(setDetections).finally(() => setLoading(false));

  useEffect(() => { load(); }, [filterStatus, filterSeverity, filterSource]);
  useEffect(() => { api.getTechniques().then(setTechniques); }, []);

  const openCreate = () => { setEditDetection(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEdit = (d: Detection) => {
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
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this detection?')) return;
    await api.deleteDetection(id);
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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(displayed.length === selectedIds.size ? new Set() : new Set(displayed.map(d => d.id)));
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
    load();
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
  ).slice(0, 30);

  const displayed = detections.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.rule_id?.toLowerCase().includes(q) ||
      d.technique_ids.some(t => t.toLowerCase().includes(q));
  });

  const sources = [...new Set(detections.map(d => d.source).filter(Boolean))];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">SIEM Detections</h1>
            <p className="text-sm text-slate-400 mt-0.5">{detections.length} detections mapped to ATT&CK techniques</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setImportModalOpen(true)} className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors">
              Import CSV
            </button>
            <button onClick={openCreate} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
              + Add Detection
            </button>
          </div>
        </div>
        <div className="flex gap-3 mt-3">
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
        </div>
      </div>

      {selectedIds.size > 0 && (
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">
                  <input type="checkbox" checked={displayed.length > 0 && selectedIds.size === displayed.length}
                    onChange={selectAll} className="accent-blue-500" />
                </th>
                {['Name', 'Rule ID', 'Source', 'Technique(s)', 'Status', 'Severity', 'Confidence', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(d => (
                <tr key={d.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${selectedIds.has(d.id) ? 'bg-blue-600/5' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} className="accent-blue-500" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{d.name}</div>
                    {d.description && <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{d.description}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{d.rule_id ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{d.source ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.technique_ids.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded font-mono text-xs">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={d.status} variant="detection_status" /></td>
                  <td className="px-4 py-3"><StatusBadge value={d.severity} variant="severity" /></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{d.confidence}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(d)} className="text-xs text-slate-400 hover:text-slate-200">Edit</button>
                      <button onClick={() => del(d.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No detections found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
              <div className="max-h-36 overflow-y-auto p-1 bg-slate-900">
                {filteredTechs.map(t => (
                  <label key={t.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800 cursor-pointer">
                    <input type="checkbox" checked={form.technique_ids.includes(t.id)} onChange={() => toggleTechId(t.id)} className="accent-blue-500" />
                    <span className="font-mono text-xs text-slate-400 w-14 flex-shrink-0">{t.id}</span>
                    <span className="text-xs text-slate-300 truncate">{t.name}</span>
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
    </div>
  );
}
