import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Tactic, Technique, D3FendTechnique, Mitigation, Detection } from '../types';
import StatusBadge from '../components/StatusBadge';
import { D3FEND_CATEGORY_COLORS } from '../lib/constants';
import { SkeletonDetailPanel } from '../components/Skeleton';

interface TechDetail {
  technique: Technique;
  detections: Detection[];
  d3fend: D3FendTechnique[];
  mitigations: Mitigation[];
}

export default function DefenseMapping() {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [selectedTactic, setSelectedTactic] = useState('');
  const [selected, setSelected] = useState<TechDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getTactics().then(setTactics);
    api.getTechniques(undefined, true).then(setTechniques);
  }, []);

  const selectTechnique = async (tech: Technique) => {
    setLoading(true);
    try {
      const detail = await api.getTechnique(tech.id);
      setSelected({
        technique: detail,
        detections: detail.detections ?? [],
        d3fend: detail.d3fend_countermeasures ?? [],
        mitigations: detail.mitigations ?? [],
      });
    } finally { setLoading(false); }
  };

  const filteredTechs = techniques.filter(t => {
    const matchesTactic = !selectedTactic || t.tactic_ids.includes(selectedTactic);
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    return matchesTactic && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gradient-to-r from-gray-50 via-gray-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Defense Mapping</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">D3FEND countermeasures and ATT&CK mitigations by technique</p>
      </div>
      <div className="flex flex-1 overflow-hidden">
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-gray-50 dark:bg-slate-900/30">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">ATT&CK Techniques</h2>
          <div className="mt-2 space-y-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full px-3 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500" />
            <select value={selectedTactic} onChange={e => setSelectedTactic(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Tactics</option>
              {tactics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="text-xs text-gray-400 dark:text-slate-500 mt-2">{filteredTechs.filter(t => !t.is_subtechnique).length} techniques · {filteredTechs.filter(t => t.is_subtechnique).length} subtechniques</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredTechs.map(t => (
            <button
              key={t.id}
              onClick={() => selectTechnique(t)}
              className={`w-full text-left border-b border-gray-200 dark:border-slate-800/50 transition-colors hover:bg-gray-100/50 dark:bg-slate-800/50 ${
                t.is_subtechnique ? 'pl-8 pr-4 py-2' : 'px-4 py-2.5'
              } ${selected?.technique.id === t.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs flex-shrink-0 ${t.is_subtechnique ? 'text-gray-400 dark:text-slate-500' : 'text-gray-500 dark:text-slate-400'}`}>{t.id}</span>
                <span className={`text-xs truncate ${t.is_subtechnique ? 'text-gray-500 dark:text-slate-400' : 'text-gray-700 dark:text-slate-300'}`}>{t.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonDetailPanel />
        ) : !selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
            <div className="text-4xl mb-3">⛨</div>
            <div className="text-sm">Select a technique to view defense mappings</div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-mono text-gray-400 dark:text-slate-500">{selected.technique.id}</div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{selected.technique.name}</h1>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selected.technique.tactic_ids.map(tid => {
                      const tac = tactics.find(t => t.id === tid);
                      return tac ? (
                        <span key={tid} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">{tac.name}</span>
                      ) : null;
                    })}
                  </div>
                  {selected.technique.description && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 max-w-2xl">{selected.technique.description}</p>
                  )}
                </div>
                <a href={`https://attack.mitre.org/techniques/${selected.technique.id}/`} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0 ml-4">
                  MITRE ATT&CK ↗
                </a>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className={`rounded-xl border p-3 ${selected.detections.filter(d => d.status === 'active').length > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-300 dark:border-slate-700 bg-gray-100/30 dark:bg-slate-800/30'}`}>
                <div className="text-xs text-gray-500 dark:text-slate-400">Active Detections</div>
                <div className={`text-2xl font-bold mt-1 ${selected.detections.filter(d => d.status === 'active').length > 0 ? 'text-emerald-400' : 'text-gray-400 dark:text-slate-500'}`}>
                  {selected.detections.filter(d => d.status === 'active').length}
                </div>
              </div>
              <div className={`rounded-xl border p-3 ${selected.d3fend.length > 0 ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-300 dark:border-slate-700 bg-gray-100/30 dark:bg-slate-800/30'}`}>
                <div className="text-xs text-gray-500 dark:text-slate-400">D3FEND Countermeasures</div>
                <div className={`text-2xl font-bold mt-1 ${selected.d3fend.length > 0 ? 'text-blue-400' : 'text-gray-400 dark:text-slate-500'}`}>{selected.d3fend.length}</div>
              </div>
              <div className={`rounded-xl border p-3 ${selected.mitigations.length > 0 ? 'border-purple-500/30 bg-purple-500/5' : 'border-gray-300 dark:border-slate-700 bg-gray-100/30 dark:bg-slate-800/30'}`}>
                <div className="text-xs text-gray-500 dark:text-slate-400">ATT&CK Mitigations</div>
                <div className={`text-2xl font-bold mt-1 ${selected.mitigations.length > 0 ? 'text-purple-400' : 'text-gray-400 dark:text-slate-500'}`}>{selected.mitigations.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">SIEM Detections</h2>
                {selected.detections.length === 0 ? (
                  <div className="text-xs text-gray-400 dark:text-slate-500 italic">No detections for this technique.</div>
                ) : (
                  <div className="space-y-2">
                    {selected.detections.map(d => (
                      <div key={d.id} className="bg-gray-100/60 dark:bg-slate-800/60 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium text-gray-800 dark:text-slate-200">{d.name}</div>
                            {d.rule_id && <div className="font-mono text-xs text-gray-400 dark:text-slate-500 mt-0.5">{d.rule_id}</div>}
                            {d.source && <div className="text-xs text-gray-400 dark:text-slate-500">{d.source}</div>}
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <StatusBadge value={d.status} variant="detection_status" />
                            <StatusBadge value={d.severity} variant="severity" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">D3FEND Countermeasures</h2>
                {selected.d3fend.length === 0 ? (
                  <div className="text-xs text-gray-400 dark:text-slate-500 italic">No D3FEND countermeasures mapped.</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      selected.d3fend.reduce((acc, d) => {
                        if (!acc[d.category]) acc[d.category] = [];
                        acc[d.category].push(d);
                        return acc;
                      }, {} as Record<string, D3FendTechnique[]>)
                    ).map(([cat, items]) => (
                      <div key={cat}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${D3FEND_CATEGORY_COLORS[cat] ?? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-400 dark:border-slate-600'} mb-1`}>{cat}</span>
                        {items.map(d => (
                          <div key={d.id} className="bg-gray-100/60 dark:bg-slate-800/60 rounded-lg p-2.5 mb-1.5">
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-xs text-gray-400 dark:text-slate-500 w-14 flex-shrink-0 mt-0.5">{d.id}</span>
                              <div>
                                <div className="text-xs font-medium text-gray-800 dark:text-slate-200">{d.name}</div>
                                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{d.subcategory}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">ATT&CK Mitigations</h2>
              {selected.mitigations.length === 0 ? (
                <div className="text-xs text-gray-400 dark:text-slate-500 italic">No ATT&CK mitigations mapped.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {selected.mitigations.map(m => (
                    <div key={m.id} className="bg-gray-100/60 dark:bg-slate-800/60 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-xs text-purple-400 w-12 flex-shrink-0">{m.id}</span>
                        <div>
                          <div className="text-xs font-medium text-gray-800 dark:text-slate-200">{m.name}</div>
                          <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-2">{m.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
