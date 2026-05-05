import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Tool, ToolDetail, D3FendTechnique, Mitigation } from '../types';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

const CATEGORIES = ['EDR', 'SIEM', 'NDR', 'IAM', 'PAM', 'Email Security', 'NGFW', 'Vulnerability Management', 'DLP', 'SOAR', 'Other'];
const STATUSES = ['active', 'planned', 'deprecated'];

const EMPTY_FORM = {
  name: '', vendor: '', description: '', category: 'EDR', status: 'active' as Tool['status'],
  notes: '', d3fend_ids: [] as string[], mitigation_ids: [] as string[],
};

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [d3fendAll, setD3fendAll] = useState<D3FendTechnique[]>([]);
  const [mitigationsAll, setMitigationsAll] = useState<Mitigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<ToolDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTool, setEditTool] = useState<Tool | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [d3fendSearch, setD3fendSearch] = useState('');
  const [mitSearch, setMitSearch] = useState('');

  const load = () => api.getTools().then(setTools).finally(() => setLoading(false));

  useEffect(() => {
    load();
    api.getD3fendTechniques().then(setD3fendAll);
    api.getMitigations().then(setMitigationsAll);
  }, []);

  const openDetail = async (tool: Tool) => {
    const detail = await api.getTool(tool.id);
    setSelectedTool(detail);
  };

  const openCreate = () => { setEditTool(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEdit = async (tool: Tool) => {
    const detail = await api.getTool(tool.id);
    setEditTool(tool);
    setForm({
      name: tool.name, vendor: tool.vendor ?? '', description: tool.description ?? '',
      category: tool.category, status: tool.status, notes: tool.notes ?? '',
      d3fend_ids: detail.d3fend_techniques.map(d => d.id),
      mitigation_ids: detail.mitigations.map(m => m.id),
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editTool) {
        await api.updateTool(editTool.id, form);
      } else {
        await api.createTool(form);
      }
      setModalOpen(false);
      load();
      if (selectedTool && editTool && selectedTool.id === editTool.id) {
        const updated = await api.getTool(editTool.id);
        setSelectedTool(updated);
      }
    } finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this tool?')) return;
    await api.deleteTool(id);
    if (selectedTool?.id === id) setSelectedTool(null);
    load();
  };

  const toggleD3 = (id: string) => setForm(f => ({ ...f, d3fend_ids: f.d3fend_ids.includes(id) ? f.d3fend_ids.filter(x => x !== id) : [...f.d3fend_ids, id] }));
  const toggleMit = (id: string) => setForm(f => ({ ...f, mitigation_ids: f.mitigation_ids.includes(id) ? f.mitigation_ids.filter(x => x !== id) : [...f.mitigation_ids, id] }));

  const d3fendByCategory = d3fendAll.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = [];
    acc[d.category].push(d);
    return acc;
  }, {} as Record<string, D3FendTechnique[]>);

  const filteredD3 = d3fendAll.filter(d =>
    d.name.toLowerCase().includes(d3fendSearch.toLowerCase()) ||
    d.id.toLowerCase().includes(d3fendSearch.toLowerCase())
  );
  const filteredMit = mitigationsAll.filter(m =>
    m.name.toLowerCase().includes(mitSearch.toLowerCase()) ||
    m.id.toLowerCase().includes(mitSearch.toLowerCase())
  );

  const categoryColors: Record<string, string> = {
    EDR: 'text-blue-400', SIEM: 'text-purple-400', NDR: 'text-cyan-400', IAM: 'text-green-400',
    PAM: 'text-emerald-400', 'Email Security': 'text-yellow-400', NGFW: 'text-orange-400',
    'Vulnerability Management': 'text-red-400', DLP: 'text-pink-400', SOAR: 'text-indigo-400',
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Tools & Capabilities</h1>
              <p className="text-sm text-slate-400 mt-0.5">Security tooling inventory mapped to D3FEND and ATT&CK mitigations</p>
            </div>
            <button onClick={openCreate} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
              + Add Tool
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {tools.map(tool => (
                <div
                  key={tool.id}
                  onClick={() => openDetail(tool)}
                  className={`bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-slate-600 ${selectedTool?.id === tool.id ? 'border-blue-500/50 bg-blue-500/5' : 'border-slate-800'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200">{tool.name}</span>
                        {tool.vendor && <span className="text-xs text-slate-500">by {tool.vendor}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium ${categoryColors[tool.category] ?? 'text-slate-400'}`}>{tool.category}</span>
                        <StatusBadge value={tool.status} variant="tool_status" />
                      </div>
                      {tool.description && (
                        <p className="text-xs text-slate-500 mt-1.5 truncate max-w-xl">{tool.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-400">{tool.d3fend_count ?? 0}</div>
                        <div className="text-xs text-slate-500">D3FEND</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">{tool.mitigation_count ?? 0}</div>
                        <div className="text-xs text-slate-500">Mitigations</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={e => { e.stopPropagation(); openEdit(tool); }} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded">Edit</button>
                        <button onClick={e => { e.stopPropagation(); del(tool.id); }} className="px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-slate-800 rounded">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {tools.length === 0 && (
                <div className="text-center py-16 text-slate-500">No tools configured. Add your security tools to start tracking coverage.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedTool && (
        <div className="w-80 flex-shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto">
          <div className="px-4 py-4 border-b border-slate-800 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-200">{selectedTool.name}</div>
              {selectedTool.vendor && <div className="text-xs text-slate-500">{selectedTool.vendor}</div>}
              <div className="flex gap-2 mt-1">
                <span className={`text-xs font-medium ${categoryColors[selectedTool.category] ?? 'text-slate-400'}`}>{selectedTool.category}</span>
                <StatusBadge value={selectedTool.status} variant="tool_status" />
              </div>
            </div>
            <button onClick={() => setSelectedTool(null)} className="text-slate-500 hover:text-slate-300">×</button>
          </div>

          <div className="p-4 space-y-4">
            {selectedTool.description && (
              <p className="text-xs text-slate-400">{selectedTool.description}</p>
            )}

            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">D3FEND Countermeasures ({selectedTool.d3fend_techniques.length})</div>
              {selectedTool.d3fend_techniques.length === 0 ? (
                <p className="text-xs text-slate-500">None configured.</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(
                    selectedTool.d3fend_techniques.reduce((acc, d) => {
                      if (!acc[d.category]) acc[d.category] = [];
                      acc[d.category].push(d);
                      return acc;
                    }, {} as Record<string, D3FendTechnique[]>)
                  ).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="text-xs text-slate-500 mt-2 mb-1">{cat}</div>
                      {items.map(d => (
                        <div key={d.id} className="flex items-center gap-2 py-1">
                          <span className="font-mono text-xs text-slate-500 w-16 flex-shrink-0">{d.id}</span>
                          <span className="text-xs text-slate-300">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">ATT&CK Mitigations ({selectedTool.mitigations.length})</div>
              {selectedTool.mitigations.length === 0 ? (
                <p className="text-xs text-slate-500">None configured.</p>
              ) : (
                <div className="space-y-1">
                  {selectedTool.mitigations.map(m => (
                    <div key={m.id} className="flex items-start gap-2 py-1">
                      <span className="font-mono text-xs text-slate-500 w-12 flex-shrink-0">{m.id}</span>
                      <span className="text-xs text-slate-300">{m.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTool ? 'Edit Tool' : 'Add Tool'} width="max-w-4xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Vendor</label>
            <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Tool['status'] }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">D3FEND Techniques ({form.d3fend_ids.length} selected)</label>
            <input value={d3fendSearch} onChange={e => setD3fendSearch(e.target.value)} placeholder="Filter..."
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 mb-1 focus:outline-none" />
            <div className="border border-slate-700 rounded-lg max-h-48 overflow-y-auto bg-slate-900">
              {filteredD3.map(d => (
                <label key={d.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50">
                  <input type="checkbox" checked={form.d3fend_ids.includes(d.id)} onChange={() => toggleD3(d.id)} className="accent-blue-500 flex-shrink-0" />
                  <span className="font-mono text-xs text-slate-500 w-14 flex-shrink-0">{d.id}</span>
                  <span className="text-xs text-slate-300 truncate">{d.name}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0">{d.category}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">ATT&CK Mitigations ({form.mitigation_ids.length} selected)</label>
            <input value={mitSearch} onChange={e => setMitSearch(e.target.value)} placeholder="Filter..."
              className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 mb-1 focus:outline-none" />
            <div className="border border-slate-700 rounded-lg max-h-48 overflow-y-auto bg-slate-900">
              {filteredMit.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50">
                  <input type="checkbox" checked={form.mitigation_ids.includes(m.id)} onChange={() => toggleMit(m.id)} className="accent-purple-500 flex-shrink-0" />
                  <span className="font-mono text-xs text-slate-500 w-12 flex-shrink-0">{m.id}</span>
                  <span className="text-xs text-slate-300 truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
          <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={save} disabled={saving || !form.name}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : editTool ? 'Save Changes' : 'Add Tool'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
