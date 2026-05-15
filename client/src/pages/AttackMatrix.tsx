import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { MatrixColumn, SubtechniqueCell, ThreatGroup, ThreatGroupDetail } from '../types';
import StatusBadge from '../components/StatusBadge';

const TACTIC_COLORS: Record<string, string> = {
  'TA0043': '#a78bfa', // Reconnaissance       — violet
  'TA0042': '#f472b6', // Resource Development  — pink
  'TA0001': '#fb923c', // Initial Access        — orange
  'TA0002': '#f87171', // Execution             — red
  'TA0003': '#facc15', // Persistence           — yellow
  'TA0004': '#4ade80', // Privilege Escalation  — green
  'TA0005': '#22d3ee', // Defense Evasion       — cyan
  'TA0006': '#60a5fa', // Credential Access     — blue
  'TA0007': '#a3e635', // Discovery             — lime
  'TA0008': '#f97316', // Lateral Movement      — orange-600
  'TA0009': '#e879f9', // Collection            — fuchsia
  'TA0011': '#38bdf8', // Command & Control     — sky
  'TA0010': '#fb7185', // Exfiltration          — rose
  'TA0040': '#ff4d4f', // Impact                — red-500
};

const CELL_COLORS: Record<string, string> = {
  full:      'bg-emerald-500/80 hover:bg-emerald-500 text-white cell-glow-full',
  detected:  'bg-blue-500/70 hover:bg-blue-500/90 text-white cell-glow-detected',
  mitigated: 'bg-purple-500/60 hover:bg-purple-500/80 text-white cell-glow-mitigated',
  tuning:    'bg-yellow-500/60 hover:bg-yellow-500/80 text-slate-900 cell-glow-tuning',
  planned:   'bg-blue-900/60 hover:bg-blue-900/80 text-blue-300 border border-blue-700/50 cell-glow-planned',
  gap:       'bg-slate-800/80 hover:bg-slate-700 text-slate-500',
};

const STATUS_HEX: Record<string, string> = {
  full:      '#10b981',
  detected:  '#3b82f6',
  mitigated: '#a855f7',
  tuning:    '#eab308',
  planned:   '#1e3a5f',
  gap:       '#334155',
};

const LEGEND = [
  { status: 'full',      label: 'Detected + Mitigated', color: 'bg-emerald-500' },
  { status: 'detected',  label: 'Detected (active)',    color: 'bg-blue-500' },
  { status: 'mitigated', label: 'Mitigated (tool)',     color: 'bg-purple-500' },
  { status: 'tuning',    label: 'Detection (tuning)',   color: 'bg-yellow-500' },
  { status: 'planned',   label: 'Planned detection',    color: 'bg-blue-900 border border-blue-700' },
  { status: 'gap',       label: 'No coverage',          color: 'bg-slate-700' },
];

type SelectedCell = {
  id: string;
  name: string;
  status: 'full' | 'detected' | 'mitigated' | 'tuning' | 'planned' | 'gap';
  detection_count: number;
  detections: Array<{ id: number; name: string; severity: string }>;
  parentId?: string;
  parentName?: string;
  tacticName: string;
};

