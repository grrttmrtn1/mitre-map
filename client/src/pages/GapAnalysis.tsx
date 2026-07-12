import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { CoveredTechnique, CveGapSummary, GapTechnique } from '../types';
import StatusBadge from '../components/StatusBadge';
import { D3FEND_CATEGORY_COLORS } from '../lib/constants';
import { SkeletonRow } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

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

interface FilterPreset { name: string; search: string; filterTactic: string; sortBy: string; }

const COLUMN_IDS = ['tactics', 'd3fend', 'mitigations', 'threat_groups', 'data_sources'] as const;
type ColumnId = typeof COLUMN_IDS[number];
const COLUMN_LABELS: Record<ColumnId, string> = {
  tactics: 'Tactics',
  d3fend: 'D3FEND Countermeasures',
  mitigations: 'ATT&CK Mitigations',
  threat_groups: 'Threat Groups',
  data_sources: 'Data Sources',
};

function PriorityBar({ score, components }: { score: number; components: GapTechnique['priority_components'] }) {
  const level = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
  const colors = { critical: 'text-red-400 bg-red-500/15 border-red-500/30', high: 'text-orange-400 bg-orange-500/15 border-orange-500/30', medium: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', low: 'text-gray-500 dark:text-slate-400 bg-gray-200 dark:bg-slate-700 border-gray-400 dark:border-slate-600' };
  return (
    <span className="group relative">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono cursor-default ${colors[level]}`}>
        P{score}
      </span>
      <div className="hidden group-hover:block absolute right-0 top-6 z-10 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 shadow-xl text-xs w-44 space-y-1">
        <div className="text-gray-700 dark:text-slate-300 font-semibold mb-1.5">Priority breakdown</div>
        <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>Threat groups</span><span className="text-gray-800 dark:text-slate-200">{components.group}/40</span></div>
        <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>Industry targeting</span><span className="text-gray-800 dark:text-slate-200">{components.industry}/30</span></div>
        <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>Data readiness</span><span className="text-gray-800 dark:text-slate-200">{components.data_sources}/20</span></div>
        <div className="flex justify-between text-gray-500 dark:text-slate-400"><span>Mitigation guidance</span><span className="text-gray-800 dark:text-slate-200">{components.mitigation_guidance}/10</span></div>
      </div>
    </span>
  );
}

export default function GapAnalysis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [assigningGap, setAssigningGap] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ assignee: '', priority: 'medium', due_date: '' });
  const [savingAssign, setSavingAssign] = useState(false);
  const [cveSummary, setCveSummary] = useState<Map<string, CveGapSummary>>(new Map());

  // Task 6: saved filter presets
  const [presets, setPresets] = useState<FilterPreset[]>(
    () => JSON.parse(localStorage.getItem('gap_filter_presets') ?? '[]')
  );
  const [presetName, setPresetName] = useState('');
  const [presetSaveOpen, setPresetSaveOpen] = useState(false);

  // Task 7: column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(
    () => {
      const stored = localStorage.getItem('gap_visible_columns');
      if (stored) {
        try { return new Set(JSON.parse(stored) as ColumnId[]); }
        catch { /* fallthrough */ }
      }
      return new Set(COLUMN_IDS);
    }
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.getCoverageGaps(), api.getCoveredTechniques(), api.getSetting('org_sector')])
      .then(([g, c, s]) => { setGaps(g); setCovered(c); setOrgSector(s.value ?? ''); })
      .finally(() => setLoading(false));
    api.getCveGapSummary().then(rows => {
      const m = new Map<string, CveGapSummary>();
      for (const r of rows) m.set(r.technique_id, r);
      setCveSummary(m);
    }).catch(() => {});
  }, []);

  const saveSector = async (val: string) => {
    setSavingSector(true);
    await api.setSetting('org_sector', val || null).finally(() => setSavingSector(false));
    // Reload gaps so priority scores reflect new sector
    api.getCoverageGaps().then(setGaps);
  };

  // Task 6: preset helpers
  const savePreset = () => {
    if (!presetName.trim()) return;
    const next = [...presets, { name: presetName.trim(), search, filterTactic, sortBy }];
    setPresets(next);
    localStorage.setItem('gap_filter_presets', JSON.stringify(next));
    setPresetName('');
    setPresetSaveOpen(false);
    toast.success('Filter preset saved');
  };

  const deletePreset = (idx: number) => {
    const next = presets.filter((_, i) => i !== idx);
    setPresets(next);
    localStorage.setItem('gap_filter_presets', JSON.stringify(next));
  };

  const applyPreset = (p: FilterPreset) => {
    setSearch(p.search);
    setFilterTactic(p.filterTactic);
    setSortBy(p.sortBy as typeof sortBy);
  };

  // Task 7: column visibility helpers
  const toggleColumn = (col: ColumnId) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      localStorage.setItem('gap_visible_columns', JSON.stringify([...next]));
      return next;
    });
  };

  function createDetectionFromGap(techniqueId: string, techniqueName: string) {
    navigate(`/detections?prefill_technique=${techniqueId}&prefill_name=${encodeURIComponent('Detect ' + techniqueName)}`);
  }

  async function saveAssignment(techniqueId: string) {
    if (!assignForm.assignee.trim()) return;
    setSavingAssign(true);
    try {
      await api.createAssignment({
        entity_type: 'technique',
        entity_id: techniqueId,
        assignee: assignForm.assignee,
        priority: assignForm.priority as 'critical' | 'high' | 'medium' | 'low',
        due_date: assignForm.due_date || null,
      });
      toast.success('Assignment created');
      setAssigningGap(null);
      setAssignForm({ assignee: '', priority: 'medium', due_date: '' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingAssign(false);
    }
  }

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

  if (loading) return (
    <div className="flex flex-col h-full">
      <div className="page-command-header">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="h-6 w-36 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-3.5 w-64 bg-gray-100/60 dark:bg-slate-800/60 rounded animate-pulse mt-2" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {Array.from({ length: 18 }).map((_, i) => (
          <SkeletonRow key={i} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="page-command-header">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Gap Analysis</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {view === 'gaps'
                ? `${gaps.length} techniques with no active detection or tool mitigation`
                : `${covered.length} techniques with active detection or tool mitigation`}
            </p>
          </div>
          <button onClick={exportCSV}
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-400 dark:border-slate-600 rounded-lg hover:bg-slate-600 transition-colors">
            Export CSV
          </button>
        </div>

        <div className="flex gap-1 mt-3">
          <button
            onClick={() => handleViewChange('gaps')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'gaps' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:bg-slate-800'}`}>
            Gaps
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${view === 'gaps' ? 'bg-red-500/20 text-red-400' : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'}`}>{gaps.length}</span>
          </button>
          <button
            onClick={() => handleViewChange('covered')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${view === 'covered' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:bg-slate-800'}`}>
            Covered
            <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${view === 'covered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'}`}>{covered.length}</span>
          </button>
        </div>

        {/* Task 6: preset chips */}
        {presets.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-xs text-gray-400 dark:text-slate-500">Presets:</span>
            {presets.map((p, i) => (
              <span key={i} className="flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-xs text-gray-600 dark:text-slate-300">
                <button onClick={() => applyPreset(p)} className="hover:text-blue-400 transition-colors">{p.name}</button>
                <button onClick={() => deletePreset(i)} className="ml-1 text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search techniques..."
            className="flex-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          <select value={filterTactic} onChange={e => setFilterTactic(e.target.value)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">All Tactics</option>
            {allTactics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {view === 'gaps' ? (
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="priority">Sort: Priority Score</option>
              <option value="tactic">Sort: Tactic</option>
              <option value="d3fend">Sort: D3FEND coverage</option>
              <option value="mitigations">Sort: Mitigations</option>
            </select>
          ) : (
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500">
              <option value="tactic">Sort: Tactic</option>
              <option value="detections">Sort: Detections</option>
              <option value="tools">Sort: Tools</option>
            </select>
          )}
          {/* Task 6: save preset button */}
          <div className="relative">
            <button
              onClick={() => setPresetSaveOpen(v => !v)}
              className="px-2.5 py-1.5 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200 transition-colors"
              title="Save current filters as preset"
            >
              + Save preset
            </button>
            {presetSaveOpen && (
              <div className="absolute right-0 top-9 z-30 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg p-2 shadow-xl flex gap-2 w-52">
                <input
                  autoFocus
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setPresetSaveOpen(false); }}
                  placeholder="Preset name..."
                  className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-gray-800 dark:text-slate-200 focus:outline-none"
                />
                <button onClick={savePreset} className="px-2 py-1 text-xs bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/40">Save</button>
              </div>
            )}
          </div>
          {/* Task 7: column visibility */}
          <div className="relative">
            <button
              onClick={() => setColPickerOpen(v => !v)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${colPickerOpen ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200'}`}
              title="Toggle column visibility"
            >
              &#9881; Columns
            </button>
            {colPickerOpen && (
              <div className="absolute right-0 top-9 z-30 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg p-2 shadow-xl w-52">
                {COLUMN_IDS.map(col => (
                  <label key={col} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col)}
                      onChange={() => toggleColumn(col)}
                      className="accent-blue-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-slate-300">{COLUMN_LABELS[col]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        {view === 'gaps' && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400 dark:text-slate-500">Industry sector:</span>
            <select
              value={orgSector}
              onChange={e => { setOrgSector(e.target.value); saveSector(e.target.value); }}
              disabled={savingSector}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="">Not set (industry targeting N/A)</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-gray-400 dark:text-slate-600">Used to weigh industry-relevant threat groups in priority score.</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {view === 'gaps' ? (
          filteredGaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg className="w-14 h-14 text-emerald-700/60 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <p className="text-sm font-medium text-emerald-400">No gaps with current filters</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">All techniques are covered — or try adjusting your filters.</p>
            </div>
          ) : (
            filteredGaps.map(g => (
              <div key={g.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100/30 dark:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 flex-shrink-0">GAP</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">{g.id}</span>
                    <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">{g.name}</span>
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
                        <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs hidden sm:inline">{t}</span>
                      ))}
                      {g.tactic_names.length > 2 && <span className="text-xs text-gray-400 dark:text-slate-500">+{g.tactic_names.length - 2}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
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
                    {(() => {
                      const cve = cveSummary.get(g.id);
                      if (!cve || cve.cve_count === 0) return null;
                      const max = Number(cve.max_cvss) || 0;
                      const cls = max >= 9 ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : max >= 7 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${cls}`}
                          title={`${cve.cve_count} CVE(s) — Max CVSS: ${max}`}>
                          CVE·{cve.cve_count}
                        </span>
                      );
                    })()}
                    <span className="text-gray-400 dark:text-slate-600 text-sm">{expanded === g.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Quick actions */}
                <div className="px-4 pb-2 flex items-center gap-1.5">
                  <button
                    onClick={() => createDetectionFromGap(g.id, g.name)}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >
                    + Create Detection
                  </button>
                  <button
                    onClick={() => { setAssigningGap(g.id); setAssignForm({ assignee: user?.name ?? '', priority: 'medium', due_date: '' }); }}
                    className="text-[10px] px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    Assign
                  </button>
                </div>

                {assigningGap === g.id && (
                  <div className="mx-4 mb-2 flex items-center gap-2 p-2 bg-gray-100 dark:bg-slate-800 rounded-lg">
                    <input
                      type="text" value={assignForm.assignee}
                      onChange={e => setAssignForm(f => ({ ...f, assignee: e.target.value }))}
                      placeholder="Assignee"
                      className="flex-1 min-w-0 text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50"
                    />
                    <select
                      value={assignForm.priority}
                      onChange={e => setAssignForm(f => ({ ...f, priority: e.target.value }))}
                      className="text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none"
                    >
                      {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input
                      type="date" value={assignForm.due_date}
                      onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))}
                      className="text-xs bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button
                      onClick={() => saveAssignment(g.id)} disabled={savingAssign}
                      className="text-xs px-2 py-1 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/40 disabled:opacity-50 transition-colors"
                    >
                      {savingAssign ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setAssigningGap(null)} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 px-1">✕</button>
                  </div>
                )}

                {expanded === g.id && (
                  <div className="border-t border-gray-200 dark:border-slate-800 px-4 py-4 grid grid-cols-2 gap-4">
                    {visibleColumns.has('d3fend') && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Recommended D3FEND Countermeasures</div>
                        {g.recommended_d3fend.length === 0 ? (
                          <div className="text-xs text-gray-400 dark:text-slate-500 italic">No D3FEND mappings available.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {g.recommended_d3fend.map(d => (
                              <div key={d.id} className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${D3FEND_CATEGORY_COLORS[d.category] ?? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-400 dark:border-slate-600'}`}>
                                  {d.category}
                                </span>
                                <span className="font-mono text-xs text-gray-400 dark:text-slate-500">{d.id}</span>
                                <span className="text-xs text-gray-700 dark:text-slate-300">{d.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {visibleColumns.has('mitigations') && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Recommended ATT&CK Mitigations</div>
                        {g.recommended_mitigations.length === 0 ? (
                          <div className="text-xs text-gray-400 dark:text-slate-500 italic">No mitigations available.</div>
                        ) : (
                          <div className="space-y-1.5">
                            {g.recommended_mitigations.map(m => (
                              <div key={m.id} className="flex items-start gap-2">
                                <span className="font-mono text-xs text-purple-400 w-12 flex-shrink-0">{m.id}</span>
                                <span className="text-xs text-gray-700 dark:text-slate-300">{m.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {g.priority_components && (
                      <div className="col-span-2 bg-gray-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                        <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Priority Score: <span className="text-gray-800 dark:text-slate-200">{g.priority_score}/100</span></div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {visibleColumns.has('threat_groups') && (
                            <div className="bg-gray-50 dark:bg-slate-900 rounded p-2 text-center">
                              <div className="text-amber-400 font-bold text-base">{g.priority_components.group}</div>
                              <div className="text-gray-400 dark:text-slate-500 mt-0.5">Threat groups<br/><span className="text-gray-400 dark:text-slate-600">/40</span></div>
                            </div>
                          )}
                          <div className="bg-gray-50 dark:bg-slate-900 rounded p-2 text-center">
                            <div className="text-sky-400 font-bold text-base">{g.priority_components.industry}</div>
                            <div className="text-gray-400 dark:text-slate-500 mt-0.5">Industry targeting<br/><span className="text-gray-400 dark:text-slate-600">/30</span></div>
                          </div>
                          {visibleColumns.has('data_sources') && (
                            <div className="bg-gray-50 dark:bg-slate-900 rounded p-2 text-center">
                              <div className="text-emerald-400 font-bold text-base">{g.priority_components.data_sources}</div>
                              <div className="text-gray-400 dark:text-slate-500 mt-0.5">Data readiness<br/><span className="text-gray-400 dark:text-slate-600">/20</span></div>
                            </div>
                          )}
                          <div className="bg-gray-50 dark:bg-slate-900 rounded p-2 text-center">
                            <div className="text-purple-400 font-bold text-base">{g.priority_components.mitigation_guidance}</div>
                            <div className="text-gray-400 dark:text-slate-500 mt-0.5">Mit. guidance<br/><span className="text-gray-400 dark:text-slate-600">/10</span></div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between">
                      {visibleColumns.has('tactics') && (
                        <div className="flex gap-2">
                          {g.tactic_names.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">{t}</span>
                          ))}
                        </div>
                      )}
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
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg className="w-14 h-14 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-sm font-medium text-gray-500 dark:text-slate-400">No covered techniques match filters</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Try clearing filters or add detections and tools to build coverage.</p>
            </div>
          ) : (
            filteredCovered.map(c => (
              <div key={c.id} className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100/30 dark:bg-slate-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded border flex-shrink-0 uppercase ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                    <span className="font-mono text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">{c.id}</span>
                    <span className="text-sm text-gray-800 dark:text-slate-200 font-medium">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="flex gap-1.5">
                      {c.tactic_names.slice(0, 2).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs hidden sm:inline">{t}</span>
                      ))}
                      {c.tactic_names.length > 2 && <span className="text-xs text-gray-400 dark:text-slate-500">+{c.tactic_names.length - 2}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {c.detections.length > 0 && (
                        <span className="text-sky-400">{c.detections.length} detection{c.detections.length !== 1 ? 's' : ''}</span>
                      )}
                      {c.tools.length > 0 && (
                        <span className="text-blue-400">{c.tools.length} tool{c.tools.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <span className="text-gray-400 dark:text-slate-600 text-sm">{expanded === c.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expanded === c.id && (
                  <div className="border-t border-gray-200 dark:border-slate-800 px-4 py-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Active Detections</div>
                      {c.detections.length === 0 ? (
                        <div className="text-xs text-gray-400 dark:text-slate-500 italic">No active detections.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {c.detections.map(d => (
                            <div key={d.id} className="flex items-center gap-2">
                              <StatusBadge value={d.severity} variant="severity" />
                              <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{d.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Covering Tools</div>
                      {c.tools.length === 0 ? (
                        <div className="text-xs text-gray-400 dark:text-slate-500 italic">No tools assigned via mitigations.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {c.tools.map(t => (
                            <div key={t.id} className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-xs bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400">{t.category}</span>
                              <span className="text-xs text-gray-700 dark:text-slate-300">{t.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex gap-2">
                        {c.tactic_names.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded text-xs">{t}</span>
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
