import { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { PageShell, PageHeader, PageContent } from '../components/ui/PageShell';

type Operation = { id: string; kind: string; name: string; source?: string; schedule?: string; enabled?: boolean; status: string; last_run_at?: string; items_processed?: number; error?: string; detail?: unknown };

export default function Operations() {
  const [data, setData] = useState<{ summary: Record<string, number>; operations: Operation[] }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); setError(''); api.getOperations().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <PageShell>
    <PageHeader title="Operations" eyebrow="System health" icon={Activity} description="Scheduled reports, intelligence ingestion, SIEM synchronization, and ATT&CK updates in one view" actions={<button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>} />
    <PageContent>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(data?.summary ?? {}).map(([label, value]) => <div key={label} className="panel p-4"><div className="data-label">{label.replace('_', ' ')}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>)}
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm"><thead><tr className="border-b border-gray-200 dark:border-slate-800"><th className="p-3">Operation</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Schedule</th><th className="p-3">Last run</th><th className="p-3">Items</th></tr></thead>
        <tbody>{data?.operations.map(op => <tr key={op.id} className="border-b border-gray-100 dark:border-slate-800/60"><td className="p-3 font-medium">{op.name}{op.error && <div className="mt-1 max-w-xl text-xs text-red-600 dark:text-red-300">{op.error}</div>}</td><td className="p-3">{op.kind.replace('_', ' ')}</td><td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${['error','failed'].includes(op.status) ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300' : op.status === 'success' || op.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{op.status}</span></td><td className="p-3 font-mono text-xs">{op.schedule ?? '—'}</td><td className="p-3">{op.last_run_at ? new Date(op.last_run_at).toLocaleString() : 'Never'}</td><td className="p-3">{op.items_processed ?? '—'}</td></tr>)}</tbody></table>
        {!loading && !data?.operations.length && <p className="p-6 text-center text-gray-500">No operation history yet.</p>}
      </div>
    </PageContent>
  </PageShell>;
}
