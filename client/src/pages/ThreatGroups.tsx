import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ThreatGroup } from '../types';

const MOTIVATION_COLOR: Record<string, string> = {
  Espionage: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Financial: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Espionage, Financial': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'Destructive, Espionage': 'text-red-400 bg-red-500/10 border-red-500/20',
};

const COUNTRY_FLAG: Record<string, string> = {
  Russia: '🇷🇺', China: '🇨🇳', 'North Korea': '🇰🇵', Iran: '🇮🇷', Vietnam: '🇻🇳',
};

interface GroupDetail {
  techniques: any[];
  coverage: { total: number; covered: number; pct: number; details: any[] };
}

export default function ThreatGroups() {
  const [groups, setGroups] = useState<ThreatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterMotivation, setFilterMotivation] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getThreatGroups().then(setGroups).finally(() => setLoading(false));
  }, []);

  const loadDetail = async (id: string) => {
    if (selected === id) { setSelected(null); setDetail(null); return; }
    setSelected(id);
    setDetailLoading(true);
    try {
      const d = await api.getThreatGroup(id);
      setDetail(d as any);
    } finally { setDetailLoading(false); }
  };

  const motivations = [...new Set(groups.map(g => g.motivation).filter(Boolean))] as string[];
  const countries = [...new Set(groups.map(g => g.country).filter(Boolean))] as string[];

  const filtered = groups.filter(g => {
    if (filterMotivation && g.motivation !== filterMotivation) return false;
    if (filterCountry && g.country !== filterCountry) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.aliases.some(a => a.toLowerCase().includes(q));
    }
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading threat groups...</div>;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Threat Groups</h1>
              <p className="text-sm text-slate-400 mt-0.5">{groups.length} tracked APT and cybercriminal groups with detection coverage</p>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups, aliases..."
              className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <select value={filterMotivation} onChange={e => setFilterMotivation(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Motivations</option>
              {motivations.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{COUNTRY_FLAG[c] ?? ''} {c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className={`overflow-y-auto ${selected ? 'w-1/2' : 'w-full'} transition-all`}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800">
                <tr>
                  {['Group', 'Aliases', 'Origin', 'Motivation', 'Coverage', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id}
                    onClick={() => loadDetail(g.id)}
                    className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer ${selected === g.id ? 'bg-blue-600/10' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{g.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{g.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {g.aliases.slice(0, 2).map(a => (
                          <span key={a} className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{a}</span>
                        ))}
                        {g.aliases.length > 2 && <span className="text-xs text-slate-600">+{g.aliases.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {g.country ? `${COUNTRY_FLAG[g.country] ?? ''} ${g.country}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.motivation && (
                        <span className={`text-xs px-2 py-0.5 rounded border ${MOTIVATION_COLOR[g.motivation] ?? 'text-slate-400 bg-slate-700 border-slate-600'}`}>
                          {g.motivation}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">—</td>
                    <td className="px-4 py-3 text-xs text-blue-400">{selected === g.id ? '▶' : '›'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="w-1/2 border-l border-slate-800 overflow-y-auto bg-slate-900/30">
              {detailLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-500">Loading...</div>
              ) : detail ? (
                <GroupDetailPane
                  group={groups.find(g => g.id === selected)!}
                  detail={detail}
                  onClose={() => { setSelected(null); setDetail(null); }}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GroupDetailPane({ group, detail, onClose }: { group: ThreatGroup; detail: GroupDetail; onClose: () => void }) {
  const { coverage } = detail;
  const exposed = coverage.details.filter(t => !t.detected);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">{group.name}</h2>
          <div className="text-xs text-slate-400 mt-0.5">{group.id} · {group.country} · {group.motivation}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">×</button>
      </div>

      {group.description && <p className="text-xs text-slate-400 leading-relaxed">{group.description}</p>}

      <div className="flex gap-2 flex-wrap">
        {group.aliases.map(a => (
          <span key={a} className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">{a}</span>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="text-xs font-medium text-slate-400 mb-2">Detection Coverage</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-2xl font-bold ${coverage.pct >= 60 ? 'text-emerald-400' : coverage.pct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {coverage.pct}%
          </span>
          <span className="text-xs text-slate-500">{coverage.covered}/{coverage.total} techniques detected</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${coverage.pct}%` }} />
        </div>
        {exposed.length > 0 && (
          <div className="mt-2 text-xs text-red-400">{exposed.length} techniques not detected</div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Technique Coverage</div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {coverage.details.map(t => (
            <div key={t.technique_id} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.detected ? 'bg-emerald-400' : 'bg-red-500'}`} />
              <span className="font-mono text-slate-500 w-14">{t.technique_id}</span>
              <span className={t.detected ? 'text-slate-300' : 'text-slate-500'}>{t.technique_name}</span>
              {!t.detected && <span className="ml-auto text-red-400 text-xs">EXPOSED</span>}
            </div>
          ))}
        </div>
      </div>

      {group.url && (
        <a href={group.url} target="_blank" rel="noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          View on MITRE ATT&CK ↗
        </a>
      )}
    </div>
  );
}
