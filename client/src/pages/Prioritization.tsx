import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { PrioritizationItem, PrioritizationQueue, DataReadinessStatus } from '../types';
import { SkeletonRow } from '../components/Skeleton';

const SECTORS = [
  'Financial', 'Healthcare', 'Energy', 'Government', 'Defense', 'Technology',
  'Retail', 'Manufacturing', 'Education', 'Transportation', 'Telecommunications', 'Media',
];

function DataReadinessDot({ status }: { status: DataReadinessStatus }) {
  const configs: Record<DataReadinessStatus, { color: string; label: string; bg: string }> = {
    ready:   { color: 'bg-emerald-400', label: 'Data ready',    bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    partial: { color: 'bg-yellow-400',  label: 'Partial data',  bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
    blind:   { color: 'bg-red-400',     label: 'No data',       bg: 'bg-red-500/10 border-red-500/30 text-red-400' },
    unknown: { color: 'bg-slate-500',   label: 'Unknown',       bg: 'bg-gray-200 dark:bg-slate-700 border-gray-400 dark:border-slate-600 text-gray-500 dark:text-slate-400' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.color}`} />
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = pct >= 70 ? 'bg-red-500' : pct >= 45 ? 'bg-orange-500' : pct >= 20 ? 'bg-yellow-500' : 'bg-slate-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 w-6 text-right">{score}</span>
    </div>
  );
}

function CoverageBadge({ status }: { status: PrioritizationItem['coverage_status'] }) {
  if (status === 'gap') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-red-500/15 text-red-400 border-red-500/30">
        No coverage
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-blue-500/15 text-blue-400 border-blue-500/30">
      Mitigated, not detected
    </span>
  );
}

function ActionBadge({ action }: { action: PrioritizationItem['action'] }) {
  if (action === 'build_detection') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-400 dark:border-slate-600">
        → Build detection
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-400 dark:border-slate-600">
      → Add detection
    </span>
  );
}

function QueueCard({ item, expanded, onToggle }: {
  item: PrioritizationItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const navigate = useNavigate();
  const sectorGroups = item.groups.filter(g => g.in_sector);
  const otherGroups = item.groups.filter(g => !g.in_sector);

  return (
    <div className={`bg-gray-50 dark:bg-slate-900 border rounded-xl overflow-hidden transition-colors ${expanded ? 'border-blue-500/40' : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:border-slate-700'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-8 text-center">
          <span className={`text-lg font-bold font-mono ${item.rank <= 3 ? 'text-orange-400' : 'text-gray-400 dark:text-slate-600'}`}>
            #{item.rank}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400 dark:text-slate-500">{item.technique_id}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{item.technique_name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item.tactic_names.slice(0, 3).map(t => (
              <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">{t}</span>
            ))}
            {item.tactic_names.length > 3 && (
              <span className="text-xs text-gray-400 dark:text-slate-600">+{item.tactic_names.length - 3}</span>
            )}
          </div>
        </div>

        {/* Why column: threat groups */}
        <div className="hidden md:flex flex-col items-start gap-1 w-48 flex-shrink-0">
          {sectorGroups.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-orange-400 font-medium">{sectorGroups.length} in-sector</span>
              <span className="text-xs text-gray-400 dark:text-slate-600">·</span>
              <span className="text-xs text-gray-400 dark:text-slate-500 truncate">{sectorGroups.slice(0, 2).map(g => g.name).join(', ')}{sectorGroups.length > 2 ? ` +${sectorGroups.length - 2}` : ''}</span>
            </div>
          )}
          {otherGroups.length > 0 && (
            <div className="text-xs text-gray-400 dark:text-slate-500">
              {item.group_count} group{item.group_count !== 1 ? 's' : ''} total
            </div>
          )}
          {sectorGroups.length === 0 && (
            <div className="text-xs text-gray-400 dark:text-slate-500">{item.group_count} group{item.group_count !== 1 ? 's' : ''}</div>
          )}
        </div>

        {/* Right-side badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <DataReadinessDot status={item.data_readiness.status} />
          <CoverageBadge status={item.coverage_status} />
          <ActionBadge action={item.action} />
          <div className="w-24 hidden lg:block">
            <ScoreBar score={item.priority_score} />
          </div>
          <span className="text-gray-400 dark:text-slate-600 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-slate-800 px-4 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Threat actors */}
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Threat Actors</div>
            {sectorGroups.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-orange-400/70 mb-1">Targeting your sector</div>
                <div className="space-y-1">
                  {sectorGroups.map(g => (
                    <div key={g.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-xs text-gray-800 dark:text-slate-200 font-medium">{g.name}</span>
                      {g.country && <span className="text-xs text-gray-400 dark:text-slate-500">{g.country}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {otherGroups.length > 0 && (
              <div>
                {sectorGroups.length > 0 && <div className="text-xs text-gray-400 dark:text-slate-500/70 mb-1">Other groups</div>}
                <div className="space-y-1">
                  {otherGroups.slice(0, 5).map(g => (
                    <div key={g.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                      <span className="text-xs text-gray-500 dark:text-slate-400">{g.name}</span>
                    </div>
                  ))}
                  {otherGroups.length > 5 && (
                    <div className="text-xs text-gray-400 dark:text-slate-600">+{otherGroups.length - 5} more</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Data sources */}
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">
              Data Sources
              <span className="ml-2 font-normal text-gray-400 dark:text-slate-500">
                {item.data_readiness.available}/{item.data_readiness.required} collecting
              </span>
            </div>
            {item.available_sources.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-emerald-400/70 mb-1">Available</div>
                <div className="space-y-0.5">
                  {item.available_sources.map(s => (
                    <div key={s} className="text-xs text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="text-emerald-400">✓</span> {s}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {item.missing_sources.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 dark:text-slate-500/70 mb-1">Missing</div>
                <div className="space-y-0.5">
                  {item.missing_sources.slice(0, 4).map(s => (
                    <div key={s} className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
                      <span className="text-red-400/60">✗</span> {s}
                    </div>
                  ))}
                  {item.missing_sources.length > 4 && (
                    <div className="text-xs text-gray-400 dark:text-slate-600">+{item.missing_sources.length - 4} more</div>
                  )}
                </div>
              </div>
            )}
            {item.data_readiness.required === 0 && (
              <div className="text-xs text-gray-400 dark:text-slate-500 italic">No data source mapping defined</div>
            )}
          </div>

          {/* Score breakdown + actions */}
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Priority Breakdown</div>
            <div className="space-y-1.5 mb-4">
              {[
                { label: 'In-sector groups', val: item.priority_components.industry, max: 40, color: 'text-orange-400' },
                { label: 'Total groups', val: item.priority_components.group, max: 20, color: 'text-amber-400' },
                { label: 'Data readiness', val: item.priority_components.data_sources, max: 20, color: 'text-emerald-400' },
                { label: 'Gap severity', val: item.priority_components.gap_severity, max: 10, color: 'text-red-400' },
                { label: 'Compliance', val: item.priority_components.compliance, max: 10, color: 'text-blue-400' },
              ].map(({ label, val, max, color }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 dark:text-slate-500 w-28 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color.replace('text-', 'bg-')}`} style={{ width: `${(val / max) * 100}%` }} />
                  </div>
                  <span className={`${color} font-mono w-10 text-right`}>{val}/{max}</span>
                </div>
              ))}
              <div className="pt-1.5 border-t border-gray-200 dark:border-slate-800 flex justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400 font-semibold">Total</span>
                <span className="text-gray-800 dark:text-slate-200 font-mono font-bold">{item.priority_score}/100</span>
              </div>
            </div>

            <div className="mb-3 text-xs text-gray-400 dark:text-slate-500 bg-gray-100/50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
              {item.coverage_status === 'gap'
                ? 'No detection or tool mitigation exists. Nothing catches this technique today.'
                : 'A tool mitigation exists, but there is no detection rule. The technique may be blocked, but you have no visibility if it is attempted.'}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/detections')}
                className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors text-left"
              >
                → Create detection for {item.technique_id}
              </button>
              <a
                href={`https://attack.mitre.org/techniques/${item.technique_id}/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 transition-colors"
              >
                View on MITRE ATT&CK ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Prioritization() {
  const [data, setData] = useState<PrioritizationQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterData, setFilterData] = useState('');
  const [orgSector, setOrgSector] = useState('');
  const [savingSector, setSavingSector] = useState(false);

  const load = () => {
    setLoading(true);
    api.getPrioritizationQueue()
      .then(d => { setData(d); setOrgSector(d.summary.org_sector ?? ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveSector = async (val: string) => {
    setSavingSector(true);
    await api.setSetting('org_sector', val || null).finally(() => setSavingSector(false));
    load();
  };

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
        <div className="h-6 w-64 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-3.5 w-96 bg-gray-100/60 dark:bg-slate-800/60 rounded animate-pulse mt-2" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonRow key={i} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl" />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">{error}</div>
  );

  if (!data) return null;

  const filtered = data.queue.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.technique_name.toLowerCase().includes(q) && !item.technique_id.toLowerCase().includes(q)) return false;
    }
    if (filterAction && item.action !== filterAction) return false;
    if (filterData && item.data_readiness.status !== filterData) return false;
    return true;
  });

  const { summary } = data;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Prioritization Queue</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {summary.total_items} techniques ranked by threat relevance — what to build next
            </p>
          </div>

          {/* Summary chips */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-center">
              <div className="text-base font-bold text-red-400">{summary.gaps}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">Gaps</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-center">
              <div className="text-base font-bold text-purple-400">{summary.mitigated_only}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">Need Detection</div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-center">
              <div className="text-base font-bold text-emerald-400">{summary.data_ready}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">Data Ready</div>
            </div>
          </div>
        </div>

        {/* Sector + filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 dark:text-slate-500">Your sector:</span>
            <select
              value={orgSector}
              onChange={e => { setOrgSector(e.target.value); saveSector(e.target.value); }}
              disabled={savingSector}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300 focus:outline-none focus:border-orange-500 disabled:opacity-50"
            >
              <option value="">Not set</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {orgSector && (
              <span className="text-xs px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30">
                {orgSector}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search techniques..."
              className="w-full max-w-xs px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-orange-500"
          >
            <option value="">All actions</option>
            <option value="build_detection">No coverage (build detection)</option>
            <option value="add_detection">Mitigated, not detected (add detection)</option>
          </select>

          <select
            value={filterData}
            onChange={e => setFilterData(e.target.value)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-orange-500"
          >
            <option value="">All data states</option>
            <option value="ready">Data ready</option>
            <option value="partial">Partial data</option>
            <option value="blind">No data</option>
          </select>
        </div>

        {!orgSector && (
          <div className="mt-2 text-xs text-amber-400/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
            Set your industry sector above to weight scores by groups targeting your vertical.
          </div>
        )}
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">No items match your filters</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Try clearing the search or filters.</p>
          </div>
        ) : (
          filtered.map(item => (
            <QueueCard
              key={item.technique_id}
              item={item}
              expanded={expanded === item.technique_id}
              onToggle={() => setExpanded(expanded === item.technique_id ? null : item.technique_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
