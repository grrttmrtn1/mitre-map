# UX Polish & Workflow Continuity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline quick-edit in the detections table, quality score improvement suggestions, bulk tag assignment, ATT&CK matrix threat group overlay mode, filter persistence, saved filter presets on Gap Analysis, column visibility toggle, configurable dashboard widget layout, risk score dashboard widget, and a global table density toggle.

**Architecture:** Pure frontend changes except for the density toggle and saved presets (both use `localStorage`). The risk score widget calls the existing `/api/risk/score` endpoint. Overlay mode is computed client-side from already-loaded threat group data. No new backend endpoints required.

**Tech Stack:** React state, localStorage, React Router useSearchParams for filter persistence, Tailwind CSS variables for density.

---

## File Map

| File | Action |
|------|--------|
| `client/src/pages/Detections.tsx` | Modify — inline status/severity quick-edit |
| `client/src/pages/Detections.tsx` | Modify — quality score improvement suggestions panel |
| `client/src/pages/Detections.tsx` | Modify — bulk tag assignment in multi-select bar |
| `client/src/pages/AttackMatrix.tsx` | Modify — threat group overlay mode (2-group comparison) |
| `client/src/pages/AttackMatrix.tsx` | Modify — filter persistence via sessionStorage |
| `client/src/pages/GapAnalysis.tsx` | Modify — saved filter presets (localStorage) |
| `client/src/pages/GapAnalysis.tsx` | Modify — column visibility toggle |
| `client/src/pages/Dashboard.tsx` | Modify — risk score widget + configurable widget order |
| `client/src/context/ThemeContext.tsx` | Modify — expose density setting (compact/comfortable/spacious) |
| `client/src/index.css` | Modify — add density CSS classes |
| `client/src/components/Sidebar.tsx` | Modify — density toggle in user menu |

---

### Task 1: Inline quick-edit for detection status and severity

**Files:**
- Modify: `client/src/pages/Detections.tsx`

- [ ] **Step 1: Add inline edit state and handler**

In `Detections.tsx`, add state:
```tsx
const [editingCell, setEditingCell] = useState<{ id: number; field: 'status' | 'severity' } | null>(null);
const [cellUpdating, setCellUpdating] = useState<number | null>(null);
```

Add handler:
```tsx
async function updateCell(id: number, field: 'status' | 'severity', value: string) {
  setCellUpdating(id);
  setEditingCell(null);
  try {
    const updated = await api.updateDetection(id, { [field]: value });
    setDetections(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
  } catch (e: any) {
    toast(e.message, 'error');
  } finally {
    setCellUpdating(null);
  }
}
```

- [ ] **Step 2: Replace static status/severity cells with clickable inline selects**

Find the existing table row JSX in `Detections.tsx` where `StatusBadge` is rendered for each detection. Replace the static cell with:

```tsx
{/* Status cell — click to edit inline */}
<td className="py-2 pr-3 whitespace-nowrap">
  {editingCell?.id === d.id && editingCell.field === 'status' ? (
    <select
      autoFocus
      defaultValue={d.status}
      onBlur={e => { if (e.target.value !== d.status) updateCell(d.id, 'status', e.target.value); else setEditingCell(null); }}
      onChange={e => updateCell(d.id, 'status', e.target.value)}
      className="text-xs bg-white dark:bg-slate-800 border border-blue-500/50 rounded px-1.5 py-0.5 text-gray-800 dark:text-slate-200 focus:outline-none"
    >
      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  ) : (
    <div
      onClick={() => canWrite && setEditingCell({ id: d.id, field: 'status' })}
      className={canWrite ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
      title={canWrite ? 'Click to change status' : undefined}
    >
      <StatusBadge status={d.status} />
    </div>
  )}
</td>
```

