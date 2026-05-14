import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CoveredTechnique, GapTechnique } from '../types';
import StatusBadge from '../components/StatusBadge';
import { D3FEND_CATEGORY_COLORS } from '../lib/constants';

const SECTORS = [
  'Financial', 'Healthcare', 'Energy', 'Government', 'Defense', 'Technology',
  'Retail', 'Manufacturing', 'Education', 'Transportation', 'Telecommunications', 'Media',
];

const STATUS_BADGE: Record<string, string> = {
  full: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  detected: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  mitigated: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

type View = 'gaps' | 'covered';

function PriorityBar({ score, components }: { score: number; components: GapTechnique['priority_components'] }) {
  const level = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
  const colors = { critical: 'text-red-400 bg-red-500/15 border-red-500/30', high: 'text-orange-400 bg-orange-500/15 border-orange-500/30', medium: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', low: 'text-slate-400 bg-slate-700 border-slate-600' };
  return (
    <span className="group relative">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono cursor-default ${colors[level]}`}>
        P{score}
      </span>
      <div className="hidden group-hover:block absolute right-0 top-6 z-10 bg-slate-800 border border-slate-700 rounded-lg p-2.5 shadow-xl text-xs w-44 space-y-1">
        <div className="text-slate-300 font-semibold mb-1.5">Priority breakdown</div>
        <div className="flex justify-between text-slate-400"><span>Threat groups</span><span className="text-slate-200">{components.group}/40</span></div>
        <div className="flex justify-between text-slate-400"><span>Industry targeting</span><span className="text-slate-200">{components.industry}/30</span></div>
        <div className="flex justify-between text-slate-400"><span>Data readiness</span><span className="text-slate-200">{components.data_sources}/20</span></div>
        <div className="flex justify-between text-slate-400"><span>Mitigation guidance</span><span className="text-slate-200">{components.mitigation_guidance}/10</span></div>
      </div>
    </span>
  );
}

export default function GapAnalysis() {
  const [view, setView] = useState<View>('gaps');
  const [gaps, setGaps] = useState<GapTechnique[]>([]);
  const [covered, setCovered] = useState<CoveredTechnique[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTactic, setFilterTactic] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'tactic' | 'd3fend' | 'mitigations' | 'detections' | 'tools'>('priority');
  const [orgSector, setOrgSector] = useState('');
  const [savingSector, setSavingSector] = useState(false);

  useEffect(() => {
    Promise.all([api.getCoverageGaps(), api.getCoveredTechniques(), api.getSetting('org_sector')])
      .then(([g, c, s]) => { setGaps(g); setCovered(c); setOrgSector(s.value ?? ''); })
      .finally(() => setLoading(false));
  }, []);

  const saveSector = async (val: string) => {
    setSavingSector(true);
    await api.setSetting('org_sector', val || null).finally(() => setSavingSector(false));
    // Reload gaps so priority scores reflect new sector
    api.getCoverageGaps().then(setGaps);
  };

  const allTactics = [...new Set([
    ...gaps.flatMap(g => g.tactic_names),
    ...covered.flatMap(c => c.tactic_names),
  ])].sort();

  const filteredGaps = gaps.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.id.toLowerCase().includes(search.toLowerCase());
    const matchTactic = !filterTactic || g.tactic_names.includes(filterTactic);
    return matchSearch && matchTactic;
  }).sort((a, b) => {
    if (sortBy === 'priority') return b.priority_score - a.priority_score;
    if (sortBy === 'tactic') return a.tactic_names[0]?.localeCompare(b.tactic_names[0] ?? '') ?? 0;
    if (sortBy === 'd3fend') return b.recommended_d3fend.length - a.recommended_d3fend.length;
    return b.recommended_mitigations.length - a.recommended_mitigations.length;
  });

  const filteredCovered = covered.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchTactic = !filterTactic || c.tactic_names.includes(filterTactic);
    return matchSearch && matchTactic;
  }).sort((a, b) => {
    if (sortBy === 'detections') return b.detections.length - a.detections.length;
    if (sortBy === 'tools') return b.tools.length - a.tools.length;
    return a.tactic_names[0]?.localeCompare(b.tactic_names[0] ?? '') ?? 0;
  });

  const exportCSV = () => {
    if (view === 'gaps') {
      const rows = [
        ['Technique ID', 'Technique Name', 'Tactics', 'D3FEND Countermeasures', 'ATT&CK Mitigations'],
        ...filteredGaps.map(g => [
          g.id, g.name, g.tactic_names.join('; '),
          g.recommended_d3fend.map(d => `${d.id} - ${d.name}`).join('; '),
          g.recommended_mitigations.map(m => `${m.id} - ${m.name}`).join('; '),
        ]),
      ];
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mitremap-gaps.csv'; a.click();
    } else {
      const rows = [
        ['Technique ID', 'Technique Name', 'Tactics', 'Status', 'Detections', 'Tools'],
        ...filteredCovered.map(c => [
          c.id, c.name, c.tactic_names.join('; '), c.status,
          c.detections.map(d => d.name).join('; '),
          c.tools.map(t => t.name).join('; '),
        ]),
      ];
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mitremap-covered.csv'; a.click();
    }
  };

  const handleViewChange = (v: View) => {
    setView(v);
    setExpanded(null);
    setSortBy(v === 'gaps' ? 'priority' : 'tactic');
  };

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading gap analysis...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Gap Analysis</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {view === 'gaps'
                ? `${gaps.length} techniques with no active detection or tool mitigation`
                : `${covered.length} techniques with active detection or tool mitigation`}
            </p>
          </div>
          <button onClick={exportCSV}
            className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors">
            Export CSV
          </button>
        </div>

        <div className="flex gap-1 mt-3">
          <button
            onClick={() => handleViewChange('gaps')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'gaps' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            Gaps
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${view === 'gaps' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-500'}`}>{gaps.length}</span>
          </button>
          <button
            onClick={() => handleViewChange('covered')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'covered' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            Covered
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${view === 'covered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>{covered.length}</span>
          </button>
        </div>

        <div className="flex gap-3 mt-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search techniques..."
            className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          <select value={filterTactic} onChange={e => setFilterTactic(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">All Tactics</option>
            {allTactics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {view === 'gaps' ? (
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="priority">Sort: Priority Score</option>
              <option value="tactic">Sort: Tactic</option>
              <option value="d3fend">Sort: D3FEND coverage</option>
              <option value="mitigations">Sort: Mitigations</option>
            </select>
          ) : (
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="tactic">Sort: Tactic</option>
              <option value="detections">Sort: Detections</option>
              <option value="tools">Sort: Tools</option>
            </select>
          )}
        </div>
        {view === 'gaps' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-500">Industry sector:</span>
            <select
              value={orgSector}
              onChange={e => { setOrgSector(e.target.value); saveSector(e.target.value); }}
              disabled={savingSector}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Not set (industry targeting N/A)</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-slate-600">Used to weigh industry-relevant threat groups in priority score.</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {view === 'gaps' ? (
          filteredGaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <div className="text-4xl mb-3">✓</div>
              <div className="text-sm">No gaps found with current filters</div>
            </div>
          ) : (
            filteredGaps.map(g => (
              <div key={g.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 flex-shrink-0">GAP</span>
                    <span className="font-mono text-xs text-slate-400 flex-shrink-0">{g.id}</span>
                    <span className="text-sm text-slate-200 font-medium">{g.name}</span>
                    {(g as any).gap_reason === 'no_data_source' && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30 hidden sm:inline">No Data Source</span>
                    )}
                    {(g as any).gap_reason === 'has_data_no_rule' && (
                      <span className="text-xs px-2 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hidden sm:inline">Has Data, No Rule</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="flex gap-1.5">
                      {g.tactic_names.slice(0, 2).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs hidden sm:inline">{t}</span>
                      ))}
                      {g.tactic_names.length > 2 && <span className="text-xs text-slate-500">+{g.tactic_names.length - 2}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {g.recommended_d3fend.length > 0 && (
                        <span className="text-blue-400">{g.recommended_d3fend.length} D3FEND</span>
                      )}
                      {g.recommended_mitigations.length > 0 && (
                        <span className="text-purple-400">{g.recommended_mitigations.length} mitigations</span>
                      )}
                      {g.group_count > 0 && (
                        <span className="text-amber-400">{g.group_count} group{g.group_count !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {g.priority_components && <PriorityBar score={g.priority_score} components={g.priority_components} />}
                    <span className="text-slate-600 text-sm">{expanded === g.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === g.id && (
                  <div className="border-t border-slate-800 px-4 py-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-2">Recommended D3FEND Countermeasures</div>
                      {g.recommended_d3fend.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">No D3FEND mappings available.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {g.recommended_d3fend.map(d => (
                            <div key={d.id} className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${D3FEND_CATEGORY_COLORS[d.category] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                {d.category}
                              </span>
                              <span className="font-mono text-xs text-slate-500">{d.id}</span>
                              <span className="text-xs text-slate-300">{d.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-2">Recommended ATT&CK Mitigations</div>
                      {g.recommended_mitigations.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">No mitigations available.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {g.recommended_mitigations.map(m => (
                            <div key={m.id} className="flex items-start gap-2">
                              <span className="font-mono text-xs text-purple-400 w-12 flex-shrink-0">{m.id}</span>
                              <span className="text-xs text-slate-300">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {g.priority_components && (
                      <div className="col-span-2 bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs font-semibold text-slate-400 mb-2">Priority Score: <span className="text-slate-200">{g.priority_score}/100</span></div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-900 rounded p-2 text-center">
                            <div className="text-amber-400 font-bold text-base">{g.priority_components.group}</div>
                            <div className="text-slate-500 mt-0.5">Threat groups<br/><span className="text-slate-600">/40</span></div>
                          </div>
                          <div className="bg-slate-900 rounded p-2 text-center">
                            <div className="text-sky-400 font-bold text-base">{g.priority_components.industry}</div>
                            <div className="text-slate-500 mt-0.5">Industry targeting<br/><span className="text-slate-600">/30</span></div>
                          </div>
                          <div className="bg-slate-900 rounded p-2 text-center">
                            <div className="text-emerald-400 font-bold text-base">{g.priority_components.data_sources}</div>
                            <div className="text-slate-500 mt-0.5">Data readiness<br/><span className="text-slate-600">/20</span></div>
                          </div>
                          <div className="bg-slate-900 rounded p-2 text-center">
                            <div className="text-purple-400 font-bold text-base">{g.priority_components.mitigation_guidance}</div>
                            <div className="text-slate-500 mt-0.5">Mit. guidance<br/><span className="text-slate-600">/10</span></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="flex gap-2">
                        {g.tactic_names.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">{t}</span>
                        ))}
                      </div>
                      <a href={`https://attack.mitre.org/techniques/${g.id}/`} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300">
                        View on MITRE ATT&CK ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          filteredCovered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <div className="text-sm">No covered techniques found with current filters</div>
            </div>
          ) : (
            filteredCovered.map(c => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded border flex-shrink-0 uppercase ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                    <span className="font-mono text-xs text-slate-400 flex-shrink-0">{c.id}</span>
                    <span className="text-sm text-slate-200 font-medium">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="flex gap-1.5">
                      {c.tactic_names.slice(0, 2).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs hidden sm:inline">{t}</span>
                      ))}
                      {c.tactic_names.length > 2 && <span className="text-xs text-slate-500">+{c.tactic_names.length - 2}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {c.detections.length > 0 && (
                        <span className="text-sky-400">{c.detections.length} detection{c.detections.length !== 1 ? 's' : ''}</span>
                      )}
                      {c.tools.length > 0 && (
                        <span className="text-blue-400">{c.tools.length} tool{c.tools.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <span className="text-slate-600 text-sm">{expanded === c.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === c.id && (
                  <div className="border-t border-slate-800 px-4 py-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-2">Active Detections</div>
                      {c.detections.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">No active detections.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {c.detections.map(d => (
                            <div key={d.id} className="flex items-center gap-2">
                              <StatusBadge value={d.severity} variant="severity" />
                              <span className="text-xs text-slate-300 truncate">{d.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-400 mb-2">Covering Tools</div>
                      {c.tools.length === 0 ? (
                        <div className="text-xs text-slate-500 italic">No tools assigned via mitigations.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {c.tools.map(t => (
                            <div key={t.id} className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-400">{t.category}</span>
                              <span className="text-xs text-slate-300">{t.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="flex gap-2">
                        {c.tactic_names.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">{t}</span>
                        ))}
                      </div>
                      <a href={`https://attack.mitre.org/techniques/${c.id}/`} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300">
                        View on MITRE ATT&CK ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
