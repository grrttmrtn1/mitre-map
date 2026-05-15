import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import type { ExecutiveReport, CoverageSnapshot } from '../types';
import ConfirmModal from '../components/ConfirmModal';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import CoverageBar from '../components/CoverageBar';
import ReportBuilder from '../components/ReportBuilder';

type TabId = 'executive' | 'trends' | 'threats' | 'gaps' | 'builder';

const TABS: { id: TabId; label: string }[] = [
  { id: 'executive', label: 'Executive Summary' },
  { id: 'trends', label: 'Coverage Trends' },
  { id: 'threats', label: 'Threat Landscape' },
  { id: 'gaps', label: 'Prioritized Gaps' },
  { id: 'builder', label: 'Custom Reports' },
];

export default function Reports() {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [snapshots, setSnapshots] = useState<CoverageSnapshot[]>([]);
  const [gapReport, setGapReport] = useState<any>(null);
  const [threatReport, setThreatReport] = useState<any>(null);
  const [loadingExec, setLoadingExec] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingThreats, setLoadingThreats] = useState(false);
  const [loadingGaps, setLoadingGaps] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('executive');
  const [deleteSnapshotId, setDeleteSnapshotId] = useState<number | null>(null);
  const [deletingSnapshot, setDeletingSnapshot] = useState(false);
  const [fetchedTabs, setFetchedTabs] = useState<Set<TabId>>(new Set(['executive']));

  // Load executive on mount
  useEffect(() => {
    api.getExecutiveReport()
      .then(setReport)
      .finally(() => setLoadingExec(false));
  }, []);

  const loadTab = useCallback((tab: TabId) => {
    if (fetchedTabs.has(tab)) return;
    setFetchedTabs(prev => new Set([...prev, tab]));

    if (tab === 'trends') {
      setLoadingTrends(true);
      api.getSnapshots().then(setSnapshots).finally(() => setLoadingTrends(false));
    }
    if (tab === 'threats') {
      setLoadingThreats(true);
      api.getThreatLandscapeReport().then(setThreatReport).finally(() => setLoadingThreats(false));
    }
    if (tab === 'gaps') {
      setLoadingGaps(true);
      api.getGapReport().then(setGapReport).finally(() => setLoadingGaps(false));
    }
  }, [fetchedTabs]);

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    loadTab(tab);
  };

  const takeSnapshot = async () => {
    setSnapping(true);
    try {
      const snap = await api.createSnapshot(`Manual snapshot ${new Date().toLocaleString()}`);
      setSnapshots(prev => [...prev, snap]);
      if (!fetchedTabs.has('trends')) setFetchedTabs(prev => new Set([...prev, 'trends']));
    } finally { setSnapping(false); }
  };

  const deleteSnapshot = (id: number) => { setDeleteSnapshotId(id); };

  const confirmDeleteSnapshot = async () => {
    if (deleteSnapshotId === null) return;
    setDeletingSnapshot(true);
    try {
      await api.deleteSnapshot(deleteSnapshotId);
      setSnapshots(prev => prev.filter(s => s.id !== deleteSnapshotId));
      setDeleteSnapshotId(null);
    } finally { setDeletingSnapshot(false); }
  };

  const tabBar = (
    <div className="flex gap-1 mt-4">
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => switchTab(tab.id)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTab === tab.id ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:bg-slate-800'}`}>
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (activeTab === 'builder') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Reports &amp; Exports</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Build and save custom reports from any data source</p>
          </div>
          {tabBar}
        </div>
        <div className="flex-1 overflow-hidden">
          <ReportBuilder />
        </div>
      </div>
    );
  }

  const exportLinks = [
    { label: 'Executive Report (PPTX)', href: api.getPptxExportUrl() },
    { label: 'ATT&CK Navigator Layer', href: api.getExportUrl('navigator') },
    { label: 'Detections CSV', href: api.getExportUrl('detections/csv') },
    { label: 'Tools CSV', href: api.getExportUrl('tools/csv') },
    { label: 'Coverage JSON', href: api.getExportUrl('coverage/json') },
  ];

  const trendData = snapshots.map(s => ({
    date: new Date(s.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    coverage: s.coverage_pct,
    detections: s.active_detections,
  }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Reports &amp; Exports</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {report ? `Generated ${new Date(report.generated_at).toLocaleString()}` : 'Loading…'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={takeSnapshot} disabled={snapping}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-400 dark:border-slate-600 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50">
              {snapping ? 'Taking snapshot...' : 'Take Snapshot'}
            </button>
            <div className="relative group">
              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                Export ▾
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg shadow-xl z-50 hidden group-hover:block">
                {exportLinks.map(l => (
                  <a key={l.href} href={l.href} download
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:bg-slate-700 hover:text-white first:rounded-t-lg last:rounded-b-lg transition-colors">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        {tabBar}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Executive Summary */}
        {activeTab === 'executive' && (
          loadingExec ? (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500">Generating executive report…</div>
          ) : !report ? (
            <div className="text-gray-400 dark:text-slate-500 text-center py-12">Failed to load report.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Coverage', value: `${report.summary.coverage_pct}%`, sub: `${report.summary.covered_techniques}/${report.summary.total_techniques} techniques`, color: 'text-blue-400', bg: 'border-blue-500/20 bg-blue-500/5' },
                  { label: 'Active Detections', value: report.summary.active_detections, sub: `of ${report.summary.total_detections} total`, color: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/5' },
                  { label: 'Coverage Gaps', value: report.summary.gap_count, sub: 'undetected techniques', color: 'text-red-400', bg: 'border-red-500/20 bg-red-500/5' },
                  { label: 'Active Tools', value: report.summary.active_tools, sub: 'in security stack', color: 'text-purple-400', bg: 'border-purple-500/20 bg-purple-500/5' },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{kpi.label}</div>
                    <div className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {report.trend && (
                <div className={`rounded-xl p-4 border ${report.trend.coverage_change >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                  <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Since last snapshot</div>
                  <div className="flex gap-6 text-sm">
                    <span>Coverage: <span className={report.trend.coverage_change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {report.trend.coverage_change >= 0 ? '+' : ''}{report.trend.coverage_change}%
                    </span></span>
                    <span>Detections: <span className={report.trend.detection_change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {report.trend.detection_change >= 0 ? '+' : ''}{report.trend.detection_change}
                    </span></span>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Coverage by Tactic</h2>
                <div className="space-y-2.5">
                  {report.tactic_coverage.map(t => (
                    <div key={t.id} className="grid grid-cols-[1fr_140px_40px] items-center gap-3">
                      <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{t.name}</div>
                      <CoverageBar covered={t.covered} total={t.total} showLabel={false} />
                      <div className="text-xs text-gray-500 dark:text-slate-400 text-right font-mono">{t.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Top 10 Undetected Techniques</h2>
                <div className="space-y-1.5">
                  {report.top_gaps.slice(0, 10).map(g => (
                    <div key={g.id} className="flex items-center gap-3 text-xs">
                      <span className="font-mono text-red-400 w-14 flex-shrink-0">{g.id}</span>
                      <span className="text-gray-700 dark:text-slate-300">{g.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {/* Coverage Trends */}
        {activeTab === 'trends' && (
          loadingTrends ? (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500">Loading trends…</div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300">Coverage % Over Time</h2>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{snapshots.length} snapshots</span>
                </div>
                {trendData.length < 2 ? (
                  <div className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">
                    Take more snapshots to see trends. Click "Take Snapshot" above to capture current state.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} unit="%" />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        formatter={(v: number) => [`${v}%`, 'Coverage']} />
                      <Line type="monotone" dataKey="coverage" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Snapshot History</h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-800">
                      {['Date', 'Coverage %', 'Covered', 'Gaps', 'Detections', 'Tools', 'Notes', ''].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-gray-400 dark:text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots].reverse().map(s => (
                      <tr key={s.id} className="border-b border-gray-200 dark:border-slate-800/50 hover:bg-gray-100/20 dark:bg-slate-800/20">
                        <td className="py-2 px-3 text-gray-500 dark:text-slate-400">{new Date(s.taken_at).toLocaleString()}</td>
                        <td className="py-2 px-3">
                          <span className={`font-mono font-bold ${s.coverage_pct >= 50 ? 'text-emerald-400' : s.coverage_pct >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {s.coverage_pct}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 dark:text-slate-400">{s.covered_techniques}/{s.total_techniques}</td>
                        <td className="py-2 px-3 text-red-400">{s.gap_techniques}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-slate-400">{s.active_detections}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-slate-400">{s.total_tools}</td>
                        <td className="py-2 px-3 text-gray-400 dark:text-slate-500">{s.notes ?? '—'}</td>
                        <td className="py-2 px-3">
                          <button onClick={() => deleteSnapshot(s.id)} className="text-gray-400 dark:text-slate-600 hover:text-red-400">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* Threat Landscape */}
        {activeTab === 'threats' && (
          loadingThreats ? (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500">Loading threat landscape…</div>
          ) : threatReport ? (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 dark:text-slate-500">
                {threatReport.groups.length} threat groups ranked by exposure
              </div>
              {threatReport.groups.map((g: any) => (
                <div key={g.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-slate-200">{g.name}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{g.id}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${
                          g.risk_level === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                          g.risk_level === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                          g.risk_level === 'medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                          'text-gray-500 dark:text-slate-400 bg-gray-200 dark:bg-slate-700 border-gray-400 dark:border-slate-600'
                        }`}>{g.risk_level.toUpperCase()}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400 dark:text-slate-500">
                        <span>{g.country ?? 'Unknown'}</span>
                        <span>·</span>
                        <span>{g.motivation}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${g.exposure_pct >= 60 ? 'text-red-400' : g.exposure_pct >= 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {g.exposure_pct}%
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">exposed</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
                    <div><span className="text-gray-400 dark:text-slate-500">Total techniques: </span><span className="text-gray-700 dark:text-slate-300">{g.total_techniques}</span></div>
                    <div><span className="text-gray-400 dark:text-slate-500">Covered: </span><span className="text-emerald-400">{g.covered}</span></div>
                    <div><span className="text-gray-400 dark:text-slate-500">Exposed: </span><span className="text-red-400">{g.exposure}</span></div>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${100 - g.exposure_pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null
        )}

        {/* Prioritized Gaps */}
        {activeTab === 'gaps' && (
          loadingGaps ? (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500">Loading gap report…</div>
          ) : gapReport ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-400 dark:text-slate-500 mb-4">{gapReport.total_gaps} undetected techniques ranked by priority score</div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-950 z-10">
                  <tr className="border-b border-gray-200 dark:border-slate-800">
                    {['Technique', 'Tactics', 'Threat Groups', 'Compliance Impact', 'Mitigated?', 'Priority'].map(h => (
                      <th key={h} className="text-left py-2 px-4 text-xs font-medium text-gray-500 dark:text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gapReport.gaps.slice(0, 60).map((g: any) => (
                    <tr key={g.id} className="border-b border-gray-200 dark:border-slate-800/50 hover:bg-gray-100/20 dark:bg-slate-800/20">
                      <td className="py-2.5 px-4">
                        <div className="font-mono text-xs text-red-400">{g.id}</div>
                        <div className="text-xs text-gray-700 dark:text-slate-300">{g.name}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {g.tactic_ids.slice(0, 2).map((t: string) => (
                            <span key={t} className="text-xs text-gray-400 dark:text-slate-600">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`font-mono text-xs ${g.group_count >= 3 ? 'text-red-400' : g.group_count >= 1 ? 'text-orange-400' : 'text-gray-400 dark:text-slate-600'}`}>
                          {g.group_count}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-slate-400">{g.compliance_impact}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs ${g.mitigated ? 'text-yellow-400' : 'text-gray-400 dark:text-slate-600'}`}>
                          {g.mitigated ? 'Partial' : 'None'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${g.priority_score >= 15 ? 'bg-red-500' : g.priority_score >= 8 ? 'bg-orange-500' : 'bg-slate-600'}`}
                              style={{ width: `${Math.min(100, (g.priority_score / 20) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">{g.priority_score}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null
        )}
      </div>
      <ConfirmModal
        open={deleteSnapshotId !== null}
        onClose={() => setDeleteSnapshotId(null)}
        onConfirm={confirmDeleteSnapshot}
        title="Delete Snapshot"
        message="Delete this coverage snapshot? This cannot be undone."
        confirmLabel="Delete"
        destructive
        confirming={deletingSnapshot}
      />
    </div>
  );
}
