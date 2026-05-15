import { useState, useEffect } from 'react';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Core types ───────────────────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'enum' | 'date' | 'boolean';
type VisType = 'table' | 'bar' | 'pie' | 'line';
type Operator = 'eq' | 'neq' | 'gt' | 'lt' | 'contains';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

interface DataSourceDef {
  label: string;
  fetch: () => Promise<any[]>;
  transform?: (item: any) => any;
  fields: FieldDef[];
}

interface ReportFilter {
  id: string;
  field: string;
  operator: Operator;
  value: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  columns: string[];
  filters: ReportFilter[];
  visualization: VisType;
  chartLabelField?: string;
  chartValueField?: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  created_at: string;
  updated_at: string;
}

// ─── Data source registry ─────────────────────────────────────────────────────

const DATA_SOURCES: Record<string, DataSourceDef> = {
  detections: {
    label: 'Detections',
    fetch: () => api.getDetections(),
    transform: (d: any) => ({ ...d, technique_count: (d.technique_ids ?? []).length }),
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'status', label: 'Status', type: 'enum', options: ['active', 'disabled', 'tuning', 'planned', 'archived'] },
      { key: 'severity', label: 'Severity', type: 'enum', options: ['critical', 'high', 'medium', 'low', 'informational'] },
      { key: 'confidence', label: 'Confidence', type: 'enum', options: ['high', 'medium', 'low'] },
      { key: 'source', label: 'Source', type: 'string' },
      { key: 'technique_count', label: 'Technique Count', type: 'number' },
      { key: 'false_positive_rate', label: 'False Positive Rate', type: 'string' },
      { key: 'created_at', label: 'Created At', type: 'date' },
      { key: 'updated_at', label: 'Updated At', type: 'date' },
    ],
  },
  tools: {
    label: 'Tools',
    fetch: () => api.getTools(),
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'vendor', label: 'Vendor', type: 'string' },
      { key: 'category', label: 'Category', type: 'string' },
      { key: 'status', label: 'Status', type: 'enum', options: ['active', 'planned', 'deprecated'] },
      { key: 'd3fend_count', label: 'D3FEND Count', type: 'number' },
      { key: 'mitigation_count', label: 'Mitigation Count', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'date' },
    ],
  },
  threat_groups: {
    label: 'Threat Groups',
    fetch: async () => (await api.getThreatLandscapeReport()).groups,
    fields: [
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'id', label: 'Group ID', type: 'string' },
      { key: 'country', label: 'Country', type: 'string' },
      { key: 'motivation', label: 'Motivation', type: 'string' },
      { key: 'risk_level', label: 'Risk Level', type: 'enum', options: ['critical', 'high', 'medium', 'low'] },
      { key: 'exposure_pct', label: 'Exposure %', type: 'number' },
      { key: 'total_techniques', label: 'Total Techniques', type: 'number' },
      { key: 'covered', label: 'Covered', type: 'number' },
      { key: 'exposure', label: 'Exposed', type: 'number' },
    ],
  },
  coverage_by_tactic: {
    label: 'Coverage by Tactic',
    fetch: async () => (await api.getCoverageStats()).tactic_stats,
    fields: [
      { key: 'tactic_name', label: 'Tactic', type: 'string' },
      { key: 'total', label: 'Total Techniques', type: 'number' },
      { key: 'detected', label: 'Detected', type: 'number' },
      { key: 'mitigated', label: 'Mitigated', type: 'number' },
      { key: 'covered', label: 'Covered', type: 'number' },
      { key: 'gap', label: 'Gaps', type: 'number' },
      { key: 'pct', label: 'Coverage %', type: 'number' },
    ],
  },
  priority_gaps: {
    label: 'Priority Gaps',
    fetch: async () => (await api.getGapReport()).gaps,
    transform: (g: any) => ({
      ...g,
      tactic_ids: Array.isArray(g.tactic_ids) ? g.tactic_ids.join(', ') : g.tactic_ids,
      mitigated: g.mitigated ? 'Yes' : 'No',
    }),
    fields: [
      { key: 'id', label: 'Technique ID', type: 'string' },
      { key: 'name', label: 'Name', type: 'string' },
      { key: 'tactic_ids', label: 'Tactics', type: 'string' },
      { key: 'group_count', label: 'Threat Groups', type: 'number' },
      { key: 'compliance_impact', label: 'Compliance Impact', type: 'number' },
      { key: 'priority_score', label: 'Priority Score', type: 'number' },
      { key: 'mitigated', label: 'Mitigated', type: 'enum', options: ['Yes', 'No'] },
    ],
  },
  risk_by_tactic: {
    label: 'Risk by Tactic',
    fetch: () => api.getRiskByTactic(),
    fields: [
      { key: 'tactic_name', label: 'Tactic', type: 'string' },
      { key: 'total_techniques', label: 'Total Techniques', type: 'number' },
      { key: 'covered', label: 'Covered', type: 'number' },
      { key: 'gap_count', label: 'Gaps', type: 'number' },
      { key: 'coverage_pct', label: 'Coverage %', type: 'number' },
      { key: 'group_exposure_score', label: 'Group Exposure Score', type: 'number' },
      { key: 'risk_score', label: 'Risk Score', type: 'number' },
      { key: 'risk_level', label: 'Risk Level', type: 'enum', options: ['critical', 'high', 'medium', 'low'] },
    ],
  },
  snapshots: {
    label: 'Coverage Snapshots',
    fetch: () => api.getSnapshots(),
    fields: [
      { key: 'taken_at', label: 'Date', type: 'date' },
      { key: 'coverage_pct', label: 'Coverage %', type: 'number' },
      { key: 'covered_techniques', label: 'Covered', type: 'number' },
      { key: 'detected_techniques', label: 'Detected', type: 'number' },
      { key: 'mitigated_techniques', label: 'Mitigated', type: 'number' },
      { key: 'gap_techniques', label: 'Gaps', type: 'number' },
      { key: 'active_detections', label: 'Active Detections', type: 'number' },
      { key: 'total_tools', label: 'Total Tools', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'string' },
    ],
  },
};

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mitremap_custom_reports_v1';

