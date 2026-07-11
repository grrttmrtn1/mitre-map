import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid } from 'recharts';
import { api } from '../api';
import type { CoverageAttributionEntry, CoverageStats, CoverageSnapshot, RiskScore } from '../types';
import CoverageBar from '../components/CoverageBar';
import { SkeletonDashboard } from '../components/Skeleton';
import { useTheme } from '../context/ThemeContext';
import { PageContent, PageHeader, PageShell } from '../components/ui/PageShell';
import KpiCard from '../components/ui/KpiCard';
import ChartCard from '../components/ui/ChartCard';

type WidgetId = 'kpis' | 'tactic_bars' | 'detection_status' | 'radar' | 'tactic_chart' | 'trend' | 'risk' | 'lowest_tactics' | 'attribution';
const DEFAULT_WIDGET_ORDER: WidgetId[] = ['kpis', 'tactic_bars', 'detection_status', 'radar', 'tactic_chart', 'trend', 'risk', 'lowest_tactics', 'attribution'];

function loadWidgetOrder(): WidgetId[] {
  try {
    const stored = localStorage.getItem('dashboard_widget_order');
    if (stored) return JSON.parse(stored) as WidgetId[];
  } catch { /* fallthrough */ }
  return DEFAULT_WIDGET_ORDER;
}

function loadHiddenWidgets(): Set<WidgetId> {
  try {
    const stored = localStorage.getItem('dashboard_hidden_widgets');
    if (stored) return new Set(JSON.parse(stored) as WidgetId[]);
  } catch { /* fallthrough */ }
  return new Set();
}

function TrendBadge({ delta, invert = false, unit = '' }: { delta: number | null; invert?: boolean; unit?: string }) {
  if (delta === null || delta === 0) return null;
  const positive = invert ? delta < 0 : delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}{unit}
    </span>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case 'created': return 'Created';
    case 'updated': return 'Updated';
    case 'deleted': return 'Deleted';
    case 'bulk_updated': return 'Bulk updated';
    case 'bulk_deleted': return 'Bulk deleted';
    case 'imported': return 'Imported';
    default: return action;
  }
}

function actionColor(action: string): string {
  if (action === 'created' || action === 'imported') return 'text-emerald-400';
  if (action === 'deleted' || action === 'bulk_deleted') return 'text-red-400';
  return 'text-gray-500 dark:text-slate-400';
}

