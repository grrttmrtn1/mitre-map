import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Country, Motivation, Procedure, ProcedureType, ThreatGroup, Technique } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonRow } from '../components/Skeleton';

const BLANK_FORM = {
  id: '', name: '', country: '', motivation: '', description: '', url: '', aliases: '', targeted_sectors: [] as string[],
};

const SECTORS = [
  'Financial', 'Healthcare', 'Energy', 'Government', 'Defense', 'Technology',
  'Retail', 'Manufacturing', 'Education', 'Transportation', 'Telecommunications', 'Media',
];

interface GroupDetail {
  techniques: any[];
  coverage: { total: number; covered: number; pct: number; details: any[] };
}

interface GroupFormData {
  id: string; name: string; country: string; motivation: string;
  description: string; url: string; aliases: string; targeted_sectors: string[];
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

  const [motivationOptions, setMotivationOptions] = useState<Motivation[]>([]);
  const [countryOptions, setCountryOptions] = useState<Country[]>([]);
  const [existingProcedures, setExistingProcedures] = useState<Procedure[]>([]);
  const [pendingProcedures, setPendingProcedures] = useState<Array<{technique_id: string; type: ProcedureType; content: string; source: string}>>([]);
  const [deletedProcedureIds, setDeletedProcedureIds] = useState<number[]>([]);

