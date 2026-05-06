import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ThreatGroup, Technique } from '../types';

const MOTIVATION_COLOR: Record<string, string> = {
  Espionage: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Financial: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Espionage, Financial': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'Destructive, Espionage': 'text-red-400 bg-red-500/10 border-red-500/20',
  Destructive: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const COUNTRY_FLAG: Record<string, string> = {
  Russia: '🇷🇺', China: '🇨🇳', 'North Korea': '🇰🇵', Iran: '🇮🇷', Vietnam: '🇻🇳',
};

const BLANK_FORM = {
  id: '', name: '', country: '', motivation: '', description: '', url: '', aliases: '',
};

interface GroupDetail {
  techniques: any[];
  coverage: { total: number; covered: number; pct: number; details: any[] };
}

interface GroupFormData {
  id: string; name: string; country: string; motivation: string;
  description: string; url: string; aliases: string;
}

export default function ThreatGroups() {
  const [groups, setGroups] = useState<ThreatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterMotivation, setFilterMotivation] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState<ThreatGroup | null>(null);
  const [form, setForm] = useState<GroupFormData>(BLANK_FORM);
  const [techSearch, setTechSearch] = useState('');
  const [allTechniques, setAllTechniques] = useState<Technique[]>([]);
  const [selectedTechIds, setSelectedTechIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ThreatGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const loadGroups = () => api.getThreatGroups().then(setGroups).finally(() => setLoading(false));

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => { api.getTechniques().then(setAllTechniques); }, []);

  const loadDetail = async (id: string) => {
    if (selected === id) { setSelected(null); setDetail(null); return; }
    setSelected(id);
    setDetailLoading(true);
    try {
      const d = await api.getThreatGroup(id);
      setDetail(d as any);
    } finally { setDetailLoading(false); }
  };

  const openCreate = () => {
    setEditGroup(null);
    setForm(BLANK_FORM);
    setSelectedTechIds(new Set());
    setError('');
    setShowModal(true);
  };

  const openEdit = (g: ThreatGroup) => {
    setEditGroup(g);
    setForm({
      id: g.id,
      name: g.name,
      country: g.country ?? '',
      motivation: g.motivation ?? '',
      description: g.description ?? '',
      url: g.url ?? '',
      aliases: g.aliases.join(', '),
    });
    api.getThreatGroup(g.id).then(d => {
      setSelectedTechIds(new Set((d as any).techniques?.map((t: any) => t.id) ?? []));
    });
    setError('');
    setShowModal(true);
  };

  const saveGroup = async () => {
    if (!form.id.trim() || !form.name.trim()) { setError('ID and Name are required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        id: form.id.trim().toUpperCase(),
        name: form.name.trim(),
        country: form.country.trim() || null,
        motivation: form.motivation.trim() || null,
        description: form.description.trim() || null,
        url: form.url.trim() || null,
        aliases: form.aliases.split(',').map(a => a.trim()).filter(Boolean),
        technique_ids: Array.from(selectedTechIds),
      };
      if (editGroup) {
        await api.updateThreatGroup(editGroup.id, payload);
      } else {
        await api.createThreatGroup(payload);
      }
      setShowModal(false);
      setSelected(null);
      setDetail(null);
      await loadGroups();
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await api.deleteThreatGroup(deleteConfirm.id);
      setDeleteConfirm(null);
      if (selected === deleteConfirm.id) { setSelected(null); setDetail(null); }
      await loadGroups();
    } finally { setDeleting(false); }
  };

  const toggleTech = (id: string) => {
    setSelectedTechIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const motivations = [...new Set(groups.map(g => g.motivation).filter(Boolean))] as string[];
  const countries = [...new Set(groups.map(g => g.country).filter(Boolean))] as string[];

  const filtered = groups.filter(g => {
    if (filterMotivation && g.motivation !== filterMotivation) return false;
    if (filterCountry && g.country !== filterCountry) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.aliases.some(a => a.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredTechs = allTechniques.filter(t =>
    !techSearch || t.id.toLowerCase().includes(techSearch.toLowerCase()) || t.name.toLowerCase().includes(techSearch.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading threat groups...</div>;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Threat Groups</h1>
              <p className="text-sm text-slate-400 mt-0.5">{groups.length} tracked APT and cybercriminal groups with detection coverage</p>
            </div>
            <button onClick={openCreate}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-1.5">
              + Add Group
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups, aliases..."
              className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <select value={filterMotivation} onChange={e => setFilterMotivation(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Motivations</option>
              {motivations.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{COUNTRY_FLAG[c] ?? ''} {c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className={`overflow-y-auto ${selected ? 'w-1/2' : 'w-full'} transition-all`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
                <tr>
                  {['Group', 'Aliases', 'Origin', 'Motivation', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id}
                    onClick={() => loadDetail(g.id)}
                    className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer ${selected === g.id ? 'bg-blue-600/10' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{g.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{g.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.aliases.slice(0, 2).map(a => (
                          <span key={a} className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{a}</span>
                        ))}
                        {g.aliases.length > 2 && <span className="text-xs text-slate-600">+{g.aliases.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {g.country ? `${COUNTRY_FLAG[g.country] ?? ''} ${g.country}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.motivation && (
                        <span className={`text-xs px-2 py-0.5 rounded border ${MOTIVATION_COLOR[g.motivation] ?? 'text-slate-400 bg-slate-700 border-slate-600'}`}>
                          {g.motivation}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(g)}
                          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700">Edit</button>
                        <button onClick={() => setDeleteConfirm(g)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10">Delete</button>
                        <span className="text-xs text-blue-400">{selected === g.id ? '▶' : '›'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No groups match filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="w-1/2 border-l border-slate-800 overflow-y-auto bg-slate-900/30">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-500">Loading...</div>
              ) : detail ? (
                <GroupDetailPane
                  group={groups.find(g => g.id === selected)!}
                  detail={detail}
                  onClose={() => { setSelected(null); setDetail(null); }}
                  onEdit={() => openEdit(groups.find(g => g.id === selected)!)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <GroupModal
          form={form}
          setForm={setForm}
          isEdit={!!editGroup}
          saving={saving}
          error={error}
          techSearch={techSearch}
          setTechSearch={setTechSearch}
          filteredTechs={filteredTechs}
          selectedTechIds={selectedTechIds}
          toggleTech={toggleTech}
          onSave={saveGroup}
          onClose={() => setShowModal(false)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-slate-100 mb-2">Delete Threat Group</h2>
            <p className="text-sm text-slate-400 mb-4">
              Delete <span className="font-medium text-slate-200">{deleteConfirm.name}</span>? This will remove all technique associations.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupModal({
  form, setForm, isEdit, saving, error, techSearch, setTechSearch,
  filteredTechs, selectedTechIds, toggleTech, onSave, onClose,
}: {
  form: any; setForm: any; isEdit: boolean; saving: boolean; error: string;
  techSearch: string; setTechSearch: (v: string) => void;
  filteredTechs: Technique[]; selectedTechIds: Set<string>;
  toggleTech: (id: string) => void; onSave: () => void; onClose: () => void;
}) {
  const f = (field: string, val: string) => setForm((p: any) => ({ ...p, [field]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-100">{isEdit ? 'Edit Threat Group' : 'Add Threat Group'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Group ID <span className="text-red-400">*</span></label>
              <input value={form.id} onChange={e => f('id', e.target.value)} placeholder="e.g. G0016"
                disabled={isEdit}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Name <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. APT29"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Country / Origin</label>
              <input value={form.country} onChange={e => f('country', e.target.value)} placeholder="e.g. Russia"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Motivation</label>
              <input value={form.motivation} onChange={e => f('motivation', e.target.value)} placeholder="e.g. Espionage"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 block mb-1">Aliases <span className="text-slate-600">(comma-separated)</span></label>
              <input value={form.aliases} onChange={e => f('aliases', e.target.value)} placeholder="Cozy Bear, Midnight Blizzard"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 block mb-1">MITRE ATT&CK URL</label>
              <input value={form.url} onChange={e => f('url', e.target.value)} placeholder="https://attack.mitre.org/groups/G0016/"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-400 block mb-1">Description</label>
              <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300">
                Associated Techniques <span className="text-slate-500">({selectedTechIds.size} selected)</span>
              </label>
            </div>
            <input value={techSearch} onChange={e => setTechSearch(e.target.value)} placeholder="Search by ID or name..."
              className="w-full px-3 py-1.5 mb-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <div className="border border-slate-700 rounded-lg overflow-y-auto max-h-44 bg-slate-800/50">
              {filteredTechs.slice(0, 200).map(t => (
                <label key={t.id}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-700/50 ${selectedTechIds.has(t.id) ? 'bg-blue-600/10' : ''}`}>
                  <input type="checkbox" checked={selectedTechIds.has(t.id)} onChange={() => toggleTech(t.id)}
                    className="accent-blue-500" />
                  <span className="font-mono text-xs text-slate-400 w-14 flex-shrink-0">{t.id}</span>
                  <span className="text-xs text-slate-300 truncate">{t.name}</span>
                </label>
              ))}
              {filteredTechs.length === 0 && (
                <div className="px-3 py-4 text-xs text-slate-500 text-center">No techniques match.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={onSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupDetailPane({ group, detail, onClose, onEdit }: {
  group: ThreatGroup; detail: GroupDetail; onClose: () => void; onEdit: () => void;
}) {
  const { coverage } = detail;
  const exposed = coverage.details.filter(t => !t.detected);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">{group.name}</h2>
          <div className="text-xs text-slate-400 mt-0.5">{group.id} · {group.country} · {group.motivation}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit}
            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10">Edit</button>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">×</button>
        </div>
      </div>

      {group.description && <p className="text-xs text-slate-400 leading-relaxed">{group.description}</p>}

      <div className="flex gap-2 flex-wrap">
        {group.aliases.map(a => (
          <span key={a} className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">{a}</span>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-xs font-medium text-slate-400 mb-2">Detection Coverage</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-2xl font-bold ${coverage.pct >= 60 ? 'text-emerald-400' : coverage.pct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {coverage.pct}%
          </span>
          <span className="text-xs text-slate-500">{coverage.covered}/{coverage.total} techniques detected</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${coverage.pct}%` }} />
        </div>
        {exposed.length > 0 && (
          <div className="mt-2 text-xs text-red-400">{exposed.length} techniques not detected</div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Technique Coverage</div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {coverage.details.map(t => (
            <div key={t.technique_id} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.detected ? 'bg-emerald-400' : 'bg-red-500'}`} />
              <span className="font-mono text-slate-500 w-14">{t.technique_id}</span>
              <span className={t.detected ? 'text-slate-300' : 'text-slate-500'}>{t.technique_name}</span>
              {!t.detected && <span className="ml-auto text-red-400 text-xs">EXPOSED</span>}
            </div>
          ))}
        </div>
      </div>

      {group.url && (
        <a href={group.url} target="_blank" rel="noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          View on MITRE ATT&CK ↗
        </a>
      )}
    </div>
  );
}