function mitreUrl(id: string) {
  return `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;
}

const MINI_W = 224;
const MINI_H = 112;

function MatrixMinimap({
  matrix,
  scrollEl,
  scrollVersion,
}: {
  matrix: MatrixColumn[];
  scrollEl: HTMLElement | null;
  scrollVersion: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matrix.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, MINI_W, MINI_H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, MINI_W, MINI_H);

    const numCols = matrix.length;
    const maxRows = Math.max(...matrix.map(c => c.cells.length));
    const cellW = (MINI_W - 2) / numCols;
    const cellH = (MINI_H - 2) / maxRows;

    matrix.forEach((col, ci) => {
      col.cells.forEach((cell, ri) => {
        ctx.fillStyle = STATUS_HEX[cell.status] ?? '#334155';
        ctx.fillRect(1 + ci * cellW, 1 + ri * cellH, Math.max(0.5, cellW - 0.5), Math.max(0.5, cellH - 0.5));
      });
    });

    if (scrollEl && scrollEl.scrollWidth > 0) {
      const sw = scrollEl.scrollWidth;
      const sh = scrollEl.scrollHeight;
      const vx = 1 + (scrollEl.scrollLeft / sw) * (MINI_W - 2);
      const vy = 1 + (scrollEl.scrollTop  / sh) * (MINI_H - 2);
      const vw = (scrollEl.clientWidth  / sw) * (MINI_W - 2);
      const vh = (scrollEl.clientHeight / sh) * (MINI_H - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, vw, vh);
    }
  }, [matrix, scrollEl, scrollVersion]);

  return (
    <div className="bg-slate-950/90 backdrop-blur border border-slate-700/60 rounded-lg p-2 shadow-xl">
      <div className="text-xs text-slate-500 mb-1 px-0.5 font-medium tracking-wide uppercase">Minimap</div>
      <canvas ref={canvasRef} width={MINI_W} height={MINI_H} className="block rounded" />
    </div>
  );
}

export default function AttackMatrix() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [matrix, setMatrix] = useState<MatrixColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [filter, setFilter] = useState<string>(searchParams.get('filter') ?? 'all');
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1.0);

  // Threat group overlay
  const [groups, setGroups] = useState<ThreatGroup[]>([]);
  const [overlayGroupId, setOverlayGroupId] = useState<string>(searchParams.get('group') ?? '');
  const [overlayTechIds, setOverlayTechIds] = useState<Set<string>>(new Set());
  const [overlayCoverage, setOverlayCoverage] = useState<{ name: string; covered: number; total: number } | null>(null);

  // Scroll tracking for minimap
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [scrollVersion, setScrollVersion] = useState(0);
  const scrollRef = useCallback((el: HTMLDivElement | null) => setScrollEl(el), []);

  useEffect(() => {
    api.getCoverageMatrix().then(setMatrix).finally(() => setLoading(false));
    api.getThreatGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    if (!scrollEl) return;
    const onScroll = () => setScrollVersion(v => v + 1);
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [scrollEl]);

  // Persist filter in URL
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (filter === 'all') next.delete('filter'); else next.set('filter', filter);
      return next;
    }, { replace: true });
  }, [filter, setSearchParams]);

  // Persist overlay group in URL + fetch technique IDs
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!overlayGroupId) next.delete('group'); else next.set('group', overlayGroupId);
      return next;
    }, { replace: true });

    if (!overlayGroupId) {
      setOverlayTechIds(new Set());
      setOverlayCoverage(null);
      return;
    }

    api.getThreatGroup(overlayGroupId).then((detail: ThreatGroupDetail) => {
      setOverlayTechIds(new Set(detail.techniques.map(t => t.id)));
      setOverlayCoverage({ name: detail.name, covered: detail.coverage.covered, total: detail.coverage.total });
    }).catch(() => {});
  }, [overlayGroupId, setSearchParams]);

  const toggleExpand = (cellId: string) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      next.has(cellId) ? next.delete(cellId) : next.add(cellId);
      return next;
    });
  };

  const filteredMatrix = matrix.map(col => ({
    ...col,
    cells: filter === 'all' ? col.cells : col.cells.filter(c => c.status === filter),
  }));

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading matrix...</div>;

  const totalTechs  = matrix.reduce((s, c) => s + c.cells.length, 0);
  const gapCount    = matrix.reduce((s, c) => s + c.cells.filter(x => x.status === 'gap').length, 0);
  const coveredCount = totalTechs - gapCount;
  const totalSubs   = matrix.reduce((s, c) => s + c.cells.reduce((cs, cell) => cs + cell.subtechnique_count, 0), 0);

  const hasOverlay = overlayTechIds.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-100">ATT&amp;CK Coverage Matrix</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Enterprise ATT&amp;CK · {totalTechs} techniques ({totalSubs} subtechniques) · {coveredCount} covered · {gapCount} gaps
            </p>
            {overlayCoverage && (
              <p className="text-sm text-amber-400 mt-1">
                Comparing <span className="font-semibold">{overlayCoverage.name}</span>
                {' '}· {overlayCoverage.total} techniques
                {' '}· {overlayCoverage.covered}/{overlayCoverage.total} covered
                {' '}({overlayCoverage.total > 0 ? Math.round(overlayCoverage.covered / overlayCoverage.total * 100) : 0}%)
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
            {/* Threat group overlay */}
            <select
              value={overlayGroupId}
              onChange={e => setOverlayGroupId(e.target.value)}
              className={`px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300 focus:outline-none transition-colors ${overlayGroupId ? 'border border-amber-500/60 focus:border-amber-400' : 'border border-slate-700 focus:border-amber-500'}`}
            >
              <option value="">Compare to threat group…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>

            {/* Status filter */}
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

            {/* Zoom controls */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setZoom(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                title="Zoom out"
              >−</button>
              <button
                onClick={() => setZoom(1.0)}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors min-w-[3.25rem] text-center border-x border-slate-700"
                title="Reset zoom"
              >{Math.round(zoom * 100)}%</button>
              <button
                onClick={() => setZoom(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}
                className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                title="Zoom in"
              >+</button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          {LEGEND.map(l => (
            <div key={l.status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${l.color}`} />
              <span className="text-xs text-slate-400">{l.label}</span>
            </div>
          ))}
          {hasOverlay && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border-2 border-amber-400" />
              <span className="text-xs text-amber-400">Used by group</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Scrollable matrix */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <div className="flex gap-1.5 min-w-max items-start" style={{ zoom: zoom }}>
            {filteredMatrix.map(col => (
              <div key={col.tactic.id} className="flex flex-col gap-1">
                <div className="px-2 py-1.5 bg-slate-800/90 rounded-md mb-1 sticky top-0 z-10 border-t-2 border-b border-slate-700/50" style={{ borderTopColor: TACTIC_COLORS[col.tactic.id] ?? '#475569' }}>
                  <div className="text-xs font-semibold text-slate-200 whitespace-nowrap truncate max-w-[96px]">
                    {col.tactic.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">{col.cells.length} tech</div>
                </div>

                {col.cells.map(cell => {
                  const inOverlay = hasOverlay && overlayTechIds.has(cell.id);
                  const ringClass = selected?.id === cell.id
                    ? 'ring-1 ring-white/40'
                    : inOverlay
                      ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900'
                      : '';
                  const dimClass = hasOverlay && !inOverlay ? 'opacity-40' : '';

                  return (
                    <div key={cell.id} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => setSelected({ id: cell.id, name: cell.name, status: cell.status, detection_count: cell.detection_count, detections: cell.detections, tacticName: col.tactic.name })}
                        title={`${cell.id} · ${cell.name}`}
                        className={`w-24 text-left px-1.5 py-1 rounded text-xs transition-colors cursor-pointer ${CELL_COLORS[cell.status]} ${ringClass} ${dimClass}`}
                      >
                        <div className="font-mono text-xs opacity-75">{cell.id}</div>
                        <div className="truncate leading-tight">{cell.name}</div>
                        {cell.subtechnique_count > 0 && (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs opacity-60">
                              {cell.subtechnique_covered}/{cell.subtechnique_count} sub
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={e => { e.stopPropagation(); toggleExpand(cell.id); }}
                              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); toggleExpand(cell.id); } }}
                              className="text-xs opacity-60 hover:opacity-100 cursor-pointer px-0.5"
                              title={expandedCells.has(cell.id) ? 'Collapse subtechniques' : 'Expand subtechniques'}
                            >
                              {expandedCells.has(cell.id) ? '▴' : '▾'}
                            </span>
                          </div>
                        )}
                      </button>

                      {expandedCells.has(cell.id) && cell.subtechniques.map((sub: SubtechniqueCell) => {
                        const subInOverlay = hasOverlay && overlayTechIds.has(sub.id);
                        const subRing = selected?.id === sub.id
                          ? 'ring-1 ring-white/40'
                          : subInOverlay
                            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900'
                            : '';
                        const subDim = hasOverlay && !subInOverlay ? 'opacity-40' : '';
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setSelected({ id: sub.id, name: sub.name, status: sub.status, detection_count: sub.detection_count, detections: sub.detections, parentId: cell.id, parentName: cell.name, tacticName: col.tactic.name })}
                            title={`${sub.id} · ${sub.name}`}
                            className={`w-24 text-left pl-3 pr-1.5 py-0.5 rounded-sm text-xs transition-colors cursor-pointer border-l-2 border-slate-500/30 ${CELL_COLORS[sub.status]} ${subRing} ${subDim}`}
                          >
                            <div className="font-mono text-xs opacity-75">{sub.id}</div>
                            <div className="truncate leading-tight">{sub.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Minimap — floats over bottom-left, outside scroll area */}
        <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
          <MatrixMinimap matrix={matrix} scrollEl={scrollEl} scrollVersion={scrollVersion} />
        </div>

        {/* Technique detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 border-l border-slate-800 bg-slate-900 overflow-y-auto p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 pr-2">
                {selected.parentId && (
                  <div className="text-xs text-slate-500 mb-1">
                    <span className="font-mono">{selected.parentId}</span>
                    <span className="mx-1">·</span>
                    <span className="truncate">{selected.parentName}</span>
                  </div>
                )}
                <div className="font-mono text-xs text-slate-500">{selected.id}</div>
                <div className="text-sm font-semibold text-slate-200">{selected.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{selected.tacticName}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 ml-2 flex-shrink-0">×</button>
            </div>

            <div className="mb-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                selected.status === 'full'      ? 'bg-emerald-500/20 text-emerald-400' :
                selected.status === 'detected'  ? 'bg-blue-500/20 text-blue-400' :
                selected.status === 'mitigated' ? 'bg-purple-500/20 text-purple-400' :
                selected.status === 'tuning'    ? 'bg-yellow-500/20 text-yellow-400' :
                selected.status === 'planned'   ? 'bg-blue-900/40 text-blue-400' :
                'bg-slate-700 text-slate-400'
              }`}>
                {selected.status === 'full'      ? 'Detected + Mitigated' :
                 selected.status === 'detected'  ? 'Active Detection' :
                 selected.status === 'mitigated' ? 'Tool Mitigated' :
                 selected.status === 'tuning'    ? 'Detection Tuning' :
                 selected.status === 'planned'   ? 'Planned' : 'Coverage Gap'}
              </span>
              {hasOverlay && overlayTechIds.has(selected.id) && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                  Used by {overlayCoverage?.name}
                </span>
              )}
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
                  No active detections or tool mitigations for this {selected.parentId ? 'subtechnique' : 'technique'}.
                  Visit the Gap Analysis page for recommendations.
                </p>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800">
              <a
                href={mitreUrl(selected.id)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View on MITRE ATT&amp;CK ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
