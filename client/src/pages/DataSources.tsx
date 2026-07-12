import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DataSource, Technique } from '../types';

const STATUS_LABELS: Record<string, string> = {
  collecting: 'Collecting',
  partial: 'Partial',
  not_collecting: 'Not Collecting',
};

const STATUS_COLORS: Record<string, string> = {
  collecting: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  partial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  not_collecting: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-300 dark:border-slate-700',
};

const BLANK_FORM = { name: '', category: '', description: '' };

interface TechniqueRow {
  id: string;
  name: string;
  has_detection: number;
}

export default function DataSources() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Expand / technique drill-down
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [techniques, setTechniques] = useState<Record<number, TechniqueRow[]>>({});
  const [loadingTech, setLoadingTech] = useState<number | null>(null);

  // Create / Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editSource, setEditSource] = useState<DataSource | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Org settings inline edit
  const [editingStatus, setEditingStatus] = useState<number | null>(null);
  const [statusForm, setStatusForm] = useState({ status: '', collection_method: '', notes: '' });
  const [savingStatus, setSavingStatus] = useState(false);

  // Technique management
  const [allTechniques, setAllTechniques] = useState<Technique[]>([]);
  const [techPickerOpen, setTechPickerOpen] = useState<number | null>(null);
  const [techPickerSearch, setTechPickerSearch] = useState('');
  const [addingTech, setAddingTech] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => api.getDataSources().then(setSources).finally(() => setLoading(false));

  useEffect(() => {
    load();
    api.getTechniques().then(setAllTechniques);
  }, []);

  const categories = [...new Set(sources.map(s => s.category))].sort();
  const filtered = sources.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())) &&
    (!categoryFilter || s.category === categoryFilter) &&
    (!statusFilter || (s.org_status ?? 'not_collecting') === statusFilter)
  );

  const stats = {
    collecting: sources.filter(s => s.org_status === 'collecting').length,
    partial: sources.filter(s => s.org_status === 'partial').length,
    not_collecting: sources.filter(s => !s.org_status || s.org_status === 'not_collecting').length,
  };

  async function toggleExpand(source: DataSource) {
    if (expandedId === source.id) { setExpandedId(null); return; }
    setExpandedId(source.id);
    if (!techniques[source.id]) {
      setLoadingTech(source.id);
      try {
        const techs = await api.getDataSourceTechniques(source.id);
        setTechniques(prev => ({ ...prev, [source.id]: techs }));
      } finally { setLoadingTech(null); }
    }
  }

  function openCreate() {
    setEditSource(null);
    setForm(BLANK_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(source: DataSource) {
    setEditSource(source);
    setForm({ name: source.name, category: source.category, description: source.description ?? '' });
    setFormError('');
    setShowForm(true);
  }

  async function saveForm() {
    if (!form.name.trim() || !form.category.trim()) { setFormError('Name and category are required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editSource) {
        await api.updateDataSource(editSource.id, form);
      } else {
        await api.createDataSource(form);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setFormError(e.message ?? 'Save failed');
    } finally { setSaving(false); }
  }

  async function doDelete(id: number) {
    setDeletingId(null);
    await api.deleteDataSource(id);
    setSources(prev => prev.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function openStatusEdit(source: DataSource) {
    setEditingStatus(source.id);
    setStatusForm({
      status: source.org_status ?? 'not_collecting',
      collection_method: source.collection_method ?? '',
      notes: source.org_notes ?? '',
    });
  }

  async function addTechnique(sourceId: number, techniqueId: string) {
    setAddingTech(true);
    try {
      await api.addDataSourceTechnique(sourceId, techniqueId);
      const techs = await api.getDataSourceTechniques(sourceId);
      setTechniques(prev => ({ ...prev, [sourceId]: techs }));
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, technique_count: techs.length } : s));
      setTechPickerSearch('');
    } finally { setAddingTech(false); }
  }

  async function removeTechnique(sourceId: number, techniqueId: string) {
    await api.removeDataSourceTechnique(sourceId, techniqueId);
    const techs = await api.getDataSourceTechniques(sourceId);
    setTechniques(prev => ({ ...prev, [sourceId]: techs }));
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, technique_count: techs.length } : s));
  }

  async function saveStatus(id: number) {
    setSavingStatus(true);
    try {
      const updated = await api.updateDataSourceStatus(id, {
        status: statusForm.status || undefined,
        collection_method: statusForm.collection_method || undefined,
        notes: statusForm.notes || undefined,
      });
      setSources(prev => prev.map(s => s.id === id ? { ...s, ...(updated as any) } : s));
      setEditingStatus(null);
    } finally { setSavingStatus(false); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-command-header">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">ATT&CK Data Sources</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Track which log sources your organization collects and their technique coverage.
            </p>
          </div>
          <button onClick={openCreate}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex-shrink-0">
            + Add Data Source
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Collecting', count: stats.collecting, color: 'text-emerald-400' },
            { label: 'Partial', count: stats.partial, color: 'text-yellow-400' },
            { label: 'Not Collecting', count: stats.not_collecting, color: 'text-gray-500 dark:text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-100/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-lg px-4 py-2.5">
              <div className={`text-xl font-bold ${s.color}`}>{s.count}</div>
              <div className="text-gray-400 dark:text-slate-500 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mt-3">
          <input
            className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            placeholder="Search data sources…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-slate-300 text-sm focus:outline-none focus:border-blue-500"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-slate-300 text-sm focus:outline-none focus:border-blue-500"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="collecting">Collecting</option>
            <option value="partial">Partial</option>
            <option value="not_collecting">Not Collecting</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500">Loading…</div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(source => {
              const status = source.org_status ?? 'not_collecting';
              const isExpanded = expandedId === source.id;
              const isEditingStatus = editingStatus === source.id;
              const sourceTechs = techniques[source.id];

              return (
                <div key={source.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {/* Row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleExpand(source)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <svg className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 dark:text-slate-200">{source.name}</div>
                        {source.description && <div className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{source.description}</div>}
                      </div>
                    </button>

                    <span className="text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded flex-shrink-0">
                      {source.category}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 w-20 text-center flex-shrink-0">
                      {source.technique_count} technique{Number(source.technique_count) !== 1 ? 's' : ''}
                    </span>

                    <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium flex-shrink-0 ${STATUS_COLORS[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>

                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openStatusEdit(source)}
                        className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:bg-slate-800 rounded transition-colors">
                        Status
                      </button>
                      <button onClick={() => openEdit(source)}
                        className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:bg-slate-800 rounded transition-colors">
                        Edit
                      </button>
                      <button onClick={() => setDeletingId(source.id)}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Inline status editor */}
                  {isEditingStatus && (
                    <div className="px-4 pb-4 border-t border-gray-200 dark:border-slate-800 pt-3 bg-gray-100/30 dark:bg-slate-800/30">
                      <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-3">Edit Collection Status</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">Status</label>
                          <select value={statusForm.status} onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                            <option value="collecting">Collecting</option>
                            <option value="partial">Partial</option>
                            <option value="not_collecting">Not Collecting</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">Collection Method</label>
                          <input value={statusForm.collection_method} onChange={e => setStatusForm(f => ({ ...f, collection_method: e.target.value }))}
                            placeholder="e.g. Sysmon, CrowdStrike"
                            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">Notes</label>
                          <input value={statusForm.notes} onChange={e => setStatusForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Optional notes"
                            className="w-full px-2 py-1.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => saveStatus(source.id)} disabled={savingStatus}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors">
                          {savingStatus ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingStatus(null)}
                          className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Techniques panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950/40">
                      {loadingTech === source.id ? (
                        <div className="px-5 py-4 text-xs text-gray-400 dark:text-slate-500">Loading techniques…</div>
                      ) : (
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">
                              {(sourceTechs?.length ?? 0)} associated technique{(sourceTechs?.length ?? 0) !== 1 ? 's' : ''}
                            </div>
                            <button
                              onClick={() => { setTechPickerOpen(techPickerOpen === source.id ? null : source.id); setTechPickerSearch(''); }}
                              className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-600/10 border border-blue-500/20 rounded hover:bg-blue-600/20 transition-colors">
                              + Add Technique
                            </button>
                          </div>

                          {techPickerOpen === source.id && (
                            <div className="mb-3 border border-gray-300 dark:border-slate-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-900">
                              <input
                                value={techPickerSearch}
                                onChange={e => setTechPickerSearch(e.target.value)}
                                placeholder="Search techniques to add…"
                                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 text-xs text-gray-700 dark:text-slate-300 focus:outline-none border-b border-gray-300 dark:border-slate-700"
                                autoFocus
                              />
                              <div className="max-h-40 overflow-y-auto">
                                {allTechniques
                                  .filter(t =>
                                    !sourceTechs?.some(st => st.id === t.id) &&
                                    (t.id.toLowerCase().includes(techPickerSearch.toLowerCase()) ||
                                     t.name.toLowerCase().includes(techPickerSearch.toLowerCase()))
                                  )
                                  .slice(0, 20)
                                  .map(t => (
                                    <button
                                      key={t.id}
                                      disabled={addingTech}
                                      onClick={() => addTechnique(source.id, t.id)}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:bg-slate-800 text-left transition-colors disabled:opacity-50"
                                    >
                                      <span className="font-mono text-xs text-blue-400 w-16 flex-shrink-0">{t.id}</span>
                                      <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{t.name}</span>
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}

                          {sourceTechs?.length ? (
                            <>
                              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                                {sourceTechs.map(t => (
                                  <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 group">
                                    <span className="font-mono text-xs text-blue-400 flex-shrink-0">{t.id}</span>
                                    <span className="text-xs text-gray-700 dark:text-slate-300 truncate flex-1">{t.name}</span>
                                    <span className={`text-xs flex-shrink-0 ${t.has_detection ? 'text-emerald-400' : 'text-gray-400 dark:text-slate-600'}`}>
                                      {t.has_detection ? '◉' : '○'}
                                    </span>
                                    <button
                                      onClick={() => removeTechnique(source.id, t.id)}
                                      className="text-gray-400 dark:text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-all text-xs leading-none"
                                      title="Remove technique"
                                    >×</button>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 dark:text-slate-600 mt-2">◉ = has active detection · hover to remove</p>
                            </>
                          ) : (
                            <div className="text-xs text-gray-400 dark:text-slate-500 py-2">No techniques mapped. Click "Add Technique" above.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center text-gray-400 dark:text-slate-500 py-12 text-sm">No data sources match your filters</div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editSource ? 'Edit Data Source' : 'Create Data Source'}
            </h2>
            {formError && (
              <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Windows Event Logs"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Category</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Windows, Network, Cloud"
                  list="category-suggestions"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                <datalist id="category-suggestions">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Description <span className="text-gray-400 dark:text-slate-600">(optional)</span></label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of this data source"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 transition-colors">Cancel</button>
              <button onClick={saveForm} disabled={saving || !form.name.trim() || !form.category.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editSource ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">Delete Data Source</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Permanently delete <span className="text-gray-800 dark:text-slate-200 font-medium">
                {sources.find(s => s.id === deletingId)?.name}
              </span>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeletingId(null)}
                className="px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 transition-colors">Cancel</button>
              <button onClick={() => doDelete(deletingId!)}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
