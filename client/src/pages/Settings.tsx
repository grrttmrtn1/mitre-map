import { useEffect, useState } from 'react';
import { api, getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../api';
import type { Country, Motivation, Tag, AuditLogEntry, ApiKey } from '../types';

type TabId = 'tags' | 'motivations' | 'countries' | 'risk' | 'audit' | 'api_keys' | 'data';

const SCOPES = ['read', 'write', 'admin'];
const SCOPE_DESC: Record<string, string> = {
  read:  'GET — view all data',
  write: 'POST/PUT/PATCH/DELETE — modify detections, tools, groups, tags, etc.',
  admin: 'Key management + bulk purge (implies read & write)',
};
const BLANK_KEY_FORM = { name: '', scopes: ['read'] as string[], expires_at: '', never_expires: true };

export default function Settings() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [riskScore, setRiskScore] = useState<any>(null);
  const [riskByTactic, setRiskByTactic] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('tags');

  // Tags state
  const [tagForm, setTagForm] = useState({ name: '', color: '#6366f1', description: '' });
  const [editTagId, setEditTagId] = useState<number | null>(null);
  const [savingTag, setSavingTag] = useState(false);

  // Motivations state
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [motForm, setMotForm] = useState({ name: '', color: '#6366f1', description: '' });
  const [editMotId, setEditMotId] = useState<number | null>(null);
  const [savingMot, setSavingMot] = useState(false);
  const [motError, setMotError] = useState('');

  // Countries state
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryForm, setCountryForm] = useState({ name: '', color: '#6366f1', flag: '' });
  const [editCountryId, setEditCountryId] = useState<number | null>(null);
  const [savingCountry, setSavingCountry] = useState(false);
  const [countryError, setCountryError] = useState('');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keyForm, setKeyForm] = useState(BLANK_KEY_FORM);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);

  // App authentication state
  const [appKeyInput, setAppKeyInput] = useState('');
  const [activeAppKey, setActiveAppKey] = useState<string | null>(getStoredApiKey);

  // Data management state
  const [datasets, setDatasets] = useState<Array<{ key: string; label: string; count: number }>>([]);
  const [purgeConfirm, setPurgeConfirm] = useState<string | null>(null);
  const [purgeAllConfirm, setPurgeAllConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  const loadTags = () => api.getTags().then(setTags);
  const loadMotivations = () => api.getMotivations().then(setMotivations);
  const loadCountries = () => api.getCountries().then(setCountries);
  const loadAudit = () => api.getAuditLog({ limit: 100 }).then(r => { setAuditRows(r.rows); setAuditTotal(r.total); });
  const loadRisk = () => Promise.all([api.getRiskScore(), api.getRiskByTactic()]).then(([s, t]) => { setRiskScore(s); setRiskByTactic(t); });
  const loadApiKeys = () => api.getApiKeys().then(setApiKeys);
  const loadDatasets = () => api.getPurgeableDatasets().then(r => setDatasets(r.datasets));

  useEffect(() => {
    loadTags(); loadMotivations(); loadCountries(); loadAudit(); loadRisk(); loadApiKeys(); loadDatasets();
  }, []);

  // ── Tag actions ─────────────────────────────────────────────────────────────
  const saveTag = async () => {
    if (!tagForm.name.trim()) return;
    setSavingTag(true);
    try {
      if (editTagId !== null) await api.updateTag(editTagId, tagForm);
      else await api.createTag(tagForm);
      setTagForm({ name: '', color: '#6366f1', description: '' });
      setEditTagId(null);
      loadTags();
    } finally { setSavingTag(false); }
  };

  const deleteTag = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all entities.')) return;
    await api.deleteTag(id);
    loadTags();
  };

  const startEditTag = (tag: Tag) => {
    setEditTagId(tag.id);
    setTagForm({ name: tag.name, color: tag.color, description: tag.description ?? '' });
  };

  // ── Motivation actions ───────────────────────────────────────────────────────
  const saveMot = async () => {
    if (!motForm.name.trim()) return;
    setSavingMot(true);
    setMotError('');
    try {
      if (editMotId !== null) await api.updateMotivation(editMotId, motForm);
      else await api.createMotivation(motForm);
      setMotForm({ name: '', color: '#6366f1', description: '' });
      setEditMotId(null);
      loadMotivations();
    } catch (e: any) {
      setMotError(e.message ?? 'Save failed');
    } finally { setSavingMot(false); }
  };

  const deleteMot = async (id: number) => {
    if (!confirm('Delete this motivation? Existing threat groups will keep their current value.')) return;
    await api.deleteMotivation(id);
    loadMotivations();
  };

  const startEditMot = (m: Motivation) => {
    setEditMotId(m.id);
    setMotForm({ name: m.name, color: m.color ?? '#6366f1', description: m.description ?? '' });
    setMotError('');
  };

  // ── Country actions ──────────────────────────────────────────────────────────
  const saveCountry = async () => {
    if (!countryForm.name.trim()) return;
    setSavingCountry(true);
    setCountryError('');
    try {
      if (editCountryId !== null) await api.updateCountry(editCountryId, countryForm);
      else await api.createCountry(countryForm);
      setCountryForm({ name: '', color: '#6366f1', flag: '' });
      setEditCountryId(null);
      loadCountries();
    } catch (e: any) {
      setCountryError(e.message ?? 'Save failed');
    } finally { setSavingCountry(false); }
  };

  const deleteCountry = async (id: number) => {
    if (!confirm('Delete this country? Existing threat groups will keep their current value.')) return;
    await api.deleteCountry(id);
    loadCountries();
  };

  const startEditCountry = (c: Country) => {
    setEditCountryId(c.id);
    setCountryForm({ name: c.name, color: c.color ?? '#6366f1', flag: c.flag ?? '' });
    setCountryError('');
  };

  // ── API Key actions ──────────────────────────────────────────────────────────
  const createKey = async () => {
    if (!keyForm.name.trim()) return;
    setSavingKey(true);
    try {
      const res = await api.createApiKey({
        name: keyForm.name.trim(),
        scopes: keyForm.scopes,
        expires_at: keyForm.never_expires ? undefined : (keyForm.expires_at || undefined),
      });
      const rawKey = (res as any).key;
      setNewKey(rawKey);
      setKeyForm(BLANK_KEY_FORM);
      if (!activeAppKey) {
        setStoredApiKey(rawKey);
        setActiveAppKey(rawKey);
      }
      loadApiKeys();
    } finally { setSavingKey(false); }
  };

  const deleteKey = async (id: number) => {
    setDeletingKeyId(id);
    try {
      await api.deleteApiKey(id);
      loadApiKeys();
    } finally { setDeletingKeyId(null); }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setKeyForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  };

  // ── Purge actions ────────────────────────────────────────────────────────────
  const doPurge = async (dataset: string) => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await api.purgeDataset(dataset);
      setPurgeResult(`Purged "${dataset}" — ${res.rows_deleted} rows deleted.`);
      setPurgeConfirm(null);
      loadDatasets();
      if (dataset === 'audit') loadAudit();
    } finally { setPurging(false); }
  };

  const doPurgeAll = async () => {
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await api.purgeAll();
      setPurgeResult(`Full purge complete — ${res.rows_deleted} rows deleted.`);
      setPurgeAllConfirm(false);
      loadDatasets();
      loadTags();
      loadAudit();
    } finally { setPurging(false); }
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'tags', label: 'Tag Management' },
    { id: 'motivations', label: 'Motivations' },
    { id: 'countries', label: 'Countries' },
    { id: 'risk', label: 'Risk Dashboard' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'api_keys', label: 'API Keys' },
    { id: 'data', label: 'Data Management' },
  ];

  const riskLevelColor: Record<string, string> = {
    critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-emerald-400',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <h1 className="text-xl font-semibold text-slate-100">Settings &amp; Administration</h1>
        <div className="flex gap-1 mt-4 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTab === tab.id ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Tag Management ── */}
        {activeTab === 'tags' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">{editTagId !== null ? 'Edit Tag' : 'Create Tag'}</h2>
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Name</label>
                  <input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. critical-asset"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={tagForm.color} onChange={e => setTagForm(f => ({ ...f, color: e.target.value }))}
                      className="w-9 h-9 rounded border border-slate-700 bg-slate-800 cursor-pointer" />
                    <input value={tagForm.color} onChange={e => setTagForm(f => ({ ...f, color: e.target.value }))}
                      className="w-24 px-2 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Description</label>
                  <input value={tagForm.description} onChange={e => setTagForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  {editTagId !== null && (
                    <button onClick={() => { setEditTagId(null); setTagForm({ name: '', color: '#6366f1', description: '' }); }}
                      className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                  )}
                  <button onClick={saveTag} disabled={savingTag || !tagForm.name.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                    {savingTag ? '...' : editTagId !== null ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-slate-200 flex-1">{tag.name}</span>
                  {tag.description && <span className="text-xs text-slate-500 flex-1 truncate">{tag.description}</span>}
                  <span className="font-mono text-xs" style={{ color: tag.color }}>{tag.color}</span>
                  <button onClick={() => startEditTag(tag)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Edit</button>
                  <button onClick={() => deleteTag(tag.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </div>
              ))}
              {tags.length === 0 && <div className="text-sm text-slate-500 text-center py-8">No tags yet. Create one above.</div>}
            </div>
          </div>
        )}

        {/* ── Motivations ── */}
        {activeTab === 'motivations' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">
                {editMotId !== null ? 'Edit Motivation' : 'Add Motivation'}
              </h2>
              {motError && (
                <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{motError}</div>
              )}
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Name</label>
                  <input value={motForm.name} onChange={e => setMotForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Espionage"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={motForm.color} onChange={e => setMotForm(f => ({ ...f, color: e.target.value }))}
                      className="w-9 h-9 rounded border border-slate-700 bg-slate-800 cursor-pointer" />
                    <input value={motForm.color} onChange={e => setMotForm(f => ({ ...f, color: e.target.value }))}
                      className="w-24 px-2 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Description <span className="text-slate-600">(optional)</span></label>
                  <input value={motForm.description} onChange={e => setMotForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  {editMotId !== null && (
                    <button onClick={() => { setEditMotId(null); setMotForm({ name: '', color: '#6366f1', description: '' }); setMotError(''); }}
                      className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                  )}
                  <button onClick={saveMot} disabled={savingMot || !motForm.name.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                    {savingMot ? '...' : editMotId !== null ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {motivations.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-xs px-2 py-0.5 rounded border font-medium flex-shrink-0"
                    style={{ color: m.color, borderColor: m.color + '40', backgroundColor: m.color + '18' }}>
                    {m.name}
                  </span>
                  <span className="font-mono text-xs" style={{ color: m.color }}>{m.color}</span>
                  {m.description && <span className="text-xs text-slate-500 flex-1 truncate">{m.description}</span>}
                  <button onClick={() => startEditMot(m)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 ml-auto">Edit</button>
                  <button onClick={() => deleteMot(m.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </div>
              ))}
              {motivations.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-8">No motivations yet. Add one above.</div>
              )}
            </div>
          </div>
        )}

        {/* ── Countries ── */}
        {activeTab === 'countries' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">
                {editCountryId !== null ? 'Edit Country' : 'Add Country'}
              </h2>
              {countryError && (
                <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{countryError}</div>
              )}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Country Name</label>
                  <input value={countryForm.name} onChange={e => setCountryForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Russia"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={countryForm.color} onChange={e => setCountryForm(f => ({ ...f, color: e.target.value }))}
                      className="w-9 h-9 rounded border border-slate-700 bg-slate-800 cursor-pointer" />
                    <input value={countryForm.color} onChange={e => setCountryForm(f => ({ ...f, color: e.target.value }))}
                      className="w-24 px-2 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Flag <span className="text-slate-600">(emoji)</span></label>
                  <input value={countryForm.flag} onChange={e => setCountryForm(f => ({ ...f, flag: e.target.value }))}
                    placeholder="🇺🇸"
                    className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-lg text-center focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  {editCountryId !== null && (
                    <button onClick={() => { setEditCountryId(null); setCountryForm({ name: '', color: '#6366f1', flag: '' }); setCountryError(''); }}
                      className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                  )}
                  <button onClick={saveCountry} disabled={savingCountry || !countryForm.name.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                    {savingCountry ? '...' : editCountryId !== null ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {countries.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  {c.flag && <span className="text-xl flex-shrink-0">{c.flag}</span>}
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-sm font-medium text-slate-200 flex-1">{c.name}</span>
                  <span className="font-mono text-xs" style={{ color: c.color }}>{c.color}</span>
                  <button onClick={() => startEditCountry(c)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Edit</button>
                  <button onClick={() => deleteCountry(c.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </div>
              ))}
              {countries.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-8">No countries yet. Add one above.</div>
              )}
            </div>
          </div>
        )}

        {/* ── Risk Dashboard ── */}
        {activeTab === 'risk' && riskScore && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Overall Risk Score</div>
                  <div className={`text-5xl font-bold ${riskLevelColor[riskScore.level]}`}>{riskScore.score}</div>
                  <div className="text-xs text-slate-500 mt-1">out of 100</div>
                </div>
                <span className={`text-sm px-3 py-1.5 rounded-lg border font-semibold ${
                  riskScore.level === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                  riskScore.level === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' :
                  riskScore.level === 'medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                }`}>{riskScore.level.toUpperCase()}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
                <div>
                  <div className="text-slate-500 mb-0.5">Coverage Gap</div>
                  <div className="text-red-400 font-mono font-semibold">{riskScore.components.coverage_gap_pct}%</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Exposed Threat Groups</div>
                  <div className="text-orange-400 font-mono font-semibold">{riskScore.components.exposed_threat_groups}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Critical Gaps (3+ groups)</div>
                  <div className="text-red-400 font-mono font-semibold">{riskScore.components.critical_gaps}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-3">Risk by Tactic</h2>
              <div className="space-y-2">
                {riskByTactic.map((t: any) => (
                  <div key={t.tactic_id} className="flex items-center gap-3">
                    <div className="text-xs text-slate-400 w-36 truncate flex-shrink-0">{t.tactic_name}</div>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        t.risk_level === 'critical' ? 'bg-red-500' :
                        t.risk_level === 'high' ? 'bg-orange-500' :
                        t.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`} style={{ width: `${t.risk_score}%` }} />
                    </div>
                    <div className={`text-xs font-mono w-8 text-right ${riskLevelColor[t.risk_level]}`}>{t.risk_score}</div>
                    <div className="text-xs text-slate-600 w-16 text-right">{t.coverage_pct}% cov.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Audit Log ── */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Last 100 events of {auditTotal} total</div>
            </div>
            <div className="space-y-1">
              {auditRows.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                  <div className="text-xs text-slate-600 w-36 flex-shrink-0 pt-0.5">
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-blue-400">{entry.entity_type}</span>
                      <span className="text-xs text-slate-500">#{entry.entity_id}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        entry.action.includes('delete') || entry.action.includes('purge') ? 'bg-red-500/10 text-red-400' :
                        entry.action.includes('create') || entry.action.includes('import') ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>{entry.action}</span>
                      <span className="text-xs text-slate-600">
                        by <span className={entry.actor.startsWith('key:') ? 'text-amber-400' : 'text-slate-400'}>
                          {entry.actor}
                        </span>
                      </span>
                      {entry.source_ip && (
                        <span className="text-xs text-slate-600 font-mono">from {entry.source_ip}</span>
                      )}
                    </div>
                    {entry.changes && (
                      <div className="text-xs text-slate-600 mt-0.5 font-mono truncate">
                        {JSON.stringify(entry.changes)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {auditRows.length === 0 && <div className="text-sm text-slate-500 text-center py-8">No audit events yet.</div>}
            </div>
          </div>
        )}

        {/* ── API Keys ── */}
        {activeTab === 'api_keys' && (
          <div className="max-w-2xl space-y-6">
            <div className="text-xs text-slate-500">
              API keys allow programmatic access to the MitreMap API. Keys are shown only once at creation — store them securely.
            </div>

            {/* App authentication */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-1">App Authentication</h2>
              <p className="text-xs text-slate-500 mb-4">
                The key stored here is sent automatically by the web app on every request.
              </p>
              {activeAppKey ? (
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 px-3 py-2 bg-slate-800 border border-emerald-500/30 rounded-lg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <code className="text-xs font-mono text-emerald-300 truncate">
                      {activeAppKey.slice(0, 10)}{'•'.repeat(20)}{activeAppKey.slice(-4)}
                    </code>
                  </div>
                  <button
                    onClick={() => { clearStoredApiKey(); setActiveAppKey(null); }}
                    className="px-3 py-2 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg hover:bg-red-500/10 transition-colors">
                    Clear
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg mb-3 text-xs text-amber-400">
                  <span>No app key configured.</span>
                  {apiKeys.length === 0 && <span className="text-amber-500/70">Create a key below, then click "Use as app key".</span>}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={appKeyInput}
                  onChange={e => setAppKeyInput(e.target.value)}
                  placeholder="Paste an existing key (mm_...)"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  disabled={!appKeyInput.trim()}
                  onClick={() => { setStoredApiKey(appKeyInput.trim()); setActiveAppKey(appKeyInput.trim()); setAppKeyInput(''); }}
                  className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors">
                  Save
                </button>
              </div>
            </div>

            {newKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <div className="text-xs font-medium text-emerald-400 mb-2">New API Key Created — copy it now</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-emerald-300 bg-slate-900 px-3 py-2 rounded-lg break-all">{newKey}</code>
                  <button onClick={copyKey}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${keyCopied ? 'border-emerald-500 text-emerald-400' : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}>
                    {keyCopied ? 'Copied!' : 'Copy'}
                  </button>
                  {activeAppKey !== newKey && (
                    <button
                      onClick={() => { setStoredApiKey(newKey!); setActiveAppKey(newKey!); setAppKeyInput(''); }}
                      className="px-3 py-2 text-xs rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap">
                      Use as app key
                    </button>
                  )}
                </div>
                <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-slate-500 hover:text-slate-300">Dismiss</button>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">Create API Key</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Key Name</label>
                  <input value={keyForm.name} onChange={e => setKeyForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. CI Pipeline, SIEM Integration"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-2">Scopes</label>
                  <div className="space-y-2">
                    {SCOPES.map(scope => (
                      <label key={scope} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        keyForm.scopes.includes(scope)
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}>
                        <input type="checkbox" checked={keyForm.scopes.includes(scope)} onChange={() => toggleScope(scope)} className="accent-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className={`text-xs font-medium ${keyForm.scopes.includes(scope) ? 'text-blue-300' : 'text-slate-300'}`}>{scope}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">{SCOPE_DESC[scope]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-2">Expiry</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={keyForm.never_expires}
                        onChange={e => setKeyForm(f => ({ ...f, never_expires: e.target.checked, expires_at: e.target.checked ? '' : f.expires_at }))}
                        className="accent-blue-500" />
                      <span className="text-xs text-slate-300">Never expires</span>
                    </label>
                    {!keyForm.never_expires && (
                      <input type="date" value={keyForm.expires_at}
                        onChange={e => setKeyForm(f => ({ ...f, expires_at: e.target.value }))}
                        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                    )}
                  </div>
                </div>
                <button onClick={createKey} disabled={savingKey || !keyForm.name.trim() || keyForm.scopes.length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                  {savingKey ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-slate-300">Active Keys ({apiKeys.length})</h2>
              {apiKeys.map(key => {
                const scopes: string[] = Array.isArray(key.scopes) ? key.scopes : JSON.parse(key.scopes as any);
                const expired = key.expires_at && new Date(key.expires_at) < new Date();
                const scopeColor: Record<string, string> = {
                  read:  'bg-slate-800 text-slate-400',
                  write: 'bg-blue-500/10 text-blue-400',
                  admin: 'bg-amber-500/10 text-amber-400',
                };
                return (
                  <div key={key.id} className={`px-4 py-3 bg-slate-900 border rounded-xl flex items-start gap-3 ${expired ? 'border-red-500/30' : 'border-slate-800'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200">{key.name}</span>
                        {expired && <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">Expired</span>}
                        <div className="flex gap-1">
                          {scopes.map((s: string) => (
                            <span key={s} className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${scopeColor[s] ?? 'bg-slate-800 text-slate-400'}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">{key.masked_key}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                        {key.last_used_at && <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>}
                        {key.expires_at
                          ? <span className={expired ? 'text-red-400' : 'text-slate-400'}>Expires {new Date(key.expires_at).toLocaleDateString()}</span>
                          : <span className="text-emerald-500/70">Never expires</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteKey(key.id)} disabled={deletingKeyId === key.id}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 disabled:opacity-50 flex-shrink-0">
                      {deletingKeyId === key.id ? '...' : 'Revoke'}
                    </button>
                  </div>
                );
              })}
              {apiKeys.length === 0 && <div className="text-sm text-slate-500 text-center py-6">No API keys. Create one above.</div>}
            </div>
          </div>
        )}

        {/* ── Data Management ── */}
        {activeTab === 'data' && (
          <div className="max-w-2xl space-y-6">
            <div className="text-xs text-slate-500">
              Purge staged, imported, or seeded data from the database. These operations are permanent and cannot be undone.
            </div>

            {purgeResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-emerald-400 flex items-center justify-between">
                <span>{purgeResult}</span>
                <button onClick={() => setPurgeResult(null)} className="text-emerald-600 hover:text-emerald-400 ml-3">×</button>
              </div>
            )}

            <div className="space-y-2">
              {datasets.map(ds => (
                <div key={ds.key} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-200">{ds.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{ds.count.toLocaleString()} rows</div>
                  </div>
                  <button
                    onClick={() => setPurgeConfirm(ds.key)}
                    disabled={ds.count === 0}
                    className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    Purge
                  </button>
                </div>
              ))}
            </div>

            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
              <p className="text-xs text-slate-400 mb-3">
                Purge all datasets at once. This will clear detections, tools, threat groups, tags, comments, assignments, snapshots, and audit logs.
              </p>
              <button onClick={() => setPurgeAllConfirm(true)}
                className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 hover:border-red-500/60 transition-colors">
                Purge All Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Purge single dataset confirm */}
      {purgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-slate-100 mb-2">Confirm Purge</h2>
            <p className="text-sm text-slate-400 mb-4">
              Permanently delete all <span className="text-slate-200 font-medium">{datasets.find(d => d.key === purgeConfirm)?.label}</span> data?
              This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPurgeConfirm(null)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={() => doPurge(purgeConfirm!)} disabled={purging}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50">
                {purging ? 'Purging...' : 'Purge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge all confirm */}
      {purgeAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-red-400 mb-2">Purge All Data</h2>
            <p className="text-sm text-slate-400 mb-1">This will permanently delete:</p>
            <ul className="text-xs text-slate-500 mb-4 space-y-0.5 ml-3 list-disc">
              <li>All detections</li>
              <li>All tools</li>
              <li>All threat groups</li>
              <li>All tags and associations</li>
              <li>All comments and assignments</li>
              <li>All coverage snapshots and audit logs</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPurgeAllConfirm(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
              <button onClick={doPurgeAll} disabled={purging}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50">
                {purging ? 'Purging...' : 'Purge Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
