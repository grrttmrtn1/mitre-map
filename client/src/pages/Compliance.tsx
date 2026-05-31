import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ComplianceFramework, ComplianceSnapshot } from '../types';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import CoverageBar from '../components/CoverageBar';
import { useTheme } from '../context/ThemeContext';

const FRAMEWORK_COLORS: Record<string, string> = {
  'nist-csf-2': '#3b82f6',
  'cis-controls-v8': '#10b981',
  'iso27001-2022': '#8b5cf6',
  'pci-dss-v4': '#f59e0b',
  'soc2-tsc': '#ef4444',
};

export default function Compliance() {
  const { theme } = useTheme();
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, ComplianceSnapshot[]>>({});
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | null>(null);
  const [frameworkDetail, setFrameworkDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getComplianceFrameworks().then(async (fws) => {
      setFrameworks(fws);
      const snapshotMap: Record<string, ComplianceSnapshot[]> = {};
      await Promise.all(fws.map(async (fw: ComplianceFramework) => {
        try {
          snapshotMap[fw.id] = await api.getComplianceSnapshots(fw.id);
        } catch { snapshotMap[fw.id] = []; }
      }));
      setSnapshots(snapshotMap);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFramework) return;
    api.getComplianceFramework(selectedFramework.id).then(setFrameworkDetail).catch(() => {});
  }, [selectedFramework]);

  if (loading) return <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-slate-500">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Compliance</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Detection coverage mapped to compliance frameworks</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
          <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Framework Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 dark:text-slate-600 border-b border-gray-200 dark:border-slate-800">
                  <th className="text-left pb-2 font-medium">Framework</th>
                  <th className="text-left pb-2 font-medium">Version</th>
                  <th className="text-center pb-2 font-medium">Controls</th>
                  <th className="text-center pb-2 font-medium">Covered</th>
                  <th className="text-left pb-2 font-medium w-40">Coverage</th>
                  <th className="text-right pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {frameworks.map(fw => (
                  <tr
                    key={fw.id}
                    className={`hover:bg-gray-100/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${selectedFramework?.id === fw.id ? 'bg-blue-500/5' : ''}`}
                    onClick={() => setSelectedFramework(fw.id === selectedFramework?.id ? null : fw)}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-slate-200">{fw.name}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-slate-400">{fw.version ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-center text-gray-500 dark:text-slate-400">{fw.total_controls ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-center text-gray-500 dark:text-slate-400">{fw.covered_controls ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      <CoverageBar covered={fw.covered_controls ?? 0} total={fw.total_controls ?? 1} showLabel={false} />
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); api.downloadComplianceExport(fw.id); }}
                        className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                      >
                        Export gaps CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {Object.entries(snapshots).some(([, s]) => s.length >= 2) && (
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Compliance Coverage Trend</h2>
            {frameworks.map(fw => {
              const fwSnaps = snapshots[fw.id] ?? [];
              if (fwSnaps.length < 2) return null;
              const color = FRAMEWORK_COLORS[fw.id] ?? '#6366f1';
              const data = fwSnaps.map(s => ({
                date: new Date(s.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                pct: s.coverage_pct,
              }));
              return (
                <div key={fw.id} className="mb-4">
                  <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">{fw.name}</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fill: theme === 'dark' ? '#475569' : '#9ca3af', fontSize: 9 }} axisLine={false} tickLine={false} unit="%" width={30} />
                      <Tooltip
                        contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`${v}%`, 'Coverage']}
                      />
                      <Line type="monotone" dataKey="pct" stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        )}

        {selectedFramework && frameworkDetail && (
          <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
            <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">
              {selectedFramework.name} — Control Detail
            </h2>
            <div className="space-y-1">
              {(frameworkDetail.controls ?? []).map((ctrl: any) => (
                <div key={ctrl.id} className="flex items-center gap-3 py-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ctrl.covered ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-slate-700'}`} />
                  <span className="text-xs font-mono text-gray-400 dark:text-slate-500 w-16 flex-shrink-0">{ctrl.id}</span>
                  <span className="text-xs text-gray-700 dark:text-slate-300 flex-1">{ctrl.name}</span>
                  {!ctrl.covered && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded">Gap</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
