import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import type {
  TaxiiServer, TaxiiJob, TaxiiBatch, TaxiiPendingItem, TaxiiCollection,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  create_group: 'Create Threat Group',
  update_group: 'Update Threat Group',
  create_technique: 'Create Technique',
  link_technique: 'Link Technique to Group',
};
const ACTION_COLORS: Record<string, string> = {
  create_group: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  update_group: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  create_technique: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  link_technique: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-300 border-slate-600',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};
const JOB_STATUS_COLORS: Record<string, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  running: 'text-amber-400',
  pending: 'text-slate-400',
};

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
];

// ── Small components ──────────────────────────────────────────────────────────

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      {text}
    </span>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      {action}
    </div>
  );
}

// ── Server Form Modal ─────────────────────────────────────────────────────────

interface ServerFormData {
  name: string; url: string; api_root: string; collection_id: string;
  auth_type: string; username: string; password: string; token: string;
  ssl_verify: number; notes: string;
}

const emptyServer = (): ServerFormData => ({
  name: '', url: '', api_root: '', collection_id: '',
  auth_type: 'none', username: '', password: '', token: '',
  ssl_verify: 1, notes: '',
});

function ServerModal({
  server, onSave, onClose,
}: {
  server: TaxiiServer | null;
  onSave: (data: ServerFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ServerFormData>(
    server ? {
      name: server.name, url: server.url,
      api_root: server.api_root ?? '', collection_id: server.collection_id ?? '',
      auth_type: server.auth_type, username: '', password: '', token: '',
      ssl_verify: server.ssl_verify, notes: server.notes ?? '',
    } : emptyServer(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof ServerFormData, val: string | number) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200">{server ? 'Edit TAXII Server' : 'Add TAXII Server'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Display Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">TAXII Server URL *</label>
              <input value={form.url} onChange={e => set('url', e.target.value)} required
                placeholder="https://taxii.example.com"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">API Root Path</label>
              <input value={form.api_root} onChange={e => set('api_root', e.target.value)}
                placeholder="/taxii2"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Collection ID</label>
              <input value={form.collection_id} onChange={e => set('collection_id', e.target.value)}
                placeholder="enterprise-attack"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Authentication</label>
            <select value={form.auth_type} onChange={e => set('auth_type', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
              <option value="none">None</option>
              <option value="basic">HTTP Basic</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>

          {form.auth_type === 'basic' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Username</label>
                <input value={form.username} onChange={e => set('username', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

          {form.auth_type === 'bearer' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Bearer Token</label>
              <input type="password" value={form.token} onChange={e => set('token', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="ssl_verify" checked={form.ssl_verify === 1}
              onChange={e => set('ssl_verify', e.target.checked ? 1 : 0)}
              className="rounded border-slate-600 bg-slate-800" />
            <label htmlFor="ssl_verify" className="text-xs text-slate-400">Verify SSL certificate</label>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors">
              {saving ? 'Saving…' : (server ? 'Save Changes' : 'Add Server')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Job Form Modal ─────────────────────────────────────────────────────────────

interface JobFormData { server_id: number; name: string; schedule: string; enabled: number }

function JobModal({
  servers, job, onSave, onClose,
}: {
  servers: TaxiiServer[];
  job: TaxiiJob | null;
  onSave: (data: JobFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<JobFormData>({
    server_id: job?.server_id ?? (servers[0]?.id ?? 0),
    name: job?.name ?? '',
    schedule: job?.schedule ?? '0 0 * * *',
    enabled: job?.enabled ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof JobFormData>(key: K, val: JobFormData[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200">{job ? 'Edit Schedule' : 'New Scheduled Ingest'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Job Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">TAXII Server *</label>
            <select value={form.server_id} onChange={e => set('server_id', Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
              {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Schedule (cron)</label>
            <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
              placeholder="0 0 * * *"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono" />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {CRON_PRESETS.map(p => (
                <button key={p.value} type="button" onClick={() => set('schedule', p.value)}
                  className="text-xs text-slate-400 hover:text-blue-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 hover:border-blue-500 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="job_enabled" checked={form.enabled === 1}
              onChange={e => set('enabled', e.target.checked ? 1 : 0)}
              className="rounded border-slate-600 bg-slate-800" />
            <label htmlFor="job_enabled" className="text-xs text-slate-400">Enable job</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors">
              {saving ? 'Saving…' : (job ? 'Save Changes' : 'Create Job')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Batch Preview Panel ───────────────────────────────────────────────────────

function BatchDetail({ batch, onDone }: { batch: TaxiiBatch; onDone: () => void }) {
  const [items, setItems] = useState<TaxiiPendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.getTaxiiBatchItems(batch.batch_id)); }
    finally { setLoading(false); }
  }, [batch.batch_id]);

  useEffect(() => { load(); }, [load]);

  async function approveAll() {
    setWorking(true);
    try { await api.approveTaxiiBatch(batch.batch_id); await load(); onDone(); }
    catch (err: any) { alert(err.message); }
    finally { setWorking(false); }
  }

  async function rejectAll() {
    if (!confirm('Reject all pending items in this batch?')) return;
    setWorking(true);
    try { await api.rejectTaxiiBatch(batch.batch_id); await load(); onDone(); }
    catch (err: any) { alert(err.message); }
    finally { setWorking(false); }
  }

  async function toggleItem(item: TaxiiPendingItem, approve: boolean) {
    setWorking(true);
    try {
      if (approve) await api.approveTaxiiItem(item.id);
      else await api.rejectTaxiiItem(item.id);
      await load(); onDone();
    } catch (err: any) { alert(err.message); }
    finally { setWorking(false); }
  }

  const visible = filter === 'all' ? items : items.filter(i => i.status === filter);
  const pending = items.filter(i => i.status === 'pending');

  return (
    <div className="flex flex-col h-full">
      {/* Batch header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-slate-400">{batch.batch_id}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            From <span className="text-slate-300">{batch.server_name}</span> · {new Date(batch.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">{batch.pending_count} pending</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-emerald-400">{batch.approved_count} approved</span>
          <span className="text-slate-700">·</span>
          <span className="text-xs text-red-400">{batch.rejected_count} rejected</span>
        </div>
      </div>

      {/* Bulk actions */}
      {pending.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={approveAll} disabled={working}
            className="flex-1 py-1.5 text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded transition-colors disabled:opacity-50">
            Approve All ({pending.length})
          </button>
          <button onClick={rejectAll} disabled={working}
            className="flex-1 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors disabled:opacity-50">
            Reject All
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              filter === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && <span className="ml-1 text-slate-500">({items.filter(i => i.status === f).length})</span>}
          </button>
        ))}
      </div>

      {/* Item list */}
      {loading ? (
        <div className="text-xs text-slate-500 py-4 text-center">Loading…</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {visible.length === 0 && (
            <div className="text-xs text-slate-500 py-6 text-center">No items</div>
          )}
          {visible.map(item => (
            <div key={item.id} className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge text={ACTION_LABELS[item.proposed_action] ?? item.proposed_action}
                      className={ACTION_COLORS[item.proposed_action] ?? 'bg-slate-700 text-slate-300 border-slate-600'} />
                    <Badge text={item.status} className={STATUS_COLORS[item.status] ?? STATUS_COLORS.pending} />
                  </div>
                  <div className="text-xs text-slate-200 font-medium truncate">{item.name ?? item.stix_id}</div>
                  <ProposedDataSummary action={item.proposed_action} data={item.proposed_data} />
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleItem(item, true)} disabled={working}
                      className="px-2 py-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded transition-colors disabled:opacity-50">
                      ✓
                    </button>
                    <button onClick={() => toggleItem(item, false)} disabled={working}
                      className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors disabled:opacity-50">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProposedDataSummary({ action, data }: { action: string; data: Record<string, unknown> }) {
  if (action === 'link_technique') {
    return (
      <div className="text-xs text-slate-400 mt-0.5 font-mono">
        {String(data.group_id)} → {String(data.technique_id)}
      </div>
    );
  }
  if (action === 'create_group' || action === 'update_group') {
    const aliases = (data.aliases as string[] | undefined) ?? [];
    return (
      <div className="text-xs text-slate-400 mt-0.5">
        ID: <span className="font-mono text-slate-300">{String(data.id)}</span>
        {aliases.length > 0 && ` · aliases: ${aliases.slice(0, 3).join(', ')}`}
      </div>
    );
  }
  if (action === 'create_technique') {
    return (
      <div className="text-xs text-slate-400 mt-0.5">
        ID: <span className="font-mono text-slate-300">{String(data.id)}</span>
      </div>
    );
  }
  return null;
}

// ── Servers Tab ───────────────────────────────────────────────────────────────

function FetchStatusBadge({ server }: { server: TaxiiServer }) {
  if (!server.last_fetch_status) return null;
  if (server.last_fetch_status === 'running') {
    return <span className="text-xs text-amber-400 animate-pulse">Fetching…</span>;
  }
  if (server.last_fetch_status === 'error') {
    return (
      <span className="text-xs text-red-400" title={server.last_fetch_error ?? undefined}>
        Fetch failed
      </span>
    );
  }
  if (server.last_fetch_status === 'success') {
    const staged = server.last_fetch_items ?? 0;
    const skipped = server.last_fetch_skipped;
    const skippedLabel = skipped != null && skipped > 0 ? `, ${skipped.toLocaleString()} skipped` : '';
    return (
      <span className="text-xs text-emerald-400">
        {staged === 0 ? `Up to date${skippedLabel}` : `${staged} staged${skippedLabel}`}
      </span>
    );
  }
  return null;
}

function ServersTab({ servers, onRefresh, onFetchStarted }: { servers: TaxiiServer[]; onRefresh: () => void; onFetchStarted: () => void }) {
  const [modal, setModal] = useState<'add' | TaxiiServer | null>(null);
  const [fetching, setFetching] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; collections?: TaxiiCollection[]; error?: string } | null>(null);

  // Poll while any server is in 'running' state
  useEffect(() => {
    const hasRunning = servers.some(s => s.last_fetch_status === 'running');
    if (!hasRunning) return;
    const t = setInterval(() => onRefresh(), 4000);
    return () => clearInterval(t);
  }, [servers, onRefresh]);

  async function handleSave(data: ServerFormData) {
    if (modal === 'add') await api.createTaxiiServer(data);
    else await api.updateTaxiiServer((modal as TaxiiServer).id, data);
    onRefresh();
  }

  async function handleDelete(server: TaxiiServer) {
    if (!confirm(`Delete server "${server.name}"? All its batches will also be removed.`)) return;
    await api.deleteTaxiiServer(server.id);
    onRefresh();
  }

  async function handleTest(server: TaxiiServer) {
    setTesting(server.id); setTestResult(null);
    try {
      const result = await api.testTaxiiServer(server.id);
      setTestResult({ id: server.id, ...result });
    } catch (err: any) {
      setTestResult({ id: server.id, error: err.message });
    } finally { setTesting(null); }
  }

  async function handleFetch(server: TaxiiServer) {
    setFetching(server.id);
    try {
      await api.fetchTaxiiServer(server.id);
      onFetchStarted();
    } catch (err: any) { alert(`Fetch failed: ${err.message}`); }
    finally { setFetching(null); }
  }

  return (
    <div>
      <SectionHeader
        title="TAXII 2.1 Servers"
        action={
          <button onClick={() => setModal('add')}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors">
            + Add Server
          </button>
        }
      />

      {servers.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          <div className="text-2xl mb-2">⚡</div>
          No TAXII servers configured. Add one to start ingesting threat intel.
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map(server => (
            <div key={server.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{server.name}</span>
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{server.auth_type}</span>
                    {server.ssl_verify === 0 && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">SSL verify off</span>
                    )}
                    <FetchStatusBadge server={server} />
                  </div>
                  <div className="text-xs text-slate-400 font-mono truncate">{server.url}</div>
                  {server.api_root && <div className="text-xs text-slate-500">API root: {server.api_root}</div>}
                  {server.collection_id && <div className="text-xs text-slate-500">Collection: {server.collection_id}</div>}
                  {server.last_fetch_status === 'error' && server.last_fetch_error && (
                    <div className="mt-1 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 font-mono truncate" title={server.last_fetch_error}>
                      {server.last_fetch_error}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleTest(server)} disabled={testing === server.id}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors disabled:opacity-50">
                    {testing === server.id ? '…' : 'Test'}
                  </button>
                  <button onClick={() => handleFetch(server)} disabled={fetching === server.id}
                    className="px-2.5 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded transition-colors disabled:opacity-50">
                    {fetching === server.id ? 'Fetching…' : 'Fetch Now'}
                  </button>
                  <button onClick={() => setModal(server)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(server)}
                    className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors">
                    Delete
                  </button>
                </div>
              </div>

              {testResult?.id === server.id && (
                <div className={`mt-3 pt-3 border-t border-slate-700 text-xs ${testResult.error ? 'text-red-400' : 'text-emerald-400'}`}>
                  {testResult.error ? (
                    <span>Connection failed: {testResult.error}</span>
                  ) : (
                    <div>
                      <span className="font-medium">Connection OK</span> — {testResult.collections?.length ?? 0} collection(s) found
                      {testResult.collections && testResult.collections.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-slate-400">
                          {testResult.collections.map(c => (
                            <li key={c.id} className="font-mono">{c.id}: {c.title}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <ServerModal
          server={modal === 'add' ? null : modal as TaxiiServer}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 120_000;

function PreviewTab({ fetchStartedAt, servers }: { fetchStartedAt: number | null; servers: TaxiiServer[] }) {
  const [batches, setBatches] = useState<TaxiiBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TaxiiBatch | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try { setBatches(await api.getTaxiiBatches()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 5 s while waiting for a background fetch (up to FETCH_TIMEOUT_MS)
  useEffect(() => {
    if (batches.length > 0 || fetchStartedAt === null) return;
    const t = setInterval(() => {
      setNow(Date.now());
      api.getTaxiiBatches().then(b => { if (b.length > 0) setBatches(b); }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [batches.length, fetchStartedAt]);

  if (loading) {
    return <div className="text-xs text-slate-500 py-8 text-center">Loading…</div>;
  }

  if (batches.length === 0) {
    // Check if any server has a known terminal status from the most recent fetch
    const lastServer = fetchStartedAt !== null
      ? servers.find(s => s.last_fetch_at !== null && s.last_fetch_status !== 'running')
      : null;

    if (fetchStartedAt === null) {
      return (
        <div className="text-center py-12 text-slate-500 text-sm">
          <div className="text-2xl mb-2">◷</div>
          No staged batches yet. Use <span className="text-slate-400">Fetch Now</span> on the Servers tab to pull threat intel.
        </div>
      );
    }

    if (lastServer?.last_fetch_status === 'error') {
      return (
        <div className="text-center py-12 text-sm">
          <div className="text-2xl mb-2">⚠</div>
          <div className="text-red-400 font-medium mb-1">Fetch failed</div>
          <div className="text-red-400/70 text-xs max-w-sm mx-auto font-mono mt-1 break-all">
            {lastServer.last_fetch_error}
          </div>
          <div className="text-slate-500 text-xs mt-2">Check the server URL, API root, and collection ID, then try again.</div>
        </div>
      );
    }

    if (lastServer?.last_fetch_status === 'success' && (lastServer.last_fetch_items ?? 0) === 0) {
      const skipped = lastServer.last_fetch_skipped;
      return (
        <div className="text-center py-12 text-sm">
          <div className="text-2xl mb-2">✓</div>
          <div className="text-emerald-400 font-medium mb-1">Already up to date</div>
          <div className="text-slate-500 text-xs max-w-xs mx-auto">
            The feed was fetched successfully but contained no new data to stage.
            {skipped != null && skipped > 0 && (
              <span className="block mt-1">{skipped.toLocaleString()} objects skipped (already imported or not applicable).</span>
            )}
          </div>
        </div>
      );
    }

    if (now - fetchStartedAt > FETCH_TIMEOUT_MS) {
      return (
        <div className="text-center py-12 text-sm">
          <div className="text-2xl mb-2">⚠</div>
          <div className="text-red-400 font-medium mb-1">Fetch timed out — no items staged</div>
          <div className="text-slate-500 text-xs max-w-xs mx-auto">
            The background fetch did not produce results within 2 minutes. Check that the server URL and API root are correct, then try again.
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        <div className="text-2xl mb-2">◷</div>
        Fetch running in background — staged items will appear here automatically.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Batch list */}
      <div className="w-72 flex-shrink-0 space-y-2 overflow-y-auto">
        {batches.map(batch => (
          <button key={batch.batch_id} onClick={() => setSelected(batch)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selected?.batch_id === batch.batch_id
                ? 'bg-blue-600/20 border-blue-500/40'
                : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
            }`}>
            <div className="text-xs text-slate-200 font-medium mb-0.5">{batch.server_name}</div>
            <div className="text-xs font-mono text-slate-500 truncate mb-1">{batch.batch_id.slice(0, 16)}…</div>
            <div className="text-xs text-slate-500">{new Date(batch.created_at).toLocaleDateString()}</div>
            <div className="flex gap-2 mt-1.5">
              {batch.pending_count > 0 && (
                <span className="text-xs text-slate-300 bg-slate-700 px-1.5 py-0.5 rounded">{batch.pending_count} pending</span>
              )}
              {batch.approved_count > 0 && (
                <span className="text-xs text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">{batch.approved_count} approved</span>
              )}
              {batch.rejected_count > 0 && (
                <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{batch.rejected_count} rejected</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Batch detail */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {selected ? (
          <BatchDetail batch={selected} onDone={load} />
        ) : (
          <div className="text-xs text-slate-500 py-8 text-center">Select a batch to review</div>
        )}
      </div>
    </div>
  );
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────

function ScheduleTab({ servers }: { servers: TaxiiServer[] }) {
  const [jobs, setJobs] = useState<TaxiiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | TaxiiJob | null>(null);
  const [running, setRunning] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setJobs(await api.getTaxiiJobs()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: JobFormData) {
    if (modal === 'add') await api.createTaxiiJob(data);
    else await api.updateTaxiiJob((modal as TaxiiJob).id, { name: data.name, schedule: data.schedule, enabled: data.enabled });
    await load();
  }

  async function handleDelete(job: TaxiiJob) {
    if (!confirm(`Delete scheduled job "${job.name}"?`)) return;
    await api.deleteTaxiiJob(job.id);
    await load();
  }

  async function handleToggle(job: TaxiiJob) {
    await api.updateTaxiiJob(job.id, { enabled: job.enabled ? 0 : 1 });
    await load();
  }

  async function handleRun(job: TaxiiJob) {
    setRunning(job.id);
    try {
      await api.runTaxiiJob(job.id);
      await load();
    } catch (err: any) { alert(err.message); }
    finally { setRunning(null); }
  }

  if (loading) {
    return <div className="text-xs text-slate-500 py-8 text-center">Loading…</div>;
  }

  return (
    <div>
      <SectionHeader
        title="Scheduled Ingest Jobs"
        action={
          <button onClick={() => setModal('add')} disabled={servers.length === 0}
            title={servers.length === 0 ? 'Add a server first' : undefined}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded transition-colors">
            + New Job
          </button>
        }
      />

      {servers.length === 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          Add a TAXII server first before creating scheduled jobs.
        </div>
      )}

      {jobs.length === 0 && servers.length > 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          <div className="text-2xl mb-2">⏱</div>
          No scheduled jobs. Create one to automatically stage threat intel for review.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200">{job.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      job.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-500 border-slate-600'
                    }`}>{job.enabled ? 'enabled' : 'disabled'}</span>
                    {job.last_status && (
                      <span className={`text-xs ${JOB_STATUS_COLORS[job.last_status] ?? 'text-slate-400'}`}>
                        {job.last_status}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    Server: <span className="text-slate-300">{job.server_name}</span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    Schedule: <span className="font-mono text-slate-300">{job.schedule}</span>
                  </div>
                  {job.last_run && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      Last run: {new Date(job.last_run).toLocaleString()}
                    </div>
                  )}
                  {job.last_error && (
                    <div className="text-xs text-red-400 mt-1 bg-red-500/10 rounded px-2 py-1 font-mono truncate">
                      {job.last_error}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleRun(job)} disabled={running === job.id}
                    className="px-2.5 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded transition-colors disabled:opacity-50">
                    {running === job.id ? 'Running…' : 'Run Now'}
                  </button>
                  <button onClick={() => handleToggle(job)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors">
                    {job.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => setModal(job)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(job)}
                    className="px-2.5 py-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <JobModal
          servers={servers}
          job={modal === 'add' ? null : modal as TaxiiJob}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'servers' | 'preview' | 'schedule';

export default function TaxiiIngest() {
  const [tab, setTab] = useState<Tab>('servers');
  const [servers, setServers] = useState<TaxiiServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [fetchStartedAt, setFetchStartedAt] = useState<number | null>(null);

  const loadServers = useCallback(async () => {
    setLoadingServers(true);
    try { setServers(await api.getTaxiiServers()); }
    finally { setLoadingServers(false); }
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'servers', label: 'Servers' },
    { id: 'preview', label: 'Preview' },
    { id: 'schedule', label: 'Schedule' },
  ];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">TAXII 2.1 Threat Intel Ingest</h1>
        <p className="text-xs text-slate-400 mt-1">
          Pull TTPs (techniques & threat groups) from TAXII 2.1 feeds. IOCs are never imported.
          Stage changes for review before committing to the database.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loadingServers && tab === 'servers' ? (
          <div className="text-xs text-slate-500 py-8 text-center">Loading…</div>
        ) : tab === 'servers' ? (
          <ServersTab servers={servers} onRefresh={loadServers} onFetchStarted={() => { setFetchStartedAt(Date.now()); setTab('preview'); }} />
        ) : tab === 'preview' ? (
          <PreviewTab fetchStartedAt={fetchStartedAt} servers={servers} />
        ) : (
          <ScheduleTab servers={servers} />
        )}
      </div>
    </div>
  );
}