export default function Dashboard() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [snapshots, setSnapshots] = useState<CoverageSnapshot[]>([]);
  const [attribution, setAttribution] = useState<CoverageAttributionEntry[]>([]);
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [trendRange, setTrendRange] = useState<'7D' | '30D' | '90D' | 'All'>('90D');
  const [selectedSnapId, setSelectedSnapId] = useState<number | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Task 9: widget order and hidden state
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(loadWidgetOrder);
  const [hiddenWidgets] = useState<Set<WidgetId>>(loadHiddenWidgets);
  const [draggedWidget, setDraggedWidget] = useState<WidgetId | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      api.getCoverageStats(),
      api.getSnapshots().catch(() => []),
      api.getCoverageAttribution({ limit: 20 }).catch(() => ({ rows: [], total: 0 })),
      api.getRiskScore().catch(() => null),
    ])
      .then(([data, snaps, attr, risk]) => {
        setStats(data);
        setSnapshots(snaps);
        setAttribution(attr.rows);
        setRiskScore(risk);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const resetWidgetLayout = () => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    localStorage.setItem('dashboard_widget_order', JSON.stringify(DEFAULT_WIDGET_ORDER));
  };

  const handleDragStart = (id: WidgetId) => setDraggedWidget(id);
  const handleDragOver = (e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === id) return;
    setWidgetOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(draggedWidget);
      const toIdx = next.indexOf(id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedWidget);
      localStorage.setItem('dashboard_widget_order', JSON.stringify(next));
      return next;
    });
  };
  const handleDragEnd = () => setDraggedWidget(null);

  useEffect(() => { load(); }, []);

  const baseline = snapshots.length >= 2
    ? snapshots[snapshots.length - 2]
    : null;

  const trendData = useMemo(() => {
    let filtered = snapshots;
    if (trendRange !== 'All') {
      const days = trendRange === '7D' ? 7 : trendRange === '30D' ? 30 : 90;
      const cutoff = Date.now() - days * 86400 * 1000;
      filtered = snapshots.filter(s => new Date(s.taken_at).getTime() >= cutoff);
    }
    return filtered.map(s => ({
      id: s.id,
      dateLabel: new Date(s.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      dateISO: s.taken_at,
      coverage_pct: s.coverage_pct,
      covered: s.covered_techniques,
      total: s.total_techniques,
      annotation: s.notes && s.notes !== 'Auto-snapshot (nightly)' ? s.notes : null,
    }));
  }, [snapshots, trendRange]);

  const selectedSnap = selectedSnapId != null ? snapshots.find(s => s.id === selectedSnapId) ?? null : null;

  async function saveAnnotation() {
    if (!selectedSnapId) return;
    setSavingAnnotation(true);
    try {
      const updated = await api.updateSnapshotAnnotation(selectedSnapId, annotationText.trim() || null);
      setSnapshots(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelectedSnapId(null);
    } finally {
      setSavingAnnotation(false);
    }
  }

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="h-6 w-48 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-3.5 w-72 bg-gray-200/60 dark:bg-slate-800/60 rounded animate-pulse mt-2" />
      </div>
      <SkeletonDashboard />
    </div>
  );
  if (error || !stats) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-red-400 text-sm">Failed to load coverage data.</div>
      <button onClick={load} className="px-4 py-2 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:bg-slate-700 transition-colors">
        Retry
      </button>
    </div>
  );

  const kpis = [
    {
      label: 'Overall Coverage', value: `${stats.coverage_pct}%`,
      sub: `${stats.covered_techniques} / ${stats.total_techniques} techniques`,
      gradient: 'from-blue-400 to-cyan-400',
      bg: 'border-blue-500/20 bg-blue-500/5',
      glow: 'rgba(59,130,246,0.18)',
      delta: baseline ? stats.coverage_pct - baseline.coverage_pct : null,
      deltaUnit: '%',
    },
    {
      label: 'Active Detections', value: stats.active_detections,
      sub: `of ${stats.total_detections} total`,
      gradient: 'from-emerald-400 to-teal-300',
      bg: 'border-emerald-500/20 bg-emerald-500/5',
      glow: 'rgba(16,185,129,0.18)',
      delta: baseline ? stats.active_detections - baseline.active_detections : null,
      deltaUnit: '',
    },
    {
      label: 'Coverage Gaps', value: stats.gap_techniques,
      sub: 'techniques uncovered',
      gradient: 'from-red-400 to-orange-400',
      bg: 'border-red-500/20 bg-red-500/5',
      glow: 'rgba(239,68,68,0.18)',
      delta: baseline ? stats.gap_techniques - baseline.gap_techniques : null,
      deltaUnit: '', invert: true,
    },
    {
      label: 'Active Tools', value: stats.active_tools,
      sub: `of ${stats.total_tools} total`,
      gradient: 'from-purple-400 to-violet-300',
      bg: 'border-purple-500/20 bg-purple-500/5',
      glow: 'rgba(168,85,247,0.18)',
      delta: null, deltaUnit: '',
    },
  ];

  const detectionBreakdown = [
    { name: 'Active', value: stats.active_detections, fill: '#10b981' },
    { name: 'Tuning', value: stats.tuning_detections, fill: '#f59e0b' },
    { name: 'Disabled', value: stats.disabled_detections, fill: '#6b7280' },
    { name: 'Planned', value: stats.planned_detections, fill: '#3b82f6' },
  ];

  const radarData = stats.tactic_stats.map(t => ({
    tactic: t.tactic_name.replace(' and ', ' & '),
    coverage: t.pct,
    fullMark: 100,
  }));

  const barData = [...stats.tactic_stats]
    .sort((a, b) => a.pct - b.pct)
    .map(t => ({
      name: t.tactic_name.replace('Command and Control', 'C2').replace('Privilege Escalation', 'Priv Esc').replace('Defense Evasion', 'Def Evasion').replace('Credential Access', 'Cred Access').replace('Lateral Movement', 'Lateral Mvmt'),
      covered: t.covered,
      gap: t.gap,
      pct: t.pct,
    }));

  return (
    <PageShell>
      <PageHeader title="Coverage Dashboard" description="MITRE ATT&CK Enterprise detection and defense coverage" actions={<>
            <button
              onClick={resetWidgetLayout}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-400 dark:border-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
              title="Reset widget order to default"
            >
              Reset layout
            </button>
            <Link to="/gaps" className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors">
              View Gaps →
            </Link>
            <Link to="/matrix" className="px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors">
              ATT&CK Matrix →
            </Link>
      </>} />

      <PageContent className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} detail={kpi.sub} className={kpi.bg}
            valueClassName={`bg-gradient-to-br bg-clip-text text-transparent ${kpi.gradient}`}
            trend={<TrendBadge delta={kpi.delta ?? null} invert={kpi.invert} unit={kpi.deltaUnit} />} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Coverage by Tactic</h2>
          <div className="space-y-2.5">
            {stats.tactic_stats.map(t => (
              <div key={t.tactic_id} className="grid grid-cols-[1fr_120px_36px] items-center gap-3">
                <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{t.tactic_name}</div>
                <CoverageBar covered={t.covered} total={t.total} showLabel={false} />
                <div className="text-xs text-gray-500 dark:text-slate-400 text-right font-mono">{t.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Detection Status</h2>
          <div className="space-y-3 mt-4">
            {detectionBreakdown.map(d => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                  <span className="text-xs text-gray-500 dark:text-slate-400">{d.name}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: d.fill }}>{d.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-500">
            Total: {stats.total_detections} detections
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Coverage Radar by Tactic" description="Relative coverage across ATT&CK tactics" summary={radarData.map(item => `${item.tactic}: ${item.coverage}%`).join('; ')}>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
              <PolarGrid stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} strokeDasharray="3 3" />
              <PolarAngleAxis
                dataKey="tactic"
                tick={{ fill: theme === 'dark' ? '#94a3b8' : '#6b7280', fontSize: 10, fontFamily: 'ui-sans-serif, system-ui' }}
              />
              <Radar
                name="Coverage %"
                dataKey="coverage"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="#3b82f6"
                fillOpacity={0.15}
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#60a5fa', strokeWidth: 0 }}
              />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#6b7280', marginBottom: 2 }}
                formatter={(v: number) => [`${v}%`, 'Coverage']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Technique Coverage vs. Gaps" description="Covered and uncovered parent techniques by tactic" summary={barData.map(item => `${item.name}: ${item.covered} covered, ${item.gap} gaps`).join('; ')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 80 }}>
              <XAxis type="number" tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#6b7280', fontSize: 10 }} width={80} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#6b7280', marginBottom: 2 }}
                formatter={(v: number, name: string) => [v, name === 'covered' ? 'Covered' : 'Gap']}
              />
              <Bar dataKey="covered" name="Covered" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gap" name="Gap" stackId="a" fill={theme === 'dark' ? '#1e293b' : '#f3f4f6'} stroke={theme === 'dark' ? '#334155' : '#d1d5db'} strokeWidth={1} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500">Coverage Trend</h2>
          <div className="flex gap-1">
            {(['7D', '30D', '90D', 'All'] as const).map(r => (
              <button key={r} onClick={() => setTrendRange(r)} aria-pressed={trendRange === r} aria-label={`Show ${r === 'All' ? 'all' : r} coverage history`}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${trendRange === r ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:text-slate-400'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {trendData.length < 2 ? (
          <div className="flex items-center justify-center h-28 text-xs text-gray-400 dark:text-slate-600">
            Not enough snapshots yet — nightly auto-snapshots build history over time.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                onClick={(e) => {
                  if (e?.activePayload?.[0]?.payload) {
                    const p = e.activePayload[0].payload;
                    setSelectedSnapId(p.id);
                    const snap = snapshots.find(s => s.id === p.id);
                    setAnnotationText(snap?.notes && snap.notes !== 'Auto-snapshot (nightly)' ? snap.notes : '');
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" width={36} />
                <Tooltip
                  contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#6b7280', marginBottom: 4 }}
                  formatter={(_v: unknown, _n: string, props: any) => {
                    const p = props.payload;
                    return [
                      <span key="v">{p.coverage_pct}% <span className="text-gray-400 dark:text-slate-500 text-[10px]">({p.covered}/{p.total})</span>{p.annotation ? <span className="block text-amber-400 text-[10px] mt-1">★ {p.annotation}</span> : null}</span>,
                      'Coverage',
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="coverage_pct"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const isSelected = payload.id === selectedSnapId;
                    const hasAnnotation = !!payload.annotation;
                    return (
                      <g key={payload.id} style={{ cursor: 'pointer' }}>
                        <circle cx={cx} cy={cy} r={isSelected ? 6 : hasAnnotation ? 5 : 3.5}
                          fill={isSelected ? '#60a5fa' : hasAnnotation ? '#f59e0b' : '#3b82f6'}
                          stroke="#0f172a" strokeWidth={1.5} />
                      </g>
                    );
                  }}
                  activeDot={{ r: 6, fill: '#60a5fa', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Annotation markers below chart */}
            {trendData.some(d => d.annotation) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {trendData.filter(d => d.annotation).map(d => (
                  <button key={d.id} onClick={() => { setSelectedSnapId(d.id); setAnnotationText(d.annotation ?? ''); }}
                    className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 hover:bg-amber-500/20 transition-colors">
                    <span>★</span>
                    <span className="text-gray-500 dark:text-slate-400">{d.dateLabel}</span>
                    <span className="truncate max-w-[140px]">{d.annotation}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Annotation editor */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-800">
              {selectedSnap ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap">
                    {new Date(selectedSnap.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — {selectedSnap.coverage_pct}%
                  </span>
                  <input
                    type="text"
                    value={annotationText}
                    onChange={e => setAnnotationText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveAnnotation(); if (e.key === 'Escape') setSelectedSnapId(null); }}
                    placeholder="Add annotation (e.g. 'APT29 group added')"
                    className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-200 text-xs rounded px-2 py-1 placeholder-gray-400 dark:placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                  <button onClick={saveAnnotation} disabled={savingAnnotation}
                    className="px-3 py-1 text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/40 transition-colors disabled:opacity-50">
                    {savingAnnotation ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setSelectedSnapId(null)}
                    className="px-2 py-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:text-slate-400 transition-colors">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="text-[10px] text-gray-400 dark:text-slate-600">Click a point on the chart to annotate it.</div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500">Lowest Coverage Tactics</h2>
          <Link to="/gaps" className="text-xs text-blue-400 hover:text-blue-300">View all gaps →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...stats.tactic_stats].sort((a, b) => a.pct - b.pct).slice(0, 6).map(t => (
            <div key={t.tactic_id} className="bg-gray-100/50 dark:bg-slate-800/50 rounded-lg p-3 border border-gray-300/50 dark:border-slate-700/50">
              <div className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{t.tactic_name}</div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400 dark:text-slate-500">{t.covered}/{t.total} covered</span>
                <span className={t.pct < 25 ? 'text-red-400' : t.pct < 50 ? 'text-orange-400' : 'text-yellow-400'}>
                  {t.pct}%
                </span>
              </div>
              <CoverageBar covered={t.covered} total={t.total} showLabel={false} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500">Coverage Attribution</h2>
          <span className="text-xs text-gray-400 dark:text-slate-600">Recent coverage changes — what moved the needle and who</span>
        </div>
        {attribution.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-slate-600 py-4 text-center">No coverage changes recorded yet. Changes appear here when detections or tools are created, updated, or deleted.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 dark:text-slate-600 border-b border-gray-200 dark:border-slate-800">
                  <th className="text-left pb-2 font-medium pr-4">When</th>
                  <th className="text-left pb-2 font-medium pr-4">Source</th>
                  <th className="text-left pb-2 font-medium pr-4">Action</th>
                  <th className="text-left pb-2 font-medium pr-4">By</th>
                  <th className="text-right pb-2 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/60 dark:divide-slate-800/60">
                {attribution.map(entry => {
                  const delta = entry.coverage_pct_after - entry.coverage_pct_before;
                  const covDelta = entry.covered_techniques_after - entry.covered_techniques_before;
                  return (
                    <tr key={entry.id} className="hover:bg-gray-100/30 dark:bg-slate-800/30 transition-colors">
                      <td className="py-2 pr-4 text-gray-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 pr-4 max-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            entry.triggered_by_entity_type === 'detection'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-purple-500/10 text-purple-400'
                          }`}>
                            {entry.triggered_by_entity_type === 'detection' ? 'Det' : 'Tool'}
                          </span>
                          <span className="text-gray-700 dark:text-slate-300 truncate">{entry.triggered_by_entity_name ?? entry.triggered_by_entity_id}</span>
                        </div>
                      </td>
                      <td className={`py-2 pr-4 ${actionColor(entry.action)}`}>
                        {actionLabel(entry.action)}
                      </td>
                      <td className="py-2 pr-4 text-gray-500 dark:text-slate-400 font-mono">{entry.actor}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <span className="text-gray-400 dark:text-slate-500">{entry.coverage_pct_before}%</span>
                        <span className="text-gray-400 dark:text-slate-600 mx-1">→</span>
                        <span className="text-gray-700 dark:text-slate-300 font-semibold">{entry.coverage_pct_after}%</span>
                        {delta !== 0 && (
                          <span className={`ml-2 font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {delta > 0 ? '+' : ''}{delta}%
                          </span>
                        )}
                        {covDelta !== 0 && delta === 0 && (
                          <span className={`ml-2 ${covDelta > 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                            ({covDelta > 0 ? '+' : ''}{covDelta} techniques)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </PageContent>
    </PageShell>
  );
}
