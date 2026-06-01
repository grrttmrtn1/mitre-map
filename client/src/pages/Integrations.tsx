import { useEffect, useState } from 'react';
import { api } from '../api';
import type { SiemIntegration, GithubSyncConfig, TicketingConfig } from '../types';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonRow } from '../components/Skeleton';
import { Plus, Trash2, Play, RefreshCw, CheckCircle, XCircle, Loader } from 'lucide-react';

type Tab = 'siem' | 'github' | 'ticketing';

const SIEM_TYPES = ['sentinel', 'splunk', 'elastic', 'crowdstrike', 'qradar', 'chronicle'] as const;
const SIEM_LABELS: Record<string, string> = {
  sentinel: 'Microsoft Sentinel', splunk: 'Splunk', elastic: 'Elastic Security',
  crowdstrike: 'CrowdStrike Falcon', qradar: 'IBM QRadar', chronicle: 'Google Chronicle',
};

interface SiemSchema {
  doc: string;
  docLabel: string;
  configTemplate: Record<string, string>;
  credentialsTemplate: Record<string, string>;
  configHints: Record<string, string>;
  credentialsHints: Record<string, string>;
}

const SIEM_SCHEMA: Record<string, SiemSchema> = {
  sentinel: {
    doc: 'https://learn.microsoft.com/en-us/azure/sentinel/connect-rest-api-template',
    docLabel: 'Azure Sentinel REST API docs',
    configTemplate: { tenant_id: '', subscription_id: '', resource_group: '', workspace_name: '', client_id: '' },
    credentialsTemplate: { client_secret: '' },
    configHints: {
      tenant_id: 'Azure AD tenant (Directory) ID — found in Azure Portal → Azure Active Directory → Overview',
      subscription_id: 'Azure subscription ID — found in Subscriptions blade',
      resource_group: 'Resource group containing the Log Analytics workspace',
      workspace_name: 'Log Analytics workspace name (not the workspace ID)',
      client_id: 'App registration Application (client) ID — needs SecurityInsights Contributor role',
    },
    credentialsHints: {
      client_secret: 'App registration client secret value (not the secret ID)',
    },
  },
  splunk: {
    doc: 'https://docs.splunk.com/Documentation/Splunk/latest/RESTREF/RESTprolog',
    docLabel: 'Splunk REST API reference',
    configTemplate: { base_url: 'https://splunk.example.com:8089', app: 'search' },
    credentialsTemplate: { token: '' },
    configHints: {
      base_url: 'Splunk management port URL — typically port 8089 (must be HTTPS)',
      app: 'Splunk app namespace for saved searches — use "search" for default',
    },
    credentialsHints: {
      token: 'Splunk HEC or REST API token — create in Settings → Tokens',
    },
  },
  elastic: {
    doc: 'https://www.elastic.co/guide/en/security/current/detection-engine-overview.html',
    docLabel: 'Elastic Detection Engine API docs',
    configTemplate: { base_url: 'https://kibana.example.com:5601', space_id: '' },
    credentialsTemplate: { api_key: '' },
    configHints: {
      base_url: 'Kibana base URL (must be HTTPS for production)',
      space_id: 'Kibana space ID — leave empty for the default space',
    },
    credentialsHints: {
      api_key: 'Elastic API key (Base64-encoded id:key) — create in Stack Management → API Keys with "detection_engine" privileges',
    },
  },
  crowdstrike: {
    doc: 'https://falcon.crowdstrike.com/documentation/46/falcon-api-specification',
    docLabel: 'CrowdStrike Falcon API docs',
    configTemplate: { base_url: 'https://api.crowdstrike.com' },
    credentialsTemplate: { client_id: '', client_secret: '' },
    configHints: {
      base_url: 'Falcon API base URL — use https://api.eu-1.crowdstrike.com for EU tenants',
    },
    credentialsHints: {
      client_id: 'OAuth2 client ID — create in Support & Resources → API Clients & Keys with Custom IOA Write scope',
      client_secret: 'OAuth2 client secret (shown once at creation time)',
    },
  },
  qradar: {
    doc: 'https://www.ibm.com/docs/en/qsip/7.5?topic=api-restful-overview',
    docLabel: 'IBM QRadar REST API docs',
    configTemplate: { base_url: 'https://qradar.example.com' },
    credentialsTemplate: { token: '' },
    configHints: {
      base_url: 'QRadar console base URL (must be HTTPS)',
    },
    credentialsHints: {
      token: 'QRadar authorized service token — create in Admin → Authorized Services with Security permissions',
    },
  },
  chronicle: {
    doc: 'https://cloud.google.com/chronicle/docs/reference/rest',
    docLabel: 'Google SecOps Chronicle API docs',
    configTemplate: { project_id: '', instance_id: '', region: 'us' },
    credentialsTemplate: { service_account_json: '{"type":"service_account","project_id":"..."}' },
    configHints: {
      project_id: 'Google Cloud project ID hosting the Chronicle instance',
      instance_id: 'Chronicle instance ID — found in Settings → SIEM Settings',
      region: 'Chronicle deployment region: us, europe, asia-southeast1, etc.',
    },
    credentialsHints: {
      service_account_json: 'Full service account JSON key (paste the entire downloaded JSON) — needs Chronicle API Editor role',
    },
  },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 dark:text-slate-600 text-xs">—</span>;
  const ok = status === 'ok';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
      {ok ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {status}
    </span>
  );
}

