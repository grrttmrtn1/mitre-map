import { useEffect, useState } from 'react';
import { api } from '../api';
import type { MatrixColumn, MatrixCell } from '../types';
import StatusBadge from '../components/StatusBadge';

const CELL_COLORS: Record<string, string> = {
  full:      'bg-emerald-500/80 hover:bg-emerald-500 text-white',
  detected:  'bg-blue-500/70 hover:bg-blue-500/90 text-white',
  mitigated: 'bg-purple-500/60 hover:bg-purple-500/80 text-white',
  tuning:    'bg-yellow-500/60 hover:bg-yellow-500/80 text-slate-900',
  planned:   'bg-blue-900/60 hover:bg-blue-900/80 text-blue-300 border border-blue-700/50',
  gap:       'bg-slate-800/80 hover:bg-slate-700 text-slate-500',
};

const LEGEND = [
  { status: 'full', label: 'Detected + Mitigated', color: 'bg-emerald-500' },
  { status: 'detected', label: 'Detected (active)', color: 'bg-blue-500' },
  { status: 'mitigated', label: 'Mitigated (tool)', color: 'bg-purple-500' },
  { status: 'tuning', label: 'Detection (tuning)', color: 'bg-yellow-500' },
  { status: 'planned', label: 'Planned detection', color: 'bg-blue-900 border border-blue-700' },
  { status: 'gap', label: 'No coverage', color: 'bg-slate-700' },
];

export default function AttackMatrix() {
  const [matrix, setMatrix] = useState<MatrixColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MatrixCell | null>(null);
  const [tacticContext, setTacticContext] = useState<string>('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    api.getCoverageMatrix().then(setMatrix).finally(() => setLoading(false));
  }, []);

  const filteredMatrix = matrix.map(col => ({
    ...col,
    cells: filter === 'all' ? col.cells : col.cells.filter(c => c.status === filter),
  }));

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading matrix...</div>;

  const totalTechs = matrix.reduce((s, c) => s + c.cells.length, 0);
  const gapCount = matrix.reduce((s, c) => s + c.cells.filter(x => x.status === 'gap').length, 0);
  const coveredCount = totalTechs - gapCount;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">ATT&CK Coverage Matrix</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Enterprise ATT&CK · {totalTechs} techniques · {coveredCount} covered · {gapCount} gaps
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All techniques</option>
              <option value="full">Detected + Mitigated</option>
              <option value="detected">Detected</option>
              <option value="mitigated">Mitigated</option>
              <option value="tuning">Tuning</option>
              <option value="planned">Planned</option>
              <option value="gap">Gaps only</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {LEGEND.map(l => (
            <div key={l.status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${l.color}`} />
              <span className="text-xs text-slate-400">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <div className="flex gap-1.5 min-w-max items-start">
            {filteredMatrix.map(col => (
              <div key={col.tactic.id} className="flex flex-col gap-1">
                <div className="px-2 py-1 bg-slate-800 rounded-md mb-1 sticky top-0 z-10">
                  <div className="text-xs font-semibold text-slate-300 whitespace-nowrap truncate max-w-[96px]">
                    {col.tactic.name}
                  </div>
                  <div className="text-xs text-slate-500">{col.cells.length} tech</div>
                </div>
                {col.cells.map(cell => (
                  <button
                    key={cell.id}
                    onClick={() => { setSelected(cell); setTacticContext(col.tactic.name); }}
                    title={`${cell.id} · ${cell.name}`}
                    className={`w-24 text-left px-1.5 py-1 rounded text-xs transition-colors cursor-pointer ${CELL_COLORS[cell.status]}`}
                  >
                    <div className="font-mono text-xs opacity-75">{cell.id}</div>
                    <div className="truncate leading-tight">{cell.name}</div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div className="w-72 flex-shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-mono text-xs text-slate-500">{selected.id}</div>
                <div className="text-sm font-semibold text-slate-200">{selected.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{tacticContext}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 ml-2">×</button>
            </div>

            <div className="mb-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                selected.status === 'full' ? 'bg-emerald-500/20 text-emerald-400' :
                selected.status === 'detected' ? 'bg-blue-500/20 text-blue-400' :
                selected.status === 'mitigated' ? 'bg-purple-500/20 text-purple-400' :
                selected.status === 'tuning' ? 'bg-yellow-500/20 text-yellow-400' :
                selected.status === 'planned' ? 'bg-blue-900/40 text-blue-400' :
                'bg-slate-700 text-slate-400'
              }`}>
                {selected.status === 'full' ? 'Detected + Mitigated' :
                 selected.status === 'detected' ? 'Active Detection' :
                 selected.status === 'mitigated' ? 'Tool Mitigated' :
                 selected.status === 'tuning' ? 'Detection Tuning' :
                 selected.status === 'planned' ? 'Planned' : 'Coverage Gap'}
              </span>
            </div>

            {selected.detections.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-400 mb-2">Active Detections ({selected.detection_count})</div>
                <div className="space-y-2">
                  {selected.detections.map(d => (
                    <div key={d.id} className="bg-slate-800/60 rounded-lg p-2">
                      <div className="text-xs text-slate-300 font-medium">{d.name}</div>
                      <StatusBadge value={d.severity} variant="severity" className="mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.status === 'gap' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="text-xs font-medium text-red-400 mb-1">Coverage Gap</div>
                <p className="text-xs text-slate-400">
                  No active detections or tool mitigations for this technique.
                  Visit the Gap Analysis page for recommendations.
                </p>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800">
              <a
                href={`https://attack.mitre.org/techniques/${selected.id}/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View on MITRE ATT&CK ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