  const loadGroups = () => api.getThreatGroups().then(setGroups).finally(() => setLoading(false));

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => { api.getTechniques(undefined, true).then(setAllTechniques); }, []);
  useEffect(() => { api.getMotivations().then(setMotivationOptions); }, []);
  useEffect(() => { api.getCountries().then(setCountryOptions); }, []);

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
    setExistingProcedures([]);
    setPendingProcedures([]);
    setDeletedProcedureIds([]);
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
      targeted_sectors: g.targeted_sectors ?? [],
    });
    api.getThreatGroup(g.id).then(d => {
      setSelectedTechIds(new Set((d as any).techniques?.map((t: any) => t.id) ?? []));
    });
    api.getGroupProcedures(g.id).then(setExistingProcedures).catch(() => setExistingProcedures([]));
    setPendingProcedures([]);
    setDeletedProcedureIds([]);
    setError('');
    setShowModal(true);
  };

  const saveGroup = async () => {
    if (!form.id.trim() || !form.name.trim()) { setError('ID and Name are required'); return; }
    setSaving(true);
    setError('');
    try {
      const savedId = form.id.trim().toUpperCase();
      const payload = {
        id: savedId,
        name: form.name.trim(),
        country: form.country.trim() || null,
        motivation: form.motivation.trim() || null,
        description: form.description.trim() || null,
        url: form.url.trim() || null,
        aliases: form.aliases.split(',').map(a => a.trim()).filter(Boolean),
        technique_ids: Array.from(selectedTechIds),
        targeted_sectors: form.targeted_sectors,
      };
      if (editGroup) {
        await api.updateThreatGroup(editGroup.id, payload);
        for (const id of deletedProcedureIds) {
          await api.deleteProcedure(editGroup.id, id).catch(() => {});
        }
      } else {
        await api.createThreatGroup(payload);
      }
      for (const p of pendingProcedures) {
        await api.createProcedure(savedId, p.technique_id, { type: p.type, content: p.content, source: p.source || undefined }).catch(() => {});
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

  const countryMap = Object.fromEntries(countryOptions.map(c => [c.name, c]));
  const motivationMap = Object.fromEntries(motivationOptions.map(m => [m.name, m]));

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

  if (loading) return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="h-6 w-40 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-3.5 w-56 bg-gray-100/60 dark:bg-slate-800/60 rounded animate-pulse mt-2" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonRow key={i} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Threat Groups</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{filtered.length === groups.length ? groups.length : `${filtered.length} of ${groups.length}`} tracked APT and cybercriminal groups</p>
            </div>
            <button onClick={openCreate}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-1.5">
              + Add Group
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups, aliases..."
              className="flex-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <select value={filterMotivation} onChange={e => setFilterMotivation(e.target.value)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Motivations</option>
              {motivations.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{countryMap[c]?.flag ?? ''} {c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className={`overflow-y-auto ${selected ? 'w-1/2' : 'w-full'} transition-all`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  {['Group', 'Aliases', 'Origin', 'Motivation', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id}
                    onClick={() => loadDetail(g.id)}
                    className={`border-b border-gray-200 dark:border-slate-800/60 hover:bg-gray-100/30 dark:bg-slate-800/30 transition-colors cursor-pointer ${selected === g.id ? 'bg-blue-600/10' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 dark:text-slate-200">{g.name}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">{g.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.aliases.slice(0, 2).map(a => (
                          <span key={a} className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{a}</span>
                        ))}
                        {g.aliases.length > 2 && <span className="text-xs text-gray-400 dark:text-slate-600">+{g.aliases.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-sm">
                      {g.country ? (
                        <span className="flex items-center gap-1.5">
                          {countryMap[g.country]?.flag && <span>{countryMap[g.country].flag}</span>}
                          <span style={countryMap[g.country] ? { color: countryMap[g.country].color } : undefined}>{g.country}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.motivation && (() => {
                        const mot = motivationMap[g.motivation];
                        return mot ? (
                          <span className="text-xs px-2 py-0.5 rounded border font-medium"
                            style={{ color: mot.color, borderColor: mot.color + '40', backgroundColor: mot.color + '18' }}>
                            {g.motivation}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded border text-gray-500 dark:text-slate-400 bg-gray-200 dark:bg-slate-700 border-gray-400 dark:border-slate-600">
                            {g.motivation}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(g)}
                          className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 px-2 py-1 rounded hover:bg-gray-200 dark:bg-slate-700">Edit</button>
                        <button onClick={() => setDeleteConfirm(g)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10">Delete</button>
                        <span className="text-xs text-blue-400">{selected === g.id ? '▶' : '›'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                        </svg>
                        <p className="text-sm text-gray-400 dark:text-slate-500">No groups match filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="w-1/2 border-l border-gray-200 dark:border-slate-800 overflow-y-auto bg-gray-50 dark:bg-slate-900/30">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500">Loading...</div>
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
          allTechniques={allTechniques}
          selectedTechIds={selectedTechIds}
          toggleTech={toggleTech}
          motivations={motivationOptions}
          countries={countryOptions}
          existingProcedures={existingProcedures}
          onDeleteExistingProcedure={id => setDeletedProcedureIds(prev => [...prev, id])}
          pendingProcedures={pendingProcedures}
          onAddPendingProcedure={p => setPendingProcedures(prev => [...prev, p])}
          onRemovePendingProcedure={idx => setPendingProcedures(prev => prev.filter((_, i) => i !== idx))}
          deletedProcedureIds={deletedProcedureIds}
          onSave={saveGroup}
          onClose={() => setShowModal(false)}
        />
      )}

      <ConfirmModal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Threat Group"
        message={`Delete "${deleteConfirm?.name}"? This will remove all technique associations.`}
        confirmLabel="Delete"
        destructive
        confirming={deleting}
      />
    </div>
  );
}

const BLANK_PROC = { technique_id: '', type: 'command' as ProcedureType, content: '', source: '' };

function GroupModal({
  form, setForm, isEdit, saving, error, techSearch, setTechSearch,
  filteredTechs, allTechniques, selectedTechIds, toggleTech,
  motivations, countries,
  existingProcedures, onDeleteExistingProcedure,
  pendingProcedures, onAddPendingProcedure, onRemovePendingProcedure,
  deletedProcedureIds,
  onSave, onClose,
}: {
  form: any; setForm: any; isEdit: boolean; saving: boolean; error: string;
  techSearch: string; setTechSearch: (v: string) => void;
  filteredTechs: Technique[]; allTechniques: Technique[]; selectedTechIds: Set<string>;
  toggleTech: (id: string) => void;
  motivations: Motivation[];
  countries: Country[];
  existingProcedures: Procedure[];
  onDeleteExistingProcedure: (id: number) => void;
  pendingProcedures: Array<{technique_id: string; type: ProcedureType; content: string; source: string}>;
  onAddPendingProcedure: (p: typeof BLANK_PROC) => void;
  onRemovePendingProcedure: (idx: number) => void;
  deletedProcedureIds: number[];
  onSave: () => void; onClose: () => void;
}) {
  const [procForm, setProcForm] = useState(BLANK_PROC);
  const f = (field: string, val: string) => setForm((p: any) => ({ ...p, [field]: val }));

  const techMap = Object.fromEntries(allTechniques.map(t => [t.id, t.name]));
  const selectedTechList = [...selectedTechIds].sort();

  const visibleExisting = existingProcedures.filter(p => !deletedProcedureIds.includes(p.id));

  const addProc = () => {
    if (!procForm.technique_id || !procForm.content.trim()) return;
    onAddPendingProcedure({ ...procForm, content: procForm.content.trim() });
    setProcForm(p => ({ ...BLANK_PROC, technique_id: p.technique_id, type: p.type }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{isEdit ? 'Edit Threat Group' : 'Add Threat Group'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          {/* ── Group metadata ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Group ID <span className="text-red-400">*</span></label>
              <input value={form.id} onChange={e => f('id', e.target.value)} placeholder="e.g. G0016"
                disabled={isEdit}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Name <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. APT29"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Country / Origin</label>
              <input value={form.country} onChange={e => f('country', e.target.value)}
                placeholder="e.g. Russia" list="countries-datalist"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
              <datalist id="countries-datalist">
                {countries.map(c => <option key={c.id} value={c.name}>{c.flag} {c.name}</option>)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Motivation</label>
              <input
                value={form.motivation} onChange={e => f('motivation', e.target.value)}
                placeholder="e.g. Espionage" list="motivations-datalist"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
              <datalist id="motivations-datalist">
                {motivations.map(m => <option key={m.id} value={m.name} />)}
              </datalist>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Aliases <span className="text-gray-400 dark:text-slate-600">(comma-separated)</span></label>
              <input value={form.aliases} onChange={e => f('aliases', e.target.value)} placeholder="Cozy Bear, Midnight Blizzard"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Targeted Industry Sectors <span className="text-gray-400 dark:text-slate-600">(used in gap priority scoring)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {SECTORS.map(s => {
                  const active = form.targeted_sectors.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((prev: GroupFormData) => ({
                        ...prev,
                        targeted_sectors: active
                          ? prev.targeted_sectors.filter((x: string) => x !== s)
                          : [...prev.targeted_sectors, s],
                      }))}
                      className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                        active
                          ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-300 dark:border-slate-700 hover:border-slate-500 hover:text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">MITRE ATT&CK URL</label>
              <input value={form.url} onChange={e => f('url', e.target.value)} placeholder="https://attack.mitre.org/groups/G0016/"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Description</label>
              <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          </div>

          {/* ── Techniques ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">
                Associated Techniques <span className="text-gray-400 dark:text-slate-500">({selectedTechIds.size} selected)</span>
              </label>
            </div>
            <input value={techSearch} onChange={e => setTechSearch(e.target.value)} placeholder="Search by ID or name..."
              className="w-full px-3 py-1.5 mb-2 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <div className="border border-gray-300 dark:border-slate-700 rounded-lg overflow-y-auto max-h-44 bg-gray-100/50 dark:bg-slate-800/50">
              {filteredTechs.slice(0, 400).map(t => (
                <label key={t.id}
                  className={`flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-200/50 dark:bg-slate-700/50 ${selectedTechIds.has(t.id) ? 'bg-blue-600/10' : ''} ${t.is_subtechnique ? 'pl-6 pr-3' : 'px-3'}`}>
                  <input type="checkbox" checked={selectedTechIds.has(t.id)} onChange={() => toggleTech(t.id)}
                    className="accent-blue-500 flex-shrink-0" />
                  <span className={`font-mono text-xs flex-shrink-0 ${t.is_subtechnique ? 'text-gray-400 dark:text-slate-500 w-20' : 'text-gray-500 dark:text-slate-400 w-14'}`}>{t.id}</span>
                  <span className={`text-xs truncate ${t.is_subtechnique ? 'text-gray-500 dark:text-slate-400' : 'text-gray-700 dark:text-slate-300'}`}>{t.name}</span>
                </label>
              ))}
              {filteredTechs.length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center">No techniques match.</div>
              )}
            </div>
          </div>

          {/* ── Procedures ── */}
          {selectedTechIds.size > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300 block mb-2">
                Procedures
                {(visibleExisting.length + pendingProcedures.length) > 0 && (
                  <span className="ml-1.5 text-gray-400 dark:text-slate-500 font-normal">({visibleExisting.length + pendingProcedures.length})</span>
                )}
              </label>

              {/* Existing procedures (edit mode) */}
              {visibleExisting.length > 0 && (
                <div className="mb-2 space-y-1">
                  {visibleExisting.map(p => (
                    <div key={p.id} className="flex items-start gap-2 px-2.5 py-2 bg-gray-100/50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-700 rounded-lg">
                      <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500 w-14 flex-shrink-0 pt-0.5">{p.technique_id}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${PROC_TYPE_STYLE[p.type]}`}>{p.type}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 flex-1 truncate">{p.content}</span>
                      <button onClick={() => onDeleteExistingProcedure(p.id)}
                        className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10 flex-shrink-0">Remove</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending new procedures */}
              {pendingProcedures.length > 0 && (
                <div className="mb-2 space-y-1">
                  {pendingProcedures.map((p, idx) => (
                    <div key={idx} className="flex items-start gap-2 px-2.5 py-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                      <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500 w-14 flex-shrink-0 pt-0.5">{p.technique_id}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${PROC_TYPE_STYLE[p.type]}`}>{p.type}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 flex-1 truncate">{p.content}</span>
                      <button onClick={() => onRemovePendingProcedure(idx)}
                        className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-red-400 px-1.5 py-0.5 rounded flex-shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add procedure form */}
              <div className="p-3 bg-gray-100/40 dark:bg-slate-800/40 border border-gray-300 dark:border-slate-700/60 rounded-lg space-y-2">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 dark:text-slate-500 block mb-1">Technique</label>
                    <select value={procForm.technique_id} onChange={e => setProcForm(p => ({ ...p, technique_id: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
                      <option value="">Select technique...</option>
                      {selectedTechList.map(id => (
                        <option key={id} value={id}>{id} — {techMap[id] ?? ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 dark:text-slate-500 block mb-1">Type</label>
                    <select value={procForm.type} onChange={e => setProcForm(p => ({ ...p, type: e.target.value as ProcedureType }))}
                      className="px-2 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
                      {PROC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 dark:text-slate-500 block mb-1">Source <span className="text-slate-700">(optional)</span></label>
                    <input value={procForm.source} onChange={e => setProcForm(p => ({ ...p, source: e.target.value }))}
                      placeholder="Reference / report"
                      className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <textarea value={procForm.content} onChange={e => setProcForm(p => ({ ...p, content: e.target.value }))}
                    rows={2} placeholder={procForm.type === 'command' ? 'e.g. powershell.exe -nop -w hidden -enc JABj...' : procForm.type === 'reference' ? 'https://...' : 'Describe observed behavior...'}
                    className="flex-1 px-2 py-1.5 text-xs font-mono bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
                  <button onClick={addProc} disabled={!procForm.technique_id || !procForm.content.trim()}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40 whitespace-nowrap self-end">
                    + Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-200 dark:border-slate-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200">Cancel</button>
          <button onClick={onSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

const PROC_TYPE_STYLE: Record<ProcedureType, string> = {
  command:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  script:      'text-violet-400 bg-violet-500/10 border-violet-500/20',
  description: 'text-gray-700 dark:text-slate-300 bg-gray-200/50 dark:bg-slate-700/50 border-gray-400 dark:border-slate-600/30',
  artifact:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  reference:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const PROC_TYPES: ProcedureType[] = ['command', 'script', 'description', 'artifact', 'reference'];

function ProcedureRow({ proc, groupId, onUpdated, onDeleted }: {
  proc: Procedure; groupId: string; onUpdated: (p: Procedure) => void; onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ type: proc.type, content: proc.content, source: proc.source ?? '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.content.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateProcedure(groupId, proc.id, {
        type: form.type, content: form.content, source: form.source || undefined,
      });
      onUpdated(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    await api.deleteProcedure(groupId, proc.id);
    onDeleted(proc.id);
  };

  if (editing) {
    return (
      <div className="mt-1 p-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg space-y-2">
        <div className="flex gap-2">
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as ProcedureType }))}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 rounded text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
            {PROC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
            placeholder="Source / reference (optional)"
            className="flex-1 px-2 py-1 text-xs bg-gray-200 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 rounded text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={3}
          className="w-full px-2 py-1.5 text-xs font-mono bg-gray-50 dark:bg-slate-900 border border-gray-400 dark:border-slate-600 rounded text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 px-2 py-1">Cancel</button>
          <button onClick={save} disabled={saving || !form.content.trim()}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 group/proc flex gap-2 items-start">
      <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${PROC_TYPE_STYLE[proc.type]}`}>
        {proc.type}
      </span>
      <div className="flex-1 min-w-0">
        {(proc.type === 'command' || proc.type === 'script') ? (
          <pre className="text-xs font-mono text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900 px-2 py-1.5 rounded border border-gray-300 dark:border-slate-700/50 whitespace-pre-wrap break-all">{proc.content}</pre>
        ) : (
          <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">{proc.content}</p>
        )}
        {proc.source && (
          <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Source: {proc.source}</div>
        )}
      </div>
      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover/proc:opacity-100 transition-opacity">
        <button onClick={() => { setForm({ type: proc.type, content: proc.content, source: proc.source ?? '' }); setEditing(true); }}
          className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:bg-slate-700">Edit</button>
        <button onClick={remove}
          className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10">Del</button>
      </div>
    </div>
  );
}

function TechniqueWithProcedures({ t, groupId, procedures, onProcsChange }: {
  t: { technique_id: string; technique_name: string; detected: boolean };
  groupId: string;
  procedures: Procedure[];
  onProcsChange: (procs: Procedure[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<{ type: ProcedureType; content: string; source: string }>({ type: 'command', content: '', source: '' });
  const [saving, setSaving] = useState(false);

  const myProcs = procedures.filter(p => p.technique_id === t.technique_id);

  const addProc = async () => {
    if (!newForm.content.trim()) return;
    setSaving(true);
    try {
      const created = await api.createProcedure(groupId, t.technique_id, {
        type: newForm.type,
        content: newForm.content,
        source: newForm.source || undefined,
      });
      onProcsChange([...procedures, created]);
      setNewForm({ type: 'command', content: '', source: '' });
      setAdding(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100/50 dark:bg-slate-800/50 transition-colors text-left">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.detected ? 'bg-emerald-400' : 'bg-red-500'}`} />
        <span className="font-mono text-gray-400 dark:text-slate-500 w-14 flex-shrink-0">{t.technique_id}</span>
        <span className={`flex-1 truncate ${t.detected ? 'text-gray-700 dark:text-slate-300' : 'text-gray-400 dark:text-slate-500'}`}>{t.technique_name}</span>
        {myProcs.length > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-300 dark:border-slate-700">{myProcs.length} proc{myProcs.length > 1 ? 's' : ''}</span>
        )}
        {!t.detected && <span className="text-red-400 text-[10px]">EXPOSED</span>}
        <span className="text-gray-400 dark:text-slate-600 ml-1">{expanded ? '▾' : '›'}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/30 space-y-1">
          {myProcs.length === 0 && !adding && (
            <p className="text-[11px] text-gray-400 dark:text-slate-600 italic">No procedures recorded.</p>
          )}
          {myProcs.map(p => (
            <ProcedureRow key={p.id} proc={p} groupId={groupId}
              onUpdated={updated => onProcsChange(procedures.map(x => x.id === updated.id ? updated : x))}
              onDeleted={id => onProcsChange(procedures.filter(x => x.id !== id))} />
          ))}

          {adding ? (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg space-y-2">
              <div className="flex gap-2">
                <select value={newForm.type} onChange={e => setNewForm(p => ({ ...p, type: e.target.value as ProcedureType }))}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 rounded text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
                  {PROC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={newForm.source} onChange={e => setNewForm(p => ({ ...p, source: e.target.value }))}
                  placeholder="Source / reference (optional)"
                  className="flex-1 px-2 py-1 text-xs bg-gray-200 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 rounded text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <textarea value={newForm.content} onChange={e => setNewForm(p => ({ ...p, content: e.target.value }))} rows={3}
                placeholder={newForm.type === 'command' ? 'e.g. powershell.exe -enc <base64>' : newForm.type === 'reference' ? 'https://...' : 'Describe the observed behavior...'}
                className="w-full px-2 py-1.5 text-xs font-mono bg-gray-50 dark:bg-slate-900 border border-gray-400 dark:border-slate-600 rounded text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAdding(false)} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 px-2 py-1">Cancel</button>
                <button onClick={addProc} disabled={saving || !newForm.content.trim()}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
                  {saving ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="mt-1 text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
              + Add Procedure
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GroupDetailPane({ group, detail, onClose, onEdit }: {
  group: ThreatGroup; detail: GroupDetail; onClose: () => void; onEdit: () => void;
}) {
  const { coverage } = detail;
  const exposed = coverage.details.filter(t => !t.detected);
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  useEffect(() => {
    api.getGroupProcedures(group.id).then(setProcedures).catch(() => {});
  }, [group.id]);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">{group.name}</h2>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{group.id} · {group.country} · {group.motivation}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit}
            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10">Edit</button>
          <button onClick={onClose} className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 text-xl leading-none">×</button>
        </div>
      </div>

      {group.description && <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{group.description}</p>}

      <div className="flex gap-2 flex-wrap">
        {group.aliases.map(a => (
          <span key={a} className="text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-2 py-0.5 rounded">{a}</span>
        ))}
      </div>

      <div className="bg-gray-100/50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-300 dark:border-slate-700/50">
        <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Detection Coverage</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-2xl font-bold ${coverage.pct >= 60 ? 'text-emerald-400' : coverage.pct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {coverage.pct}%
          </span>
          <span className="text-xs text-gray-400 dark:text-slate-500">{coverage.covered}/{coverage.total} techniques detected</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${coverage.pct}%` }} />
        </div>
        {exposed.length > 0 && (
          <div className="mt-2 text-xs text-red-400">{exposed.length} techniques not detected</div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">
          Techniques &amp; Procedures
          {procedures.length > 0 && <span className="ml-2 text-gray-400 dark:text-slate-600 font-normal">{procedures.length} total procedures</span>}
        </div>
        <div className="space-y-1 max-h-[32rem] overflow-y-auto">
          {coverage.details.map(t => (
            <TechniqueWithProcedures key={t.technique_id} t={t} groupId={group.id}
              procedures={procedures} onProcsChange={setProcedures} />
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