// ── SIEM tab ──────────────────────────────────────────────────────────────────

function SiemTab() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<SiemIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'splunk', config: JSON.stringify(SIEM_SCHEMA.splunk.configTemplate, null, 2), credentials: JSON.stringify(SIEM_SCHEMA.splunk.credentialsTemplate, null, 2) });

  useEffect(() => {
    api.getSiemIntegrations().then(setIntegrations).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    let config: Record<string, any> = {};
    let credentials: Record<string, string> = {};
    try { config = JSON.parse(form.config); } catch { toast.error('Config must be valid JSON'); return; }
    try { credentials = JSON.parse(form.credentials); } catch { toast.error('Credentials must be valid JSON'); return; }
    try {
      const created = await api.createSiemIntegration({ name: form.name, type: form.type, config, credentials });
      setIntegrations(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ name: '', type: 'splunk', config: JSON.stringify(SIEM_SCHEMA.splunk.configTemplate, null, 2), credentials: JSON.stringify(SIEM_SCHEMA.splunk.credentialsTemplate, null, 2) });
      toast.success('Integration created');
    } catch { toast.error('Failed to create integration'); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSiemIntegration(deleteTarget);
      setIntegrations(prev => prev.filter(i => i.id !== deleteTarget));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleTest(id: number) {
    setTesting(id);
    try {
      const result = await api.testSiemIntegration(id);
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, last_push_status: result.ok ? 'ok' : 'error' } : i));
      if (result.ok) toast.success(`Connected: ${result.message}`);
      else toast.error(`Connection failed: ${result.message}`);
    } catch { toast.error('Test failed'); }
    setTesting(null);
  }

  async function handleToggle(integration: SiemIntegration) {
    try {
      const updated = await api.updateSiemIntegration(integration.id, { enabled: integration.enabled === 0 });
      setIntegrations(prev => prev.map(i => i.id === updated.id ? updated : i));
    } catch { toast.error('Failed to update'); }
  }

  if (loading) return <div className="space-y-2 pt-2">{[0,1,2].map(i => <SkeletonRow key={i} className="bg-gray-100/40 dark:bg-slate-800/40 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete integration"
        message="This will permanently remove the SIEM integration and its credentials."
        confirmLabel="Delete"
        destructive
        confirming={deleting}
      />
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">Push SIGMA rules to your SIEM and sync rule status.</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
          <Plus size={14} /> Add Integration
        </button>
      </div>

      {showForm && (() => {
        const schema = SIEM_SCHEMA[form.type];
        return (
          <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
            {/* Name + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder={`My ${SIEM_LABELS[form.type]} integration`}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
                <select value={form.type} onChange={e => {
                  const s = SIEM_SCHEMA[e.target.value];
                  setForm(f => ({ ...f, type: e.target.value, config: JSON.stringify(s.configTemplate, null, 2), credentials: JSON.stringify(s.credentialsTemplate, null, 2) }));
                }} className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100">
                  {SIEM_TYPES.map(t => <option key={t} value={t}>{SIEM_LABELS[t]}</option>)}
                </select>
              </div>
            </div>

            {/* Doc link */}
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <a href={schema.doc} target="_blank" rel="noopener noreferrer" className="hover:underline">{schema.docLabel}</a>
            </div>

            {/* Config */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                Config <span className="font-normal text-gray-400 dark:text-slate-500">(non-sensitive — not encrypted)</span>
              </label>
              <div className="mb-2 space-y-1">
                {Object.entries(schema.configHints).map(([key, hint]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <code className="flex-shrink-0 font-mono text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1 rounded">{key}</code>
                    <span className="text-gray-500 dark:text-slate-400">{hint}</span>
                  </div>
                ))}
              </div>
              <textarea value={form.config} onChange={e => setForm(f => ({ ...f, config: e.target.value }))} rows={Object.keys(schema.configTemplate).length + 2}
                className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>

            {/* Credentials */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                Credentials <span className="font-normal text-gray-400 dark:text-slate-500">(stored AES-256-GCM encrypted)</span>
              </label>
              <div className="mb-2 space-y-1">
                {Object.entries(schema.credentialsHints).map(([key, hint]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <code className="flex-shrink-0 font-mono text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1 rounded">{key}</code>
                    <span className="text-gray-500 dark:text-slate-400">{hint}</span>
                  </div>
                ))}
              </div>
              <textarea value={form.credentials} onChange={e => setForm(f => ({ ...f, credentials: e.target.value }))} rows={Object.keys(schema.credentialsTemplate).length + 2}
                className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Save</button>
            </div>
          </form>
        );
      })()}

      {integrations.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-600 text-sm">No SIEM integrations configured yet.</div>
      ) : (
        <div className="space-y-2">
          {integrations.map(integ => (
            <div key={integ.id} className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-slate-100">{integ.name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">{SIEM_LABELS[integ.type] ?? integ.type}</span>
                  <button onClick={() => handleToggle(integ)}
                    className={`text-xs px-1.5 py-0.5 rounded ${integ.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {integ.enabled ? 'enabled' : 'disabled'}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500 dark:text-slate-500">Push: <StatusBadge status={integ.last_push_status} /></span>
                  <span className="text-xs text-gray-500 dark:text-slate-500">Pull: <StatusBadge status={integ.last_pull_status} /></span>
                  {integ.last_pushed_at && <span className="text-xs text-gray-400 dark:text-slate-600">Last push {new Date(integ.last_pushed_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleTest(integ.id)} disabled={testing === integ.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50">
                  {testing === integ.id ? <Loader size={12} className="animate-spin" /> : <Play size={12} />} Test
                </button>
                <button onClick={() => setDeleteTarget(integ.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GitHub Sync tab ───────────────────────────────────────────────────────────

function GithubSyncTab() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<GithubSyncConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', repo_url: '', branch: 'main', path_glob: '**/*.yml', token: '' });

  useEffect(() => {
    api.getGithubSyncConfigs().then(setConfigs).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await api.createGithubSyncConfig({ ...form, token: form.token || undefined });
      setConfigs(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ name: '', repo_url: '', branch: 'main', path_glob: '**/*.yml', token: '' });
      toast.success('Config created');
    } catch { toast.error('Failed to create config'); }
  }

  async function handleRun(id: number) {
    setRunning(id);
    try {
      const result = await api.runGithubSync(id);
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, last_sha: result.sha, last_synced_at: new Date().toISOString() } : c));
      toast.success(`Synced: ${result.staged} file(s) staged`);
    } catch (e: any) { toast.error(e.message ?? 'Sync failed'); }
    setRunning(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteGithubSyncConfig(deleteTarget);
      setConfigs(prev => prev.filter(c => c.id !== deleteTarget));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleting(false);
    setDeleteTarget(null);
  }

  if (loading) return <div className="space-y-2 pt-2">{[0,1,2].map(i => <SkeletonRow key={i} className="bg-gray-100/40 dark:bg-slate-800/40 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete sync config"
        message="This will permanently remove the GitHub sync configuration."
        confirmLabel="Delete"
        destructive
        confirming={deleting}
      />
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">Pull SIGMA rules from GitHub repositories into the library.</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
          <Plus size={14} /> Add Repo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Repository URL</label>
              <input value={form.repo_url} onChange={e => setForm(f => ({ ...f, repo_url: e.target.value }))} required placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Branch</label>
              <input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Path Glob</label>
              <input value={form.path_glob} onChange={e => setForm(f => ({ ...f, path_glob: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">GitHub Token (optional, stored encrypted)</label>
            <input type="password" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} placeholder="ghp_…"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Save</button>
          </div>
        </form>
      )}

      {configs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-600 text-sm">No GitHub sync repos configured.</div>
      ) : (
        <div className="space-y-2">
          {configs.map(cfg => (
            <div key={cfg.id} className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-slate-100">{cfg.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {cfg.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{cfg.repo_url} • {cfg.branch} • {cfg.path_glob}</p>
                {cfg.last_synced_at && (
                  <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">
                    Last sync {new Date(cfg.last_synced_at).toLocaleString()} • SHA {cfg.last_sha?.slice(0, 7)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleRun(cfg.id)} disabled={running === cfg.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-50">
                  {running === cfg.id ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync Now
                </button>
                <button onClick={() => setDeleteTarget(cfg.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ticketing tab ─────────────────────────────────────────────────────────────

function TicketingTab() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<TicketingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'jira', base_url: '', default_project: '', credentials: '{}' });

  useEffect(() => {
    api.getTicketingConfigs().then(setConfigs).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    let credentials: Record<string, string> = {};
    try { credentials = JSON.parse(form.credentials); } catch { toast.error('Credentials must be valid JSON'); return; }
    try {
      const created = await api.createTicketingConfig({ name: form.name, type: form.type, base_url: form.base_url, credentials, default_project: form.default_project || undefined });
      setConfigs(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ name: '', type: 'jira', base_url: '', default_project: '', credentials: '{}' });
      toast.success('Ticketing config created');
    } catch { toast.error('Failed to create config'); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteTicketingConfig(deleteTarget);
      setConfigs(prev => prev.filter(c => c.id !== deleteTarget));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
    setDeleting(false);
    setDeleteTarget(null);
  }

  if (loading) return <div className="space-y-2 pt-2">{[0,1,2].map(i => <SkeletonRow key={i} className="bg-gray-100/40 dark:bg-slate-800/40 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete ticketing config"
        message="This will permanently remove the ticketing configuration and its credentials."
        confirmLabel="Delete"
        destructive
        confirming={deleting}
      />
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-slate-400">Create tickets in Jira or ServiceNow from detection gaps.</p>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
          <Plus size={14} /> Add Config
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100">
                <option value="jira">Jira</option>
                <option value="servicenow">ServiceNow</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Base URL</label>
              <input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} required placeholder="https://acme.atlassian.net"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Default Project / Board</label>
              <input value={form.default_project} onChange={e => setForm(f => ({ ...f, default_project: e.target.value }))} placeholder="SEC"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Credentials (JSON — stored encrypted)
              {form.type === 'jira' ? ' — e.g. {"username":"user@co.com","token":"xxx"}' : ' — e.g. {"username":"admin","password":"xxx"}'}
            </label>
            <textarea value={form.credentials} onChange={e => setForm(f => ({ ...f, credentials: e.target.value }))} rows={3}
              className="w-full px-3 py-1.5 text-sm font-mono border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Save</button>
          </div>
        </form>
      )}

      {configs.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-600 text-sm">No ticketing configs configured.</div>
      ) : (
        <div className="space-y-2">
          {configs.map(cfg => (
            <div key={cfg.id} className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-slate-100">{cfg.name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded capitalize">{cfg.type}</span>
                  {cfg.default_project && <span className="text-xs text-gray-400 dark:text-slate-500">Project: {cfg.default_project}</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{cfg.base_url}</p>
              </div>
              <button onClick={() => setDeleteTarget(cfg.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Integrations() {
  const [tab, setTab] = useState<Tab>('siem');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'siem', label: 'SIEM' },
    { id: 'github', label: 'GitHub Sync' },
    { id: 'ticketing', label: 'Ticketing' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Integrations</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">SIEM connectors, SIGMA sync, and ticketing</p>
      </div>

      <div className="flex-shrink-0 px-6 pt-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'siem' && <SiemTab />}
        {tab === 'github' && <GithubSyncTab />}
        {tab === 'ticketing' && <TicketingTab />}
      </div>
    </div>
  );
}