function loadReports(): ReportDefinition[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function saveReports(reports: ReportDefinition[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function makeNewReport(): ReportDefinition {
  return {
    id: randomUUID(),
    name: 'New Report',
    description: '',
    dataSource: 'detections',
    columns: ['name', 'status', 'severity', 'source'],
    filters: [],
    visualization: 'table',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── Filter logic ─────────────────────────────────────────────────────────────

function applyFilters(data: any[], filters: ReportFilter[]): any[] {
  return data.filter(row =>
    filters.every(f => {
      const raw = row[f.field];
      const val = String(raw ?? '').toLowerCase();
      const fval = f.value.toLowerCase();
      switch (f.operator) {
        case 'eq': return val === fval;
        case 'neq': return val !== fval;
        case 'gt': return Number(raw) > Number(f.value);
        case 'lt': return Number(raw) < Number(f.value);
        case 'contains': return val.includes(fval);
        default: return true;
      }
    })
  );
}

function applySorting(data: any[], field?: string, dir?: 'asc' | 'desc'): any[] {
  if (!field) return data;
  const m = dir === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const av = a[field], bv = b[field];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * m;
    return String(av ?? '').localeCompare(String(bv ?? '')) * m;
  });
}

// ─── Color palette for charts ─────────────────────────────────────────────────

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportBuilder() {
  const { theme } = useTheme();
  const [reports, setReports] = useState<ReportDefinition[]>(loadReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReportDefinition | null>(null);
  const [dirty, setDirty] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selection
  useEffect(() => {
    if (reports.length > 0 && !selectedId) setSelectedId(reports[0].id);
  }, []);

  // Sync editing state when selection changes
  useEffect(() => {
    const r = reports.find(r => r.id === selectedId) ?? null;
    setEditing(r ? { ...r } : null);
    setData([]);
    setDirty(false);
    setError(null);
  }, [selectedId]);

  const persistReports = (next: ReportDefinition[]) => {
    setReports(next);
    saveReports(next);
  };

  const saveEditing = () => {
    if (!editing) return;
    const updated = { ...editing, updated_at: new Date().toISOString() };
    const next = reports.some(r => r.id === updated.id)
      ? reports.map(r => r.id === updated.id ? updated : r)
      : [...reports, updated];
    persistReports(next);
    setDirty(false);
  };

  const createReport = () => {
    const r = makeNewReport();
    persistReports([...reports, r]);
    setSelectedId(r.id);
  };

  const duplicateReport = (id: string) => {
    const src = reports.find(r => r.id === id);
    if (!src) return;
    const dup: ReportDefinition = {
      ...src,
      id: randomUUID(),
      name: `${src.name} (copy)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persistReports([...reports, dup]);
    setSelectedId(dup.id);
  };

  const deleteReport = (id: string) => {
    if (!confirm('Delete this report?')) return;
    const next = reports.filter(r => r.id !== id);
    persistReports(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const update = (patch: Partial<ReportDefinition>) => {
    setEditing(prev => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
    if ('dataSource' in patch) {
      setData([]);
      setError(null);
    }
  };

  const toggleColumn = (key: string) => {
    if (!editing) return;
    const cols = editing.columns.includes(key)
      ? editing.columns.filter(c => c !== key)
      : [...editing.columns, key];
    update({ columns: cols });
  };

  const addFilter = () => {
    if (!editing) return;
    const src = DATA_SOURCES[editing.dataSource];
    update({
      filters: [
        ...editing.filters,
        { id: randomUUID(), field: src.fields[0].key, operator: 'eq', value: '' },
      ],
    });
  };

  const removeFilter = (id: string) => {
    if (!editing) return;
    update({ filters: editing.filters.filter(f => f.id !== id) });
  };

  const updateFilter = (id: string, patch: Partial<ReportFilter>) => {
    if (!editing) return;
    update({ filters: editing.filters.map(f => f.id === id ? { ...f, ...patch } : f) });
  };

  const runReport = async () => {
    if (!editing) return;
    setLoading(true);
    setError(null);
    try {
      const src = DATA_SOURCES[editing.dataSource];
      let rows = await src.fetch();
      if (src.transform) rows = rows.map(src.transform);
      rows = applyFilters(rows, editing.filters);
      rows = applySorting(rows, editing.sortField, editing.sortDir);
      setData(rows);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!editing || !data.length) return;
    const cols = editing.columns;
    const src = DATA_SOURCES[editing.dataSource];
    const fieldMap = Object.fromEntries(src.fields.map(f => [f.key, f]));
    const header = cols.map(c => fieldMap[c]?.label ?? c).join(',');
    const rows = data.map(r =>
      cols.map(c => {
        const v = r[c];
        const str = v === null || v === undefined ? '' : String(v);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    download([header, ...rows].join('\n'), `${editing.name.replace(/\s+/g, '_')}.csv`, 'text/csv');
  };

  const exportJson = () => {
    if (!editing || !data.length) return;
    const filtered = data.map(r => Object.fromEntries(editing.columns.map(c => [c, r[c]])));
    download(JSON.stringify(filtered, null, 2), `${editing.name.replace(/\s+/g, '_')}.json`, 'application/json');
  };

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-gray-500 dark:text-slate-400 text-sm">No custom reports yet</div>
        <button onClick={createReport} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors">
          Create Your First Report
        </button>
      </div>
    );
  }

  const src = editing ? DATA_SOURCES[editing.dataSource] : null;
  const fieldMap = src ? Object.fromEntries(src.fields.map(f => [f.key, f])) : {};

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar — saved reports list */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-slate-800 flex flex-col">
        <div className="p-2.5 border-b border-gray-200 dark:border-slate-800">
          <button onClick={createReport}
            className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium">
            + New Report
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {reports.map(r => (
            <div key={r.id}
              className={`group flex items-center px-2.5 py-2 cursor-pointer transition-colors ${r.id === selectedId ? 'bg-blue-600/20' : 'hover:bg-gray-100/60 dark:bg-slate-800/60'}`}
              onClick={() => setSelectedId(r.id)}>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${r.id === selectedId ? 'text-blue-300' : 'text-gray-700 dark:text-slate-300'}`}>{r.name}</div>
                <div className="text-xs text-gray-400 dark:text-slate-600 truncate">{DATA_SOURCES[r.dataSource]?.label}</div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1">
                <button onClick={e => { e.stopPropagation(); duplicateReport(r.id); }}
                  title="Duplicate"
                  className="text-gray-400 dark:text-slate-600 hover:text-gray-700 dark:text-slate-300 text-xs px-0.5">⎘</button>
                <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }}
                  title="Delete"
                  className="text-gray-400 dark:text-slate-600 hover:text-red-400 text-xs px-0.5">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      {editing && src ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Config area (scrollable, capped height) */}
          <div className="flex-shrink-0 max-h-[52%] overflow-y-auto border-b border-gray-200 dark:border-slate-800 p-4 space-y-4">
            {/* Header row */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <input value={editing.name} onChange={e => update({ name: e.target.value })}
                  className="w-full bg-transparent text-sm font-semibold text-gray-900 dark:text-slate-100 border-b border-transparent hover:border-gray-300 dark:border-slate-700 focus:border-blue-500 focus:outline-none pb-0.5 transition-colors" />
                <input value={editing.description} onChange={e => update({ description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full bg-transparent text-xs text-gray-400 dark:text-slate-500 border-b border-transparent hover:border-gray-300 dark:border-slate-700 focus:border-gray-400 dark:focus:border-gray-400 dark:border-slate-600 focus:outline-none pb-0.5 mt-1 transition-colors" />
              </div>
              <div className="flex gap-1.5 flex-shrink-0 items-center">
                {dirty && (
                  <button onClick={saveEditing}
                    className="px-2.5 py-1.5 text-xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
                    Save
                  </button>
                )}
                <button onClick={runReport} disabled={loading}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors font-medium">
                  {loading ? 'Running…' : 'Run Report'}
                </button>
                {data.length > 0 && (
                  <div className="relative group/export">
                    <button className="px-2.5 py-1.5 text-xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-400 dark:border-slate-600 rounded-lg hover:bg-slate-600 transition-colors">
                      Export ▾
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-28 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50 hidden group-hover/export:block">
                      <button onClick={exportCsv} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:bg-slate-700 rounded-t-lg transition-colors">CSV</button>
                      <button onClick={exportJson} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:bg-slate-700 rounded-b-lg transition-colors">JSON</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">Data Source</label>
                <select value={editing.dataSource}
                  onChange={e => update({
                    dataSource: e.target.value,
                    columns: DATA_SOURCES[e.target.value].fields.slice(0, 4).map(f => f.key),
                    filters: [],
                    chartLabelField: undefined,
                    chartValueField: undefined,
                    sortField: undefined,
                  })}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors">
                  {Object.entries(DATA_SOURCES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">Visualization</label>
                <select value={editing.visualization} onChange={e => update({ visualization: e.target.value as VisType })}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors">
                  <option value="table">Table</option>
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="line">Line Chart</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">Sort By</label>
                <div className="flex gap-1">
                  <select value={editing.sortField ?? ''} onChange={e => update({ sortField: e.target.value || undefined })}
                    className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors">
                    <option value="">None</option>
                    {src.fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select value={editing.sortDir ?? 'asc'} onChange={e => update({ sortDir: e.target.value as 'asc' | 'desc' })}
                    className="w-14 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-colors">
                    <option value="asc">↑ Asc</option>
                    <option value="desc">↓ Desc</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Chart axis config */}
            {editing.visualization !== 'table' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-100/40 dark:bg-slate-800/40 rounded-lg border border-gray-200 dark:border-slate-800">
                <div>
                  <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">
                    {editing.visualization === 'line' ? 'X-Axis (label)' : 'Label Field'}
                  </label>
                  <select value={editing.chartLabelField ?? ''}
                    onChange={e => update({ chartLabelField: e.target.value || undefined })}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="">— select field —</option>
                    {src.fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1">
                    {editing.visualization === 'line' ? 'Y-Axis (value)' : 'Value Field'}
                  </label>
                  <select value={editing.chartValueField ?? ''}
                    onChange={e => update({ chartValueField: e.target.value || undefined })}
                    className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="">— select field —</option>
                    {src.fields.filter(f => f.type === 'number' || f.type === 'date').map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Column selector */}
            <div>
              <label className="text-xs text-gray-400 dark:text-slate-500 block mb-1.5">Columns</label>
              <div className="flex flex-wrap gap-1.5">
                {src.fields.map(f => (
                  <button key={f.key} onClick={() => toggleColumn(f.key)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${editing.columns.includes(f.key)
                      ? 'bg-blue-600/20 border-blue-500/30 text-blue-300'
                      : 'bg-gray-100/50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:text-slate-300 hover:border-gray-400 dark:border-slate-600'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400 dark:text-slate-500">Filters</label>
                <button onClick={addFilter} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  + Add Filter
                </button>
              </div>
              {editing.filters.length === 0 && (
                <div className="text-xs text-gray-400 dark:text-slate-600 py-1">No filters — showing all rows</div>
              )}
              <div className="space-y-1.5">
                {editing.filters.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <select value={f.field} onChange={e => updateFilter(f.id, { field: e.target.value })}
                      className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                      {src.fields.map(fd => <option key={fd.key} value={fd.key}>{fd.label}</option>)}
                    </select>
                    <select value={f.operator} onChange={e => updateFilter(f.id, { operator: e.target.value as Operator })}
                      className="w-28 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-slate-200 focus:outline-none">
                      <option value="eq">equals</option>
                      <option value="neq">not equals</option>
                      <option value="gt">greater than</option>
                      <option value="lt">less than</option>
                      <option value="contains">contains</option>
                    </select>
                    {fieldMap[f.field]?.options ? (
                      <select value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                        className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                        <option value="">— any —</option>
                        {fieldMap[f.field].options!.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                        placeholder="value"
                        className="flex-1 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500" />
                    )}
                    <button onClick={() => removeFilter(f.id)} className="text-gray-400 dark:text-slate-600 hover:text-red-400 text-base leading-none">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results area */}
          <div className="flex-1 overflow-y-auto min-h-0 p-4">
            {loading && (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">Running report…</div>
            )}
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
            )}
            {!loading && !error && data.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400 dark:text-slate-600">
                <div className="text-sm">Configure your report above and click Run Report</div>
              </div>
            )}
            {!loading && !error && data.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 dark:text-slate-500">{data.length} row{data.length !== 1 ? 's' : ''}</span>
                </div>
                {editing.visualization === 'table' && (
                  <ReportTable data={data} columns={editing.columns} fieldMap={fieldMap} />
                )}
                {editing.visualization === 'bar' && (
                  <ReportBarChart
                    data={data}
                    labelField={editing.chartLabelField}
                    valueField={editing.chartValueField}
                    valueLabel={editing.chartValueField ? (fieldMap[editing.chartValueField]?.label ?? editing.chartValueField) : ''}
                  />
                )}
                {editing.visualization === 'pie' && (
                  <ReportPieChart
                    data={data}
                    labelField={editing.chartLabelField}
                    valueField={editing.chartValueField}
                  />
                )}
                {editing.visualization === 'line' && (
                  <ReportLineChart
                    data={data}
                    labelField={editing.chartLabelField}
                    valueField={editing.chartValueField}
                    valueLabel={editing.chartValueField ? (fieldMap[editing.chartValueField]?.label ?? editing.chartValueField) : ''}
                  />
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-600 text-sm">
          Select a report from the list
        </div>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function ReportTable({ data, columns, fieldMap }: { data: any[]; columns: string[]; fieldMap: Record<string, FieldDef> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white dark:bg-slate-950 z-10">
          <tr className="border-b border-gray-200 dark:border-slate-800">
            {columns.map(c => (
              <th key={c} className="text-left py-2 px-3 text-gray-400 dark:text-slate-500 font-medium whitespace-nowrap">
                {fieldMap[c]?.label ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-200/40 dark:border-slate-800/40 hover:bg-gray-100/20 dark:bg-slate-800/20">
              {columns.map(c => (
                <td key={c} className="py-2 px-3">
                  <CellValue value={row[c]} field={fieldMap[c]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellValue({ value, field }: { value: any; field?: FieldDef }) {
  if (value === null || value === undefined) return <span className="text-gray-400 dark:text-slate-600">—</span>;
  if (field?.type === 'date') {
    try {
      return <span className="text-gray-500 dark:text-slate-400 font-mono">{new Date(value).toLocaleString()}</span>;
    } catch {
      return <span className="text-gray-500 dark:text-slate-400">{String(value)}</span>;
    }
  }
  if (Array.isArray(value)) return <span className="text-gray-500 dark:text-slate-400">{value.join(', ')}</span>;

  if (field?.type === 'enum') {
    const STATUS_COLORS: Record<string, string> = {
      active: 'text-emerald-400', planned: 'text-blue-400', deprecated: 'text-gray-400 dark:text-slate-500',
      disabled: 'text-gray-400 dark:text-slate-500', tuning: 'text-yellow-400', archived: 'text-gray-400 dark:text-slate-500',
      critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-gray-500 dark:text-slate-400',
      informational: 'text-gray-400 dark:text-slate-500', Yes: 'text-emerald-400', No: 'text-gray-400 dark:text-slate-500',
    };
    const cls = STATUS_COLORS[String(value)] ?? 'text-gray-700 dark:text-slate-300';
    return <span className={cls}>{String(value)}</span>;
  }
  if (typeof value === 'number') return <span className="font-mono text-gray-700 dark:text-slate-300">{value}</span>;
  return <span className="text-gray-700 dark:text-slate-300">{String(value)}</span>;
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function ReportBarChart({ data, labelField, valueField, valueLabel }: {
  data: any[]; labelField?: string; valueField?: string; valueLabel: string;
}) {
  const { theme } = useTheme();
  if (!labelField || !valueField) {
    return <ChartPlaceholder />;
  }
  const chartData = data.slice(0, 40).map(r => ({
    label: String(r[labelField] ?? ''),
    value: Number(r[valueField] ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 60 }}>
        <CartesianGrid stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: theme === 'dark' ? '#64748b' : '#9ca3af', fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: theme === 'dark' ? '#64748b' : '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#ffffff', border: theme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#6b7280', marginBottom: 2 }}
          formatter={(v: number) => [v, valueLabel]}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]}>
          {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

function ReportPieChart({ data, labelField, valueField }: {
  data: any[]; labelField?: string; valueField?: string;
}) {
  const { theme } = useTheme();
  if (!labelField || !valueField) {
    return <ChartPlaceholder />;
  }
  const chartData = data.slice(0, 14).map(r => ({
    name: String(r[labelField] ?? ''),
    value: Number(r[valueField] ?? 0),
  })).filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={130} innerRadius={60}>
          {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#ffffff', border: theme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#6b7280', marginBottom: 2 }} />
        <Legend wrapperStyle={{ fontSize: 11, color: theme === 'dark' ? '#94a3b8' : '#6b7280' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────

function ReportLineChart({ data, labelField, valueField, valueLabel }: {
  data: any[]; labelField?: string; valueField?: string; valueLabel: string;
}) {
  const { theme } = useTheme();
  if (!labelField || !valueField) {
    return <ChartPlaceholder />;
  }
  const chartData = data.slice(0, 60).map(r => {
    let label = r[labelField];
    if (label && typeof label === 'string' && label.includes('T')) {
      try { label = new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { /* ignore */ }
    }
    return { label: String(label ?? ''), value: Number(r[valueField] ?? 0) };
  });
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 48 }}>
        <CartesianGrid stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} />
        <XAxis dataKey="label" tick={{ fill: theme === 'dark' ? '#64748b' : '#9ca3af', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: theme === 'dark' ? '#64748b' : '#9ca3af', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#ffffff', border: theme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: theme === 'dark' ? '#94a3b8' : '#6b7280', marginBottom: 2 }}
          formatter={(v: number) => [v, valueLabel]}
        />
        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ChartPlaceholder() {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-600 text-xs border border-dashed border-gray-200 dark:border-slate-800 rounded-lg">
      Select Label and Value fields above to render the chart
    </div>
  );
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