Apply the same pattern for the severity cell, using `SEVERITIES` array and `d.severity`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Detections.tsx
git commit -m "feat: add inline status/severity quick-edit to detections table"
```

---

### Task 2: Quality score improvement suggestions

**Files:**
- Modify: `client/src/pages/Detections.tsx`

- [ ] **Step 1: Add suggestion logic**

Add a helper function in `Detections.tsx`:

```typescript
function getQualitySuggestions(detection: Detection, score: DetectionQualityScore | undefined): string[] {
  if (!score || score.grade === 'A') return [];
  const suggestions: string[] = [];
  if (score.components.tests < 10) suggestions.push('No test results recorded — run an Atomic Red Team test and log the outcome.');
  if (score.components.fp_rate === 0) suggestions.push('False positive rate is "high" — investigate tuning opportunities to reduce noise.');
  if (score.components.severity < 15) suggestions.push('Severity is low — review whether this detection warrants a higher severity level.');
  if (score.components.confidence < 15) suggestions.push('Confidence is low — add rule logic to improve precision.');
  if (score.components.uniqueness === 0) suggestions.push('This technique is covered by many detections — check for redundancy or consolidate.');
  if (!detection.last_reviewed_at) suggestions.push('Detection has never been reviewed — stamp a review date to keep quality scores current.');
  return suggestions;
}
```

- [ ] **Step 2: Show suggestions in the detection detail modal**

In the detection modal (where `DetectionQualityScore` is already shown), add below the grade display:

```tsx
{(() => {
  const score = qualityScores.get(selectedDetection?.id ?? 0);
  const suggestions = getQualitySuggestions(selectedDetection!, score);
  if (suggestions.length === 0) return null;
  return (
    <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-2">Improvement suggestions</div>
      <ul className="space-y-1">
        {suggestions.map((s, i) => (
          <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
            <span className="text-amber-500 mt-0.5 flex-shrink-0">→</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
})()}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Detections.tsx
git commit -m "feat: add quality score improvement suggestions panel"
```

---

### Task 3: Bulk tag assignment

**Files:**
- Modify: `client/src/pages/Detections.tsx`

- [ ] **Step 1: Add bulk tag state and handler**

In `Detections.tsx`, add state:
```tsx
const [bulkTagOpen, setBulkTagOpen] = useState(false);
const [tags, setTags] = useState<Array<{ id: number; name: string; color: string }>>([]);
const [bulkTagSearch, setBulkTagSearch] = useState('');
const [bulkTagging, setBulkTagging] = useState(false);
```

Load tags on mount (alongside existing data loading):
```tsx
api.getTags().then(setTags).catch(() => {});
```

Add handler:
```tsx
async function bulkAssignTag(tagId: number) {
  setBulkTagging(true);
  try {
    await Promise.all(
      Array.from(selectedIds).map(id => api.addEntityTag('detection', String(id), tagId))
    );
    toast(`Tag applied to ${selectedIds.size} detection(s)`);
    setBulkTagOpen(false);
  } catch (e: any) {
    toast(e.message, 'error');
  } finally {
    setBulkTagging(false);
  }
}
```

- [ ] **Step 2: Add tag picker to bulk action bar**

Find the existing bulk action bar in `Detections.tsx` (where bulk status update and delete are shown). Add:

```tsx
{/* Bulk tag button */}
<div className="relative">
  <button
    onClick={() => setBulkTagOpen(v => !v)}
    className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
  >
    Tag ({selectedIds.size})
  </button>
  {bulkTagOpen && (
    <div className="absolute top-8 left-0 z-20 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
      <div className="p-2">
        <input
          autoFocus
          type="text"
          value={bulkTagSearch}
          onChange={e => setBulkTagSearch(e.target.value)}
          placeholder="Search tags…"
          className="w-full text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none"
        />
      </div>
      <div className="max-h-40 overflow-y-auto pb-1">
        {tags
          .filter(t => !bulkTagSearch || t.name.toLowerCase().includes(bulkTagSearch.toLowerCase()))
          .map(t => (
            <button key={t.id} onClick={() => bulkAssignTag(t.id)} disabled={bulkTagging}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-50">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
              <span className="text-xs text-gray-700 dark:text-slate-300">{t.name}</span>
            </button>
          ))}
        {tags.filter(t => !bulkTagSearch || t.name.toLowerCase().includes(bulkTagSearch.toLowerCase())).length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-slate-600">No tags found</div>
        )}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Detections.tsx
git commit -m "feat: add bulk tag assignment to detections multi-select bar"
```

---

### Task 4: ATT&CK Matrix — threat group overlay mode

**Files:**
- Modify: `client/src/pages/AttackMatrix.tsx`

- [ ] **Step 1: Add overlay state**

In `AttackMatrix.tsx`, add state near the existing threat group filter:
```tsx
const [overlayGroupA, setOverlayGroupA] = useState<string>(''); // first group ID
const [overlayGroupB, setOverlayGroupB] = useState<string>(''); // second group ID
const [overlayTechsA, setOverlayTechsA] = useState<Set<string>>(new Set());
const [overlayTechsB, setOverlayTechsB] = useState<Set<string>>(new Set());
const [overlayMode, setOverlayMode] = useState(false);
```

Load overlay group techniques when groups change:
```tsx
useEffect(() => {
  if (!overlayGroupA) { setOverlayTechsA(new Set()); return; }
  api.getThreatGroup(overlayGroupA)
    .then(g => setOverlayTechsA(new Set(g.techniques?.map((t: any) => t.id) ?? [])))
    .catch(() => {});
}, [overlayGroupA]);

useEffect(() => {
  if (!overlayGroupB) { setOverlayTechsB(new Set()); return; }
  api.getThreatGroup(overlayGroupB)
    .then(g => setOverlayTechsB(new Set(g.techniques?.map((t: any) => t.id) ?? [])))
    .catch(() => {});
}, [overlayGroupB]);
```

- [ ] **Step 2: Add overlay controls to the matrix toolbar**

Find the matrix filter bar (where the existing threat group dropdown and status filters are). Add:

```tsx
<button
  onClick={() => setOverlayMode(v => !v)}
  className={`text-xs px-2.5 py-1 rounded border transition-colors ${overlayMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:bg-gray-300 dark:hover:bg-slate-600'}`}
>
  Overlay
</button>

{overlayMode && (
  <div className="flex items-center gap-2">
    <select value={overlayGroupA} onChange={e => setOverlayGroupA(e.target.value)}
      className="text-xs bg-gray-200 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-700 dark:text-slate-300 focus:outline-none">
      <option value="">Group A…</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
    <span className="text-xs text-gray-400 dark:text-slate-500">vs</span>
    <select value={overlayGroupB} onChange={e => setOverlayGroupB(e.target.value)}
      className="text-xs bg-gray-200 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-700 dark:text-slate-300 focus:outline-none">
      <option value="">Group B…</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  </div>
)}
```

- [ ] **Step 3: Apply overlay colors to cells**

In the cell rendering function (where CELL_COLORS is used), add overlay color logic before the existing style:

```tsx
function getCellClass(cell: MatrixCell | SubtechniqueCell, techniqueId: string): string {
  if (overlayMode && (overlayGroupA || overlayGroupB)) {
    const inA = overlayTechsA.has(techniqueId);
    const inB = overlayTechsB.has(techniqueId);
    if (inA && inB) return 'bg-red-500/80 hover:bg-red-500 text-white'; // both groups
    if (inA) return 'bg-orange-500/70 hover:bg-orange-500 text-white';   // group A only
    if (inB) return 'bg-yellow-500/60 hover:bg-yellow-500 text-slate-900'; // group B only
  }
  return CELL_COLORS[cell.status] ?? CELL_COLORS.gap;
}
```

- [ ] **Step 4: Add overlay legend**

Below the existing legend row, add an overlay legend that appears when overlay mode is active:

```tsx
{overlayMode && (overlayGroupA || overlayGroupB) && (
  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-slate-500">
    <span className="font-semibold text-gray-600 dark:text-slate-400">Overlay:</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/80 inline-block" />Both groups</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500/70 inline-block" />{overlayGroupA ? groups.find(g => g.id === overlayGroupA)?.name ?? 'Group A' : 'Group A'}</span>
    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-500/60 inline-block" />{overlayGroupB ? groups.find(g => g.id === overlayGroupB)?.name ?? 'Group B' : 'Group B'}</span>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AttackMatrix.tsx
git commit -m "feat: add threat group overlay mode to ATT&CK Matrix"
```

---

### Task 5: ATT&CK Matrix — filter persistence

**Files:**
- Modify: `client/src/pages/AttackMatrix.tsx`

- [ ] **Step 1: Persist filter state in sessionStorage**

In `AttackMatrix.tsx`, change the filter state initialization to read from sessionStorage:

```tsx
const [filterStatus, setFilterStatus] = useState<string>(
  () => sessionStorage.getItem('matrix_filter_status') ?? ''
);
const [filterGroup, setFilterGroup] = useState<string>(
  () => sessionStorage.getItem('matrix_filter_group') ?? ''
);
const [filterTactic, setFilterTactic] = useState<string>(
  () => sessionStorage.getItem('matrix_filter_tactic') ?? ''
);
```

Add effects that write to sessionStorage when filters change:

```tsx
useEffect(() => { sessionStorage.setItem('matrix_filter_status', filterStatus); }, [filterStatus]);
useEffect(() => { sessionStorage.setItem('matrix_filter_group', filterGroup); }, [filterGroup]);
useEffect(() => { sessionStorage.setItem('matrix_filter_tactic', filterTactic); }, [filterTactic]);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/AttackMatrix.tsx
git commit -m "feat: persist ATT&CK Matrix filter state in sessionStorage"
```

---

### Task 6: Gap Analysis — saved filter presets

**Files:**
- Modify: `client/src/pages/GapAnalysis.tsx`

- [ ] **Step 1: Add preset state and localStorage persistence**

In `GapAnalysis.tsx`, add state:
```tsx
interface FilterPreset { name: string; search: string; filterTactic: string; sortBy: string; orgSector: string; }
const [presets, setPresets] = useState<FilterPreset[]>(
  () => JSON.parse(localStorage.getItem('gap_filter_presets') ?? '[]')
);
const [savePresetOpen, setSavePresetOpen] = useState(false);
const [presetName, setPresetName] = useState('');
```

Add handlers:
```tsx
function savePreset() {
  if (!presetName.trim()) return;
  const newPreset: FilterPreset = { name: presetName.trim(), search, filterTactic, sortBy, orgSector };
  const updated = [...presets.filter(p => p.name !== presetName.trim()), newPreset];
  setPresets(updated);
  localStorage.setItem('gap_filter_presets', JSON.stringify(updated));
  setSavePresetOpen(false);
  setPresetName('');
}

function applyPreset(p: FilterPreset) {
  setSearch(p.search);
  setFilterTactic(p.filterTactic);
  setSortBy(p.sortBy as any);
}

function deletePreset(name: string) {
  const updated = presets.filter(p => p.name !== name);
  setPresets(updated);
  localStorage.setItem('gap_filter_presets', JSON.stringify(updated));
}
```

- [ ] **Step 2: Add preset chips above filter row**

In the gap analysis filter section, above the existing filter inputs, add:

```tsx
{/* Saved presets */}
{presets.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mb-2">
    {presets.map(p => (
      <span key={p.name} className="inline-flex items-center gap-1">
        <button onClick={() => applyPreset(p)}
          className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors">
          {p.name}
        </button>
        <button onClick={() => deletePreset(p.name)} className="text-[10px] text-gray-400 dark:text-slate-600 hover:text-red-400 transition-colors">✕</button>
      </span>
    ))}
  </div>
)}

{/* Save preset button */}
<div className="flex items-center gap-2 mt-2">
  {savePresetOpen ? (
    <>
      <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setSavePresetOpen(false); }}
        placeholder="Preset name…" autoFocus
        className="text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-gray-800 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 w-40" />
      <button onClick={savePreset} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">Save</button>
      <button onClick={() => setSavePresetOpen(false)} className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">Cancel</button>
    </>
  ) : (
    <button onClick={() => setSavePresetOpen(true)}
      className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
      + Save filter preset
    </button>
  )}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/GapAnalysis.tsx
git commit -m "feat: add saved filter presets to Gap Analysis page"
```

---

### Task 7: Gap Analysis — column visibility toggle

**Files:**
- Modify: `client/src/pages/GapAnalysis.tsx`

- [ ] **Step 1: Add column visibility state**

```tsx
type GapColumn = 'tactics' | 'd3fend' | 'mitigations' | 'threat_groups' | 'data_sources';

const [visibleColumns, setVisibleColumns] = useState<Set<GapColumn>>(
  () => new Set(JSON.parse(localStorage.getItem('gap_visible_columns') ?? '["tactics","d3fend","mitigations","threat_groups","data_sources"]'))
);
const [columnPickerOpen, setColumnPickerOpen] = useState(false);

const ALL_COLUMNS: Array<{ id: GapColumn; label: string }> = [
  { id: 'tactics', label: 'Tactics' },
  { id: 'd3fend', label: 'D3FEND' },
  { id: 'mitigations', label: 'Mitigations' },
  { id: 'threat_groups', label: 'Threat Groups' },
  { id: 'data_sources', label: 'Data Sources' },
];

function toggleColumn(col: GapColumn) {
  setVisibleColumns(prev => {
    const next = new Set(prev);
    if (next.has(col)) next.delete(col); else next.add(col);
    localStorage.setItem('gap_visible_columns', JSON.stringify([...next]));
    return next;
  });
}
```

- [ ] **Step 2: Add column picker icon to filter bar**

In the filter section, add a gear button:

```tsx
<div className="relative ml-auto">
  <button onClick={() => setColumnPickerOpen(v => !v)}
    className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors rounded"
    title="Column visibility"
  >
    ⚙
  </button>
  {columnPickerOpen && (
    <div className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl p-2 space-y-1">
      {ALL_COLUMNS.map(col => (
        <label key={col.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
          <input type="checkbox" checked={visibleColumns.has(col.id)} onChange={() => toggleColumn(col.id)}
            className="rounded border-gray-300 dark:border-slate-600 text-blue-500 focus:ring-0" />
          <span className="text-xs text-gray-700 dark:text-slate-300">{col.label}</span>
        </label>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Gate column rendering**

In the expanded gap row details, gate each section with `visibleColumns.has(...)`:

```tsx
{visibleColumns.has('d3fend') && g.recommended_d3fend.length > 0 && (
  <div>…D3FEND section…</div>
)}
{visibleColumns.has('mitigations') && g.recommended_mitigations.length > 0 && (
  <div>…Mitigations section…</div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/GapAnalysis.tsx
git commit -m "feat: add column visibility toggle to Gap Analysis"
```

---

### Task 8: Dashboard — risk score widget

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`
- Modify: `client/src/api.ts`
- Modify: `client/src/types.ts`

- [ ] **Step 1: Ensure RiskScore type is in types.ts**

The `RiskScore` type should already exist. Verify it has `overall`, `components`, and `tactic_scores`. If not, add:
```typescript
export interface RiskScore {
  overall: number;
  components: { coverage_gap: number; exposed_groups: number; high_overlap: number };
  tactic_scores?: Array<{ tactic_id: string; tactic_name: string; score: number }>;
}
```

- [ ] **Step 2: Load risk score on Dashboard**

In `Dashboard.tsx`, add state:
```tsx
const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
```

In the `load` function, add `api.getRiskScore()` to the Promise.all:
```tsx
Promise.all([
  api.getCoverageStats(),
  api.getSnapshots().catch(() => []),
  api.getCoverageAttribution({ limit: 20 }).catch(() => ({ rows: [], total: 0 })),
  api.getRiskScore().catch(() => null),
]).then(([data, snaps, attr, risk]) => {
  setStats(data);
  setSnapshots(snaps);
  setAttribution(attr.rows);
  setRiskScore(risk);
  // ...
});
```

- [ ] **Step 3: Add risk score widget to dashboard**

Add as a new KPI card in the grid (or a standalone card after the tactic stats). Add to the `kpis` array:

```tsx
{
  label: 'Risk Score',
  value: riskScore ? `${riskScore.overall}` : '—',
  sub: riskScore ? (riskScore.overall >= 70 ? 'Critical exposure' : riskScore.overall >= 45 ? 'High exposure' : riskScore.overall >= 20 ? 'Medium exposure' : 'Low exposure') : 'Loading…',
  gradient: riskScore && riskScore.overall >= 70 ? 'from-red-400 to-orange-400' : riskScore && riskScore.overall >= 45 ? 'from-orange-400 to-yellow-400' : 'from-yellow-400 to-lime-400',
  bg: riskScore && riskScore.overall >= 70 ? 'border-red-500/20 bg-red-500/5' : 'border-orange-500/20 bg-orange-500/5',
  glow: riskScore && riskScore.overall >= 70 ? 'rgba(239,68,68,0.18)' : 'rgba(249,115,22,0.18)',
  delta: null, deltaUnit: '',
},
```

Or as a standalone card below the KPI grid:

```tsx
{riskScore && (
  <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4">
    <h2 className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-slate-500 mb-3">Risk Score</h2>
    <div className="flex items-center gap-6">
      {/* Gauge */}
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="30" fill="none" stroke={theme === 'dark' ? '#1e293b' : '#e2e8f0'} strokeWidth="8" />
          <circle cx="40" cy="40" r="30" fill="none"
            stroke={riskScore.overall >= 70 ? '#ef4444' : riskScore.overall >= 45 ? '#f97316' : riskScore.overall >= 20 ? '#eab308' : '#10b981'}
            strokeWidth="8" strokeDasharray={`${(riskScore.overall / 100) * 188} 188`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center rotate-0">
          <span className="text-xl font-bold text-gray-800 dark:text-slate-200">{riskScore.overall}</span>
        </div>
      </div>
      {/* Component breakdown */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-slate-400">Coverage gap</span>
          <span className="font-mono text-gray-700 dark:text-slate-300">{riskScore.components.coverage_gap}/40</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-slate-400">Exposed groups</span>
          <span className="font-mono text-gray-700 dark:text-slate-300">{riskScore.components.exposed_groups}/40</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-slate-400">High overlap</span>
          <span className="font-mono text-gray-700 dark:text-slate-300">{riskScore.components.high_overlap}/20</span>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Dashboard.tsx client/src/types.ts
git commit -m "feat: add risk score widget to Dashboard"
```

---

### Task 9: Configurable dashboard widget order

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add draggable widget order state**

Install no new libraries — use HTML5 drag-and-drop directly. Add state:
```tsx
type WidgetId = 'kpis' | 'tactic_bars' | 'detection_status' | 'radar' | 'tactic_chart' | 'trend' | 'lowest_tactics' | 'attribution' | 'risk';
const DEFAULT_ORDER: WidgetId[] = ['kpis', 'tactic_bars', 'detection_status', 'radar', 'tactic_chart', 'trend', 'risk', 'lowest_tactics', 'attribution'];

const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(
  () => JSON.parse(localStorage.getItem('dashboard_widget_order') ?? JSON.stringify(DEFAULT_ORDER))
);
const [draggedWidget, setDraggedWidget] = useState<WidgetId | null>(null);
const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetId>>(
  () => new Set(JSON.parse(localStorage.getItem('dashboard_hidden_widgets') ?? '[]'))
);
```

- [ ] **Step 2: Wrap each widget in a draggable container**

Each widget card gets wrapped in a draggable div. Add a small drag handle (grip icon) to each card header:

```tsx
function DraggableWidget({ id, children }: { id: WidgetId; children: React.ReactNode }) {
  return (
    <div
      draggable
      onDragStart={() => setDraggedWidget(id)}
      onDragEnd={() => setDraggedWidget(null)}
      onDragOver={e => e.preventDefault()}
      onDrop={() => {
        if (!draggedWidget || draggedWidget === id) return;
        const newOrder = [...widgetOrder];
        const fromIdx = newOrder.indexOf(draggedWidget);
        const toIdx = newOrder.indexOf(id);
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggedWidget);
        setWidgetOrder(newOrder);
        localStorage.setItem('dashboard_widget_order', JSON.stringify(newOrder));
      }}
      className={`${draggedWidget === id ? 'opacity-50' : ''}`}
    >
      {children}
    </div>
  );
}
```

Render widgets in `widgetOrder` order, filtering out hidden ones, wrapping each in `<DraggableWidget id={id}>`.

- [ ] **Step 3: Add "Reset layout" button**

In the dashboard page header:
```tsx
<button onClick={() => {
  setWidgetOrder(DEFAULT_ORDER);
  setHiddenWidgets(new Set());
  localStorage.removeItem('dashboard_widget_order');
  localStorage.removeItem('dashboard_hidden_widgets');
}} className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
  Reset layout
</button>
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Dashboard.tsx
git commit -m "feat: add configurable drag-to-reorder dashboard widget layout"
```

---

### Task 10: Table density toggle

**Files:**
- Modify: `client/src/context/ThemeContext.tsx`
- Modify: `client/src/index.css`
- Modify: `client/src/components/Sidebar.tsx`

- [ ] **Step 1: Add density to ThemeContext**

In `ThemeContext.tsx`, extend the context:
```typescript
type Density = 'compact' | 'comfortable' | 'spacious';

interface ThemeContextValue {
  theme: 'dark' | 'light';
  toggle: () => void;
  density: Density;
  setDensity: (d: Density) => void;
}
```

Add density state inside the provider:
```tsx
const [density, setDensity] = useState<Density>(
  () => (localStorage.getItem('table_density') as Density) ?? 'comfortable'
);

useEffect(() => {
  document.documentElement.setAttribute('data-density', density);
  localStorage.setItem('table_density', density);
}, [density]);
```

Expose `density` and `setDensity` through context.

- [ ] **Step 2: Add density CSS to index.css**

```css
/* Density variants — applied via data-density attribute on <html> */
[data-density="compact"] .table-row {
  @apply py-1;
}
[data-density="compact"] .table-row td {
  @apply py-1 text-xs;
}
[data-density="comfortable"] .table-row td {
  @apply py-2 text-xs;
}
[data-density="spacious"] .table-row td {
  @apply py-3 text-sm;
}
```

Add `table-row` class to `<tr>` elements in the major data tables (Detections, GapAnalysis, ThreatGroups, etc.).

- [ ] **Step 3: Add density picker to sidebar user menu**

In `Sidebar.tsx`, add:
```tsx
const { density, setDensity } = useTheme();

// In the bottom section, below the theme toggle:
<div className="flex items-center gap-1 mt-1">
  {(['compact', 'comfortable', 'spacious'] as const).map(d => (
    <button key={d} onClick={() => setDensity(d)}
      className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${density === d ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-400'}`}>
      {d === 'compact' ? 'S' : d === 'comfortable' ? 'M' : 'L'}
    </button>
  ))}
  <span className="text-[9px] text-gray-400 dark:text-slate-600 ml-1">density</span>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/context/ThemeContext.tsx client/src/index.css client/src/components/Sidebar.tsx
git commit -m "feat: add table density toggle (compact/comfortable/spacious)"
```

---

### Task 11: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify inline detection editing**

Navigate to `/detections`. Click the status cell on any row — a select dropdown should appear. Change it and verify the row updates without a page reload.

- [ ] **Step 3: Verify matrix overlay mode**

Navigate to `/matrix`. Click "Overlay". Select two different threat groups. Cells belonging to both groups should turn red; group A only orange; group B only yellow.

- [ ] **Step 4: Verify density toggle**

Use the S/M/L density buttons in the sidebar. Table row heights should change across all pages.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Section 5 — UX Polish & Workflow Continuity"
```
