import { useEffect, useState } from 'react';
import { api, getStoredApiKey, setStoredApiKey, clearStoredApiKey } from '../api';
import type { Country, Motivation, Tag, AuditLogEntry, ApiKey, User, AttackVersion, WebhookConfig, AlertRule, AlertRuleType } from '../types';
import { useAuth } from '../context/AuthContext';

const ROLE_INFO: Record<string, { label: string; description: string; color: string }> = {
  readonly:  { label: 'Read Only',  description: 'View all data — cannot create, edit, or delete anything.', color: 'text-slate-400 bg-slate-800 border-slate-700' },
  analyst:   { label: 'Analyst',    description: 'Create and edit detections, tools, threat groups, tags, and comments. Cannot manage users or API keys.', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  admin:     { label: 'Admin',      description: 'Full access — includes user management, API key management, data purge, and all write operations.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
};

type TabId = 'tags' | 'motivations' | 'countries' | 'risk' | 'audit' | 'api_keys' | 'data' | 'users' | 'attack_version' | 'sso' | 'webhooks';

const SCOPES = ['read', 'write', 'admin'];
const SCOPE_DESC: Record<string, string> = {
  read:  'GET — view all data',
  write: 'POST/PUT/PATCH/DELETE — modify detections, tools, groups, tags, etc.',
  admin: 'Key management + bulk purge (implies read & write)',
};
const BLANK_KEY_FORM = { name: '', scopes: ['read'] as string[], expires_at: '', never_expires: true };

export default function Settings() {
  const { user: currentUser, canWrite, canAdmin } = useAuth();
  // Show admin tabs if logged in as admin OR using API key mode (no user — server enforces auth)
  const isAdmin = canAdmin;

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userForm, setUserForm] = useState({ email: '', name: '', password: '', role: 'analyst' });
  const [userError, setUserError] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // ATT&CK Version state
  const [attackVersion, setAttackVersion] = useState<AttackVersion | null>(null);
  const [deprecated, setDeprecated] = useState<any[]>([]);
  const [migrationScan, setMigrationScan] = useState<any | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrateResult, setMigrateResult] = useState<any | null>(null);
  const [updateCheck, setUpdateCheck] = useState<any | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<any | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [updateDiff, setUpdateDiff] = useState<any | null>(null);
  const [diffExpanded, setDiffExpanded] = useState<Record<string, boolean>>({});

  // OIDC providers state
  const [oidcProviders, setOidcProviders] = useState<any[]>([]);
  const [oidcForm, setOidcForm] = useState({ name: '', slug: '', issuer_url: '', client_id: '', client_secret: '', enabled: true });
  const [editOidcId, setEditOidcId] = useState<number | null>(null);
  const [savingOidc, setSavingOidc] = useState(false);
  const [oidcError, setOidcError] = useState('');
  const BLANK_OIDC = { name: '', slug: '', issuer_url: '', client_id: '', client_secret: '', enabled: true };

  const loadOidcProviders = () => api.getOidcProviders().then(setOidcProviders).catch(() => {});

  const loadUsers = () => api.getUsers().then(setUsers).catch(() => {});
  const loadAttackVersion = () => {
    api.getAttackVersion().then(setAttackVersion).catch(() => {});
    api.getDeprecatedTechniques().then(setDeprecated).catch(() => {});
  };

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

  // Webhook state
  const BLANK_WEBHOOK = { name: '', url: '', secret: '', custom_headers: '' };
  const BLANK_RULE = { name: '', type: 'coverage_threshold' as AlertRuleType, threshold: '80', webhook_config_id: '' };
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [webhookForm, setWebhookForm] = useState(BLANK_WEBHOOK);
  const [editWebhookId, setEditWebhookId] = useState<number | null>(null);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState('');
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null);
  const [ruleForm, setRuleForm] = useState(BLANK_RULE);
  const [editRuleId, setEditRuleId] = useState<number | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState('');

  const loadWebhooks = () => Promise.all([
    api.getWebhookConfigs().then(setWebhookConfigs),
    api.getAlertRules().then(setAlertRules),
  ]).catch(() => {});

  const loadTags = () => api.getTags().then(setTags);
  const loadMotivations = () => api.getMotivations().then(setMotivations);
  const loadCountries = () => api.getCountries().then(setCountries);
  const loadAudit = () => api.getAuditLog({ limit: 100 }).then(r => { setAuditRows(r.rows); setAuditTotal(r.total); });
  const loadRisk = () => Promise.all([api.getRiskScore(), api.getRiskByTactic()]).then(([s, t]) => { setRiskScore(s); setRiskByTactic(t); });
  const loadApiKeys = () => api.getApiKeys().then(setApiKeys);
  const loadDatasets = () => api.getPurgeableDatasets().then(r => setDatasets(r.datasets));

  useEffect(() => {
    loadTags(); loadMotivations(); loadCountries(); loadAudit(); loadRisk(); loadApiKeys(); loadDatasets(); loadWebhooks();
    if (isAdmin) { loadUsers(); loadAttackVersion(); loadOidcProviders(); }
  }, [isAdmin]);

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

  const ALL_TABS: { id: TabId; label: string; adminOnly?: boolean; disabled?: boolean }[] = [
    { id: 'tags', label: 'Tag Management' },
    { id: 'motivations', label: 'Motivations' },
    { id: 'countries', label: 'Countries' },
    { id: 'risk', label: 'Risk Dashboard' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'api_keys', label: 'API Keys' },
    { id: 'data', label: 'Data Management' },
    { id: 'users', label: 'Users', adminOnly: true },
    { id: 'sso', label: 'SSO / OIDC', adminOnly: true, disabled: true },
    { id: 'attack_version', label: 'ATT&CK Version', adminOnly: true },
    { id: 'webhooks', label: 'Webhooks' },
  ];
  const TABS = ALL_TABS.filter(t => !t.adminOnly || isAdmin);

  const riskLevelColor: Record<string, string> = {
    critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-emerald-400',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <h1 className="text-xl font-semibold text-slate-100">Settings &amp; Administration</h1>
        <div className="flex gap-1 mt-4 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              title={tab.disabled ? 'Under construction' : undefined}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                tab.disabled
                  ? 'text-slate-600 cursor-not-allowed opacity-60'
                  : activeTab === tab.id
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}>
              {tab.label}{tab.disabled && <span className="ml-1 text-[10px] text-amber-600/80">🚧</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Tag Management ── */}
        {activeTab === 'tags' && (
          <div className="max-w-2xl space-y-6">
            {canWrite && <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
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
            </div>}
            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-slate-200 flex-1">{tag.name}</span>
                  {tag.description && <span className="text-xs text-slate-500 flex-1 truncate">{tag.description}</span>}
                  <span className="font-mono text-xs" style={{ color: tag.color }}>{tag.color}</span>
                  {canWrite && <button onClick={() => startEditTag(tag)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Edit</button>}
                  {canWrite && <button onClick={() => deleteTag(tag.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>}
                </div>
              ))}
              {tags.length === 0 && <div className="text-sm text-slate-500 text-center py-8">No tags yet.{canWrite ? ' Create one above.' : ''}</div>}
            </div>
          </div>
        )}

        {/* ── Motivations ── */}
        {activeTab === 'motivations' && (
          <div className="max-w-2xl space-y-6">
            {canWrite && <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
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
            </div>}
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
                  {canWrite && <button onClick={() => startEditMot(m)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 ml-auto">Edit</button>}
                  {canWrite && <button onClick={() => deleteMot(m.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>}
                </div>
              ))}
              {motivations.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-8">No motivations yet.{canWrite ? ' Add one above.' : ''}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Countries ── */}
        {activeTab === 'countries' && (
          <div className="max-w-2xl space-y-6">
            {canWrite && <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
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
            </div>}
            <div className="space-y-2">
              {countries.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  {c.flag && <span className="text-xl flex-shrink-0">{c.flag}</span>}
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-sm font-medium text-slate-200 flex-1">{c.name}</span>
                  <span className="font-mono text-xs" style={{ color: c.color }}>{c.color}</span>
                  {canWrite && <button onClick={() => startEditCountry(c)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Edit</button>}
                  {canWrite && <button onClick={() => deleteCountry(c.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>}
                </div>
              ))}
              {countries.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-8">No countries yet.{canWrite ? ' Add one above.' : ''}</div>
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

            {canAdmin && <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
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
            </div>}

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
                    {canAdmin && <button onClick={() => deleteKey(key.id)} disabled={deletingKeyId === key.id}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 disabled:opacity-50 flex-shrink-0">
                      {deletingKeyId === key.id ? '...' : 'Revoke'}
                    </button>}
                  </div>
                );
              })}
              {apiKeys.length === 0 && <div className="text-sm text-slate-500 text-center py-6">No API keys.{canAdmin ? ' Create one above.' : ''}</div>}
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

        {/* ── Under Construction ── */}
        {activeTab === 'sso' && (
          <div className="max-w-lg flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4">🚧</div>
            <h2 className="text-lg font-semibold text-slate-300 mb-2">Under Construction</h2>
            <p className="text-sm text-slate-500">SSO / OIDC configuration is not yet available.</p>
          </div>
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">Create User</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Email</label>
                  <input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com" type="email"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Name (optional)</label>
                  <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Display name"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Password</label>
                  <input value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                    type="password" placeholder="Min 8 characters"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Role</label>
                  <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="readonly">Read Only</option>
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                  {userForm.role && ROLE_INFO[userForm.role] && (
                    <p className="mt-1.5 text-[11px] text-slate-500">{ROLE_INFO[userForm.role].description}</p>
                  )}
                </div>
              </div>
              {userError && <p className="text-red-400 text-xs mt-2">{userError}</p>}
              <button
                onClick={async () => {
                  if (!userForm.email || !userForm.password) return;
                  setSavingUser(true); setUserError('');
                  try {
                    await api.createUser(userForm);
                    setUserForm({ email: '', name: '', password: '', role: 'analyst' });
                    loadUsers();
                  } catch (e: any) { setUserError(e.message ?? 'Failed'); }
                  finally { setSavingUser(false); }
                }}
                disabled={savingUser}
                className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50">
                {savingUser ? 'Creating…' : 'Create User'}
              </button>
            </div>

            {/* Role reference */}
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(ROLE_INFO).map(([role, info]) => (
                <div key={role} className={`rounded-xl px-4 py-3 border text-xs ${info.color}`}>
                  <div className="font-semibold mb-0.5">{info.label}</div>
                  <div className="opacity-70">{info.description}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {users.map(u => {
                const ri = ROLE_INFO[u.role];
                return (
                  <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-200 font-medium">{u.name ?? u.email}</span>
                        {u.name && <span className="text-xs text-slate-500">{u.email}</span>}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${ri?.color ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                          {ri?.label ?? u.role}
                        </span>
                        {!u.is_active && <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">Inactive</span>}
                        {u.id === currentUser?.id && <span className="text-[11px] text-slate-600">(you)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={u.role}
                        disabled={savingRoleId === u.id || u.id === currentUser?.id}
                        onChange={async e => {
                          const newRole = e.target.value;
                          setSavingRoleId(u.id);
                          try { await api.updateUser(u.id, { role: newRole }); loadUsers(); }
                          finally { setSavingRoleId(null); }
                        }}
                        className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={u.id === currentUser?.id ? "You cannot change your own role" : "Change role"}>
                        <option value="readonly">Read Only</option>
                        <option value="analyst">Analyst</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={async () => { await api.updateUser(u.id, { is_active: !u.is_active }); loadUsers(); }}
                        disabled={u.id === currentUser?.id}
                        className="text-xs px-2.5 py-1 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={u.id === currentUser?.id ? "You cannot deactivate yourself" : ""}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={async () => {
                          const pw = prompt('New password (min 8 chars):');
                          if (!pw || pw.length < 8) return;
                          await api.resetUserPassword(u.id, pw);
                          alert('Password reset. All sessions invalidated.');
                        }}
                        className="text-xs px-2.5 py-1 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors">
                        Reset PW
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete ${u.name ?? u.email}? This cannot be undone.`)) return;
                          setDeletingUserId(u.id);
                          try { await api.deleteUser(u.id); loadUsers(); }
                          finally { setDeletingUserId(null); }
                        }}
                        disabled={deletingUserId === u.id || u.id === currentUser?.id}
                        title={u.id === currentUser?.id ? 'You cannot delete yourself' : 'Delete user'}
                        className="text-xs px-2.5 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {deletingUserId === u.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {users.length === 0 && <p className="text-slate-500 text-sm">No users yet.</p>}
            </div>
          </div>
        )}

        {/* ── SSO / OIDC (disabled) ── */}
        {false && activeTab === 'sso' && (
          <div className="max-w-3xl space-y-6">
            <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="text-sm font-medium text-slate-300 mb-2">Single Sign-On</div>
              <p>MitreMap supports OIDC (OpenID Connect) for SSO. Configured providers appear on the login page and auto-provision users on first sign-in.</p>
              <p className="text-slate-500">SAML 2.0 is not currently supported. Use OIDC-compatible IdPs (Entra ID, Okta, Google Workspace, Keycloak, etc.).</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">
                {editOidcId !== null ? 'Edit OIDC Provider' : 'Add OIDC Provider'}
              </h2>
              {oidcError && (
                <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{oidcError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Display Name</label>
                  <input value={oidcForm.name} onChange={e => setOidcForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Okta, Azure AD"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Slug (URL-safe ID)</label>
                  <input value={oidcForm.slug} onChange={e => setOidcForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                    placeholder="e.g. okta, azure-ad"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Issuer URL</label>
                  <input value={oidcForm.issuer_url} onChange={e => setOidcForm(f => ({ ...f, issuer_url: e.target.value }))}
                    placeholder="https://your-idp.example.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Client ID</label>
                  <input value={oidcForm.client_id} onChange={e => setOidcForm(f => ({ ...f, client_id: e.target.value }))}
                    placeholder="Client ID from your IdP"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Client Secret</label>
                  <input value={oidcForm.client_secret} onChange={e => setOidcForm(f => ({ ...f, client_secret: e.target.value }))}
                    type="password" placeholder="Client secret"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Callback URL (configure in your IdP)</label>
                  <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-xs font-mono text-slate-400 select-all">
                    {window.location.origin}/api/auth/oidc/{oidcForm.slug || '<slug>'}/callback
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {editOidcId !== null && (
                  <button onClick={() => { setEditOidcId(null); setOidcForm(BLANK_OIDC); setOidcError(''); }}
                    className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                )}
                <button
                  onClick={async () => {
                    if (!oidcForm.name || !oidcForm.slug || !oidcForm.issuer_url || !oidcForm.client_id || !oidcForm.client_secret) {
                      setOidcError('All fields are required.'); return;
                    }
                    setSavingOidc(true); setOidcError('');
                    try {
                      if (editOidcId !== null) {
                        await api.updateOidcProvider(editOidcId, oidcForm);
                      } else {
                        await api.createOidcProvider(oidcForm);
                      }
                      setOidcForm(BLANK_OIDC); setEditOidcId(null);
                      loadOidcProviders();
                    } catch (e: any) { setOidcError(e.message ?? 'Save failed'); }
                    finally { setSavingOidc(false); }
                  }}
                  disabled={savingOidc}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                  {savingOidc ? 'Saving…' : editOidcId !== null ? 'Save Changes' : 'Add Provider'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-medium text-slate-300">Configured Providers ({oidcProviders.length})</h2>
              {oidcProviders.map((p: any) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200">{p.name}</div>
                    <div className="text-xs font-mono text-slate-500">{p.slug} · {p.issuer_url}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${p.enabled ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-500 border-slate-700 bg-slate-800'}`}>
                    {p.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => { setEditOidcId(p.id); setOidcForm({ name: p.name, slug: p.slug, issuer_url: p.issuer_url, client_id: p.client_id, client_secret: '', enabled: !!p.enabled }); setOidcError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Edit</button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${p.name}"?`)) return;
                      await api.deleteOidcProvider(p.id);
                      loadOidcProviders();
                    }}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </div>
              ))}
              {oidcProviders.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-6">No OIDC providers configured. Add one above to enable SSO.</div>
              )}
            </div>
          </div>
        )}

        {/* ── ATT&CK Version ── */}
        {activeTab === 'attack_version' && (
          <div className="max-w-3xl space-y-6">
            {attackVersion && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-slate-300 mb-3">Current Active Version</h2>
                <div className="text-2xl font-bold text-indigo-400">{attackVersion.name}</div>
                <div className="text-slate-400 text-sm mt-1">Released {attackVersion.released_at}</div>
                {attackVersion.notes && <div className="text-slate-500 text-xs mt-1">{attackVersion.notes}</div>}
              </div>
            )}

            {/* Check for Updates */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-300">Check for Updates</h2>
                <button
                  onClick={async () => {
                    setCheckLoading(true);
                    setUpdateCheck(null);
                    setUpdateDiff(null);
                    setApplyResult(null);
                    try { setUpdateCheck(await api.checkAttackUpdates()); }
                    catch { setUpdateCheck({ error: 'Failed to reach GitHub API' }); }
                    finally { setCheckLoading(false); }
                  }}
                  disabled={checkLoading || applyLoading}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50">
                  {checkLoading ? 'Checking…' : 'Check for Updates'}
                </button>
              </div>
              <p className="text-slate-500 text-xs mb-3">Queries GitHub for the latest MITRE ATT&CK STIX release and compares it to the active version.</p>
              {updateCheck?.error && <p className="text-red-400 text-sm">{updateCheck.error}</p>}
              {updateCheck && !updateCheck.error && (
                <div className="space-y-3">
                  <div className="flex gap-6 text-sm">
                    <div><span className="text-slate-500">Current: </span><span className="font-mono text-slate-300">{updateCheck.current_version}</span></div>
                    <div><span className="text-slate-500">Latest: </span><span className="font-mono text-indigo-400">{updateCheck.latest_version}</span></div>
                    {updateCheck.published_at && (
                      <div><span className="text-slate-500">Released: </span><span className="text-slate-400">{new Date(updateCheck.published_at).toLocaleDateString()}</span></div>
                    )}
                  </div>
                  {updateCheck.up_to_date ? (
                    <p className="text-green-400 text-sm">You are on the latest ATT&CK version.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <p className="text-yellow-400 text-sm">v{updateCheck.latest_version} is available.</p>
                        <button
                          onClick={async () => {
                            setDiffLoading(true);
                            setUpdateDiff(null);
                            setDiffExpanded({});
                            try { setUpdateDiff(await api.previewAttackUpdate(updateCheck.latest_version)); }
                            catch { setUpdateDiff({ error: 'Failed to load diff' }); }
                            finally { setDiffLoading(false); }
                          }}
                          disabled={diffLoading || applyLoading}
                          className="px-3 py-1.5 text-sm bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 disabled:opacity-50">
                          {diffLoading ? 'Loading diff…' : 'Preview Changes'}
                        </button>
                        <button
                          onClick={async () => {
                            setApplyLoading(true);
                            setApplyResult(null);
                            setMigrationScan(null);
                            setMigrateResult(null);
                            try {
                              const result = await api.applyAttackUpdate(updateCheck.latest_version);
                              setApplyResult(result);
                              loadAttackVersion();
                              const scan = await api.getMigrationScan();
                              setMigrationScan(scan);
                            } catch (e: any) {
                              setApplyResult({ error: e?.message ?? 'Update failed' });
                            } finally { setApplyLoading(false); }
                          }}
                          disabled={applyLoading}
                          className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50">
                          {applyLoading ? 'Applying…' : `Apply v${updateCheck.latest_version}`}
                        </button>
                      </div>

                      {/* Diff Preview */}
                      {updateDiff?.error && <p className="text-red-400 text-sm">{updateDiff.error}</p>}
                      {updateDiff && !updateDiff.error && (
                        <div className="bg-slate-800 rounded-lg p-3 space-y-2 text-xs">
                          <p className="text-slate-300 font-medium">Changes in ATT&CK v{updateDiff.version}:</p>
                          <div className="flex gap-4 text-xs">
                            <span className="text-green-400">+{updateDiff.summary.added} added</span>
                            <span className="text-red-400">-{updateDiff.summary.removed} removed</span>
                            <span className="text-yellow-400">~{updateDiff.summary.renamed} renamed</span>
                            {updateDiff.summary.detections_affected > 0 && (
                              <span className="text-orange-400">{updateDiff.summary.detections_affected} detection(s) affected</span>
                            )}
                          </div>
                          {updateDiff.added.length > 0 && (
                            <div>
                              <button onClick={() => setDiffExpanded(e => ({ ...e, added: !e.added }))} className="text-green-400 hover:text-green-300 font-medium mb-1">
                                {diffExpanded.added ? '▾' : '▸'} New Techniques ({updateDiff.added.length})
                              </button>
                              {diffExpanded.added && (
                                <div className="ml-3 space-y-0.5 max-h-40 overflow-y-auto">
                                  {updateDiff.added.map((t: any) => (
                                    <div key={t.id} className="flex gap-2"><span className="font-mono text-green-400">{t.id}</span><span className="text-slate-400">{t.name}</span></div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {updateDiff.removed.length > 0 && (
                            <div>
                              <button onClick={() => setDiffExpanded(e => ({ ...e, removed: !e.removed }))} className="text-red-400 hover:text-red-300 font-medium mb-1">
                                {diffExpanded.removed ? '▾' : '▸'} Removed Techniques ({updateDiff.removed.length})
                              </button>
                              {diffExpanded.removed && (
                                <div className="ml-3 space-y-0.5 max-h-40 overflow-y-auto">
                                  {updateDiff.removed.map((t: any) => (
                                    <div key={t.id} className="flex gap-2"><span className="font-mono text-red-400">{t.id}</span><span className="text-slate-400">{t.name}</span></div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {updateDiff.renamed.length > 0 && (
                            <div>
                              <button onClick={() => setDiffExpanded(e => ({ ...e, renamed: !e.renamed }))} className="text-yellow-400 hover:text-yellow-300 font-medium mb-1">
                                {diffExpanded.renamed ? '▾' : '▸'} Renamed Techniques ({updateDiff.renamed.length})
                              </button>
                              {diffExpanded.renamed && (
                                <div className="ml-3 space-y-0.5 max-h-40 overflow-y-auto">
                                  {updateDiff.renamed.map((t: any) => (
                                    <div key={t.id} className="flex gap-2">
                                      <span className="font-mono text-yellow-400">{t.id}</span>
                                      <span className="text-slate-500 line-through">{t.old_name}</span>
                                      <span className="text-slate-300">→ {t.new_name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {updateDiff.detections_affected.length > 0 && (
                            <div>
                              <button onClick={() => setDiffExpanded(e => ({ ...e, det: !e.det }))} className="text-orange-400 hover:text-orange-300 font-medium mb-1">
                                {diffExpanded.det ? '▾' : '▸'} Affected Detections ({updateDiff.detections_affected.length})
                              </button>
                              {diffExpanded.det && (
                                <div className="ml-3 space-y-1 max-h-40 overflow-y-auto">
                                  {updateDiff.detections_affected.map((d: any) => (
                                    <div key={d.detection_id} className="flex gap-2">
                                      <span className="text-slate-300">{d.detection_name}</span>
                                      <span className="text-red-400">{d.deprecated_ids.join(', ')}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {applyResult?.error && <p className="text-red-400 text-sm">{applyResult.error}</p>}
                  {applyResult && !applyResult.error && (
                    <div className="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
                      <p className="text-green-400 font-medium">Update applied — ATT&CK v{applyResult.version}</p>
                      <p className="text-slate-400">{applyResult.techniques_new} new · {applyResult.techniques_updated} updated · {applyResult.deprecated_added} newly deprecated · {applyResult.mitigations} mitigations</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Migration Scan */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-300">Migration Scan</h2>
                <button
                  onClick={async () => {
                    setScanLoading(true);
                    setMigrateResult(null);
                    try { setMigrationScan(await api.getMigrationScan()); }
                    finally { setScanLoading(false); }
                  }}
                  disabled={scanLoading || migrateLoading}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50">
                  {scanLoading ? 'Scanning…' : 'Run Scan'}
                </button>
              </div>
              <p className="text-slate-500 text-xs mb-3">Scans all detections for deprecated technique IDs and shows available replacements.</p>
              {migrationScan && (
                migrationScan.detections_affected?.length === 0
                  ? <p className="text-green-400 text-sm">All detections use current technique IDs.</p>
                  : migrationScan.detections_affected?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-yellow-400 text-sm">{migrationScan.total} detection(s) reference deprecated techniques.</p>
                        {migrationScan.detections_affected.some((d: any) => d.can_auto_migrate) && (
                          <button
                            onClick={async () => {
                              setMigrateLoading(true);
                              setMigrateResult(null);
                              try {
                                const result = await api.migrateDetections();
                                setMigrateResult(result);
                                setMigrationScan(await api.getMigrationScan());
                              } catch (e: any) {
                                setMigrateResult({ error: e?.message ?? 'Migration failed' });
                              } finally { setMigrateLoading(false); }
                            }}
                            disabled={migrateLoading}
                            className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            {migrateLoading ? 'Migrating…' : 'Auto-migrate'}
                          </button>
                        )}
                      </div>
                      {migrateResult?.error && <p className="text-red-400 text-sm">{migrateResult.error}</p>}
                      {migrateResult && !migrateResult.error && (
                        <p className="text-green-400 text-sm">Migrated {migrateResult.migrated} detection(s).</p>
                      )}
                      <div className="space-y-1.5">
                        {migrationScan.detections_affected.map((d: any) => (
                          <div key={d.detection_id} className="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
                            <span className="text-slate-300 font-medium">{d.detection_name}</span>
                            <div className="space-y-0.5 mt-1">
                              {d.deprecated_ids.map((id: string) => (
                                <div key={id} className="flex items-center gap-2">
                                  <span className="font-mono text-red-400">{id}</span>
                                  {d.replacements[id]
                                    ? <><span className="text-slate-500">→</span><span className="font-mono text-indigo-400">{d.replacements[id]}</span></>
                                    : <span className="text-slate-500 italic">no replacement</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
              )}
            </div>

            {/* Deprecated Techniques reference list */}
            {deprecated.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-slate-300 mb-3">Deprecated Techniques ({deprecated.length})</h2>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {deprecated.map((d: any) => (
                    <div key={d.technique_id} className="flex items-center gap-3 text-xs py-1">
                      <span className="font-mono text-red-400">{d.technique_id}</span>
                      {d.superseded_by && <span className="text-slate-400">→ <span className="font-mono text-indigo-400">{d.superseded_by}</span></span>}
                      {d.reason && <span className="text-slate-500">{d.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Webhooks ── */}
        {activeTab === 'webhooks' && (
          <div className="max-w-3xl space-y-6">
            {/* Webhook Endpoints */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">
                {editWebhookId !== null ? 'Edit Webhook Endpoint' : 'Add Webhook Endpoint'}
              </h2>
              {canWrite && (
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Name</label>
                      <input value={webhookForm.name} onChange={e => setWebhookForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Slack SOC Channel"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">URL</label>
                      <input value={webhookForm.url} onChange={e => setWebhookForm(f => ({ ...f, url: e.target.value }))}
                        placeholder="https://hooks.example.com/..."
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Secret (optional — for HMAC signature)</label>
                      <input value={webhookForm.secret} onChange={e => setWebhookForm(f => ({ ...f, secret: e.target.value }))}
                        placeholder="my-signing-secret"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Custom Headers (optional — JSON)</label>
                      <input value={webhookForm.custom_headers} onChange={e => setWebhookForm(f => ({ ...f, custom_headers: e.target.value }))}
                        placeholder='{"Authorization":"Bearer token"}'
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono" />
                    </div>
                  </div>
                  {webhookError && <p className="text-xs text-red-400">{webhookError}</p>}
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      if (!webhookForm.name.trim() || !webhookForm.url.trim()) { setWebhookError('Name and URL are required'); return; }
                      setSavingWebhook(true); setWebhookError('');
                      try {
                        const payload = {
                          name: webhookForm.name.trim(),
                          url: webhookForm.url.trim(),
                          secret: webhookForm.secret.trim() || undefined,
                          custom_headers: webhookForm.custom_headers.trim() || undefined,
                        };
                        if (editWebhookId !== null) {
                          await api.updateWebhookConfig(editWebhookId, payload);
                        } else {
                          await api.createWebhookConfig(payload);
                        }
                        setWebhookForm(BLANK_WEBHOOK); setEditWebhookId(null); loadWebhooks();
                      } catch (e: any) { setWebhookError(e.message ?? 'Failed to save'); }
                      setSavingWebhook(false);
                    }} disabled={savingWebhook}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                      {savingWebhook ? 'Saving...' : editWebhookId !== null ? 'Update' : 'Add Endpoint'}
                    </button>
                    {editWebhookId !== null && (
                      <button onClick={() => { setWebhookForm(BLANK_WEBHOOK); setEditWebhookId(null); setWebhookError(''); }}
                        className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {webhookConfigs.length === 0 && <p className="text-slate-500 text-sm">No webhook endpoints configured.</p>}
                {webhookConfigs.map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">{w.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${w.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                          {w.enabled ? 'enabled' : 'disabled'}
                        </span>
                        {w.secret && <span className="text-xs text-slate-500">signed</span>}
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate">{w.url}</div>
                      {testResult?.id === w.id && (
                        <div className={`text-xs mt-1 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                          Test: {testResult.msg}
                        </div>
                      )}
                    </div>
                    <button onClick={async () => {
                      setTestingWebhookId(w.id); setTestResult(null);
                      const r = await api.testWebhookConfig(w.id);
                      setTestResult({ id: w.id, ok: r.ok, msg: r.ok ? `HTTP ${r.status} OK` : (r.error ?? `HTTP ${r.status}`) });
                      setTestingWebhookId(null);
                    }} disabled={testingWebhookId === w.id}
                      className="px-2.5 py-1.5 text-xs text-slate-400 border border-slate-700 rounded hover:text-slate-200 hover:border-slate-500 disabled:opacity-50">
                      {testingWebhookId === w.id ? 'Testing...' : 'Test'}
                    </button>
                    {canWrite && (
                      <>
                        <button onClick={() => { setEditWebhookId(w.id); setWebhookForm({ name: w.name, url: w.url, secret: w.secret ?? '', custom_headers: w.custom_headers ?? '' }); setWebhookError(''); }}
                          className="text-xs text-slate-400 hover:text-blue-400">Edit</button>
                        <button onClick={async () => { await api.deleteWebhookConfig(w.id); loadWebhooks(); }}
                          className="text-xs text-slate-400 hover:text-red-400">Delete</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Alert Rules */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-1">Alert Rules</h2>
              <p className="text-xs text-slate-500 mb-4">
                Define conditions that trigger webhook notifications. Each rule fires to a specific endpoint.
              </p>
              {canWrite && (
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Rule Name</label>
                      <input value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Low coverage alert"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Event Type</label>
                      <select value={ruleForm.type} onChange={e => setRuleForm(f => ({ ...f, type: e.target.value as AlertRuleType }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                        <option value="coverage_threshold">Coverage drops below threshold</option>
                        <option value="detection_validation_failed">Detection validation fails</option>
                        <option value="new_uncovered_group_technique">New uncovered threat group technique</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {ruleForm.type === 'coverage_threshold' && (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Minimum coverage % (alert below this)</label>
                        <input type="number" min="0" max="100" value={ruleForm.threshold}
                          onChange={e => setRuleForm(f => ({ ...f, threshold: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Webhook Endpoint</label>
                      <select value={ruleForm.webhook_config_id} onChange={e => setRuleForm(f => ({ ...f, webhook_config_id: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                        <option value="">Select endpoint...</option>
                        {webhookConfigs.filter(w => w.enabled).map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {ruleError && <p className="text-xs text-red-400">{ruleError}</p>}
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      if (!ruleForm.name.trim() || !ruleForm.webhook_config_id) { setRuleError('Name and endpoint are required'); return; }
                      if (ruleForm.type === 'coverage_threshold' && !ruleForm.threshold) { setRuleError('Threshold is required'); return; }
                      setSavingRule(true); setRuleError('');
                      try {
                        const payload = {
                          name: ruleForm.name.trim(),
                          type: ruleForm.type,
                          threshold: ruleForm.type === 'coverage_threshold' ? Number(ruleForm.threshold) : undefined,
                          webhook_config_id: Number(ruleForm.webhook_config_id),
                        };
                        if (editRuleId !== null) {
                          await api.updateAlertRule(editRuleId, payload);
                        } else {
                          await api.createAlertRule(payload);
                        }
                        setRuleForm(BLANK_RULE); setEditRuleId(null); loadWebhooks();
                      } catch (e: any) { setRuleError(e.message ?? 'Failed to save'); }
                      setSavingRule(false);
                    }} disabled={savingRule}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                      {savingRule ? 'Saving...' : editRuleId !== null ? 'Update' : 'Add Rule'}
                    </button>
                    {editRuleId !== null && (
                      <button onClick={() => { setRuleForm(BLANK_RULE); setEditRuleId(null); setRuleError(''); }}
                        className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {alertRules.length === 0 && <p className="text-slate-500 text-sm">No alert rules configured.</p>}
                {alertRules.map(r => {
                  const typeLabel: Record<string, string> = {
                    coverage_threshold: `Coverage < ${r.threshold}%`,
                    detection_validation_failed: 'Detection validation failed',
                    new_uncovered_group_technique: 'New uncovered group technique',
                  };
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-200">{r.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${r.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                            {r.enabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">{typeLabel[r.type]} → {r.webhook_name}</div>
                        {r.last_notified_at && (
                          <div className="text-xs text-slate-600">Last fired: {new Date(r.last_notified_at).toLocaleString()}</div>
                        )}
                      </div>
                      {canWrite && (
                        <>
                          <button onClick={() => {
                            setEditRuleId(r.id);
                            setRuleForm({ name: r.name, type: r.type, threshold: String(r.threshold ?? ''), webhook_config_id: String(r.webhook_config_id) });
                            setRuleError('');
                          }} className="text-xs text-slate-400 hover:text-blue-400">Edit</button>
                          <button onClick={async () => { await api.deleteAlertRule(r.id); loadWebhooks(); }}
                            className="text-xs text-slate-400 hover:text-red-400">Delete</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payload reference */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-3">Payload Format</h2>
              <p className="text-xs text-slate-500 mb-2">All events POST JSON with this envelope. A <code className="text-slate-400">X-MitreMap-Signature: sha256=...</code> header is added when a secret is set.</p>
              <pre className="text-xs text-slate-400 bg-slate-800 rounded p-3 overflow-x-auto">{`{
  "event": "coverage.threshold_breached",
  "timestamp": "2026-05-13T12:00:00.000Z",
  "data": {
    // coverage.threshold_breached
    "coverage_pct": 45,
    "threshold": 50,

    // detection.validation_failed
    "detection_id": 12,
    "detection_name": "Suspicious PowerShell",
    "test_name": "Atomic T1059.001 Test",

    // threat_group.new_uncovered_technique
    "group_id": 3,
    "group_name": "APT28",
    "technique_id": "T1059.001",
    "technique_name": "PowerShell"
  }
}`}</pre>
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
