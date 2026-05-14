import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Cell } from 'recharts';
import { api } from '../api';
import type { CoverageStats } from '../types';
import CoverageBar from '../components/CoverageBar';

export default function Dashboard() {
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    api.getCoverageStats()
      .then(data => { setStats(data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>;
  if (error || !stats) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-red-400 text-sm">Failed to load coverage data.</div>
      <button onClick={load} className="px-4 py-2 text-sm bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors">
        Retry
      </button>
    </div>
  );

  const kpis = [
    { label: 'Overall Coverage', value: `${stats.coverage_pct}%`, sub: `${stats.covered_techniques} / ${stats.total_techniques} techniques`, color: 'text-blue-400', bg: 'border-blue-500/20 bg-blue-500/5' },
    { label: 'Active Detections', value: stats.active_detections, sub: `of ${stats.total_detections} total`, color: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/5' },
    { label: 'Coverage Gaps', value: stats.gap_techniques, sub: 'techniques uncovered', color: 'text-red-400', bg: 'border-red-500/20 bg-red-500/5' },
    { label: 'Active Tools', value: stats.active_tools, sub: `of ${stats.total_tools} total`, color: 'text-purple-400', bg: 'border-purple-500/20 bg-purple-500/5' },
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
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Coverage Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">MITRE ATT&CK Enterprise detection and defense coverage</p>
          </div>
          <div className="flex gap-2">
            <Link to="/gaps" className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors">
              View Gaps →
            </Link>
            <Link to="/matrix" className="px-3 py-1.5 text-sm bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors">
              ATT&CK Matrix →
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
            <div className="text-xs text-slate-400 mb-1">{kpi.label}</div>
            <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-slate-500 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Coverage by Tactic</h2>
          <div className="space-y-2.5">
            {stats.tactic_stats.map(t => (
              <div key={t.tactic_id} className="grid grid-cols-[1fr_120px_36px] items-center gap-3">
                <div className="text-xs text-slate-400 truncate">{t.tactic_name}</div>
                <CoverageBar covered={t.covered} total={t.total} showLabel={false} />
                <div className="text-xs text-slate-400 text-right font-mono">{t.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-3">Detection Status</h2>
          <div className="space-y-3 mt-4">
            {detectionBreakdown.map(d => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
                  <span className="text-xs text-slate-400">{d.name}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: d.fill }}>{d.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-500">
            Total: {stats.total_detections} detections
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Coverage Radar by Tactic</h2>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="tactic" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Radar name="Coverage %" dataKey="coverage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [`${v}%`, 'Coverage']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Technique Coverage vs. Gaps</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 80 }}>
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Bar dataKey="covered" name="Covered" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gap" name="Gap" stackId="a" fill="#1e293b" stroke="#334155" strokeWidth={1} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-300">Lowest Coverage Tactics</h2>
          <Link to="/gaps" className="text-xs text-blue-400 hover:text-blue-300">View all gaps →</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...stats.tactic_stats].sort((a, b) => a.pct - b.pct).slice(0, 6).map(t => (
            <div key={t.tactic_id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <div className="text-xs font-medium text-slate-300 truncate">{t.tactic_name}</div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">{t.covered}/{t.total} covered</span>
                <span className={t.pct < 25 ? 'text-red-400' : t.pct < 50 ? 'text-orange-400' : 'text-yellow-400'}>
                  {t.pct}%
                </span>
              </div>
              <CoverageBar covered={t.covered} total={t.total} showLabel={false} />
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
