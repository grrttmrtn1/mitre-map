import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { SigmaLibraryItem, SigmaRuleDetail, SigmaTemplate, Technique } from '../types';

type Tab = 'library' | 'templates';

const LEVEL_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  informational: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

// ── Community Rules (SigmaHQ) tab ─────────────────────────────────────────────

function LibraryTab() {
  const [techInput, setTechInput] = useState('');
  const [results, setResults] = useState<SigmaLibraryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SigmaLibraryItem | null>(null);
  const [ruleDetail, setRuleDetail] = useState<SigmaRuleDetail | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function search() {
    const id = techInput.trim().toUpperCase();
    if (!id.match(/^T\d{4}(\.\d{3})?$/)) {
      setSearchError('Enter a valid ATT&CK technique ID, e.g. T1059 or T1059.001');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setResults([]);
    setSelectedItem(null);
    setRuleDetail(null);
    setChecked(new Set());
    setImportMsg(null);
    try {
      const r = await api.searchSigmaLibrary(id);
      setResults(r.items);
      setTotalCount(r.total_count);
      setRateLimitRemaining(r.rate_limit_remaining);
    } catch (e: any) {
      const msg = e.message ?? 'Unknown error';
      setSearchError(
        msg.includes('401') || msg.includes('token required') || msg.includes('GitHub token')
          ? 'GitHub token required. Go to Settings → Integrations to configure a Personal Access Token.'
          : msg.includes('429') || msg.includes('rate limit')
            ? 'GitHub API rate limit reached. Wait ~60 seconds and try again.'
            : msg
      );
    } finally {
      setSearching(false);
    }
  }

  async function selectRule(item: SigmaLibraryItem) {
    setSelectedItem(item);
    setRuleDetail(null);
    setRuleLoading(true);
    try {
      const d = await api.getSigmaRule(item.raw_url);
      setRuleDetail(d);
    } catch {
      setRuleDetail(null);
    } finally {
      setRuleLoading(false);
    }
  }

  function toggleCheck(raw_url: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(raw_url) ? next.delete(raw_url) : next.add(raw_url);
      return next;
    });
  }

  async function importSelected() {
    const toImport = results.filter(r => checked.has(r.raw_url));
    if (!toImport.length) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const ruleTexts: string[] = [];
      for (const item of toImport) {
        const d = await api.getSigmaRule(item.raw_url);
        ruleTexts.push(d.raw);
      }
      const result = await api.importSigmaRules(ruleTexts, 'sigma');
      setImportMsg(`Imported ${result.imported} detection${result.imported !== 1 ? 's' : ''}${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.`);
      setChecked(new Set());
    } catch (e: any) {
      setImportMsg(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-900/30">
        <div className="flex gap-2 items-center">
          <input
            value={techInput}
            onChange={e => setTechInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="ATT&CK technique ID, e.g. T1059.001"
            className="flex-1 max-w-xs px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button onClick={search} disabled={searching}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {searching ? 'Searching…' : 'Search SigmaHQ'}
          </button>
          {rateLimitRemaining !== null && (
            <span className={`text-xs ${rateLimitRemaining < 3 ? 'text-orange-400' : 'text-slate-500'}`}>
              {rateLimitRemaining} GitHub API calls remaining
            </span>
          )}
        </div>
        {searchError && <div className="mt-2 text-xs text-red-400">{searchError}</div>}
        {results.length > 0 && (
          <div className="mt-1 text-xs text-slate-500">
            Showing {results.length} of {totalCount} matching rules from SigmaHQ
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Results list */}
        <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col">
          {results.length === 0 && !searching && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 px-4 text-center">
              <div className="text-3xl mb-2">σ</div>
              <div className="text-sm font-medium text-slate-400 mb-1">SigmaHQ Community Rules</div>
              <div className="text-xs">Search by ATT&CK technique to browse community detection rules from SigmaHQ.</div>
            </div>
          )}
          {searching && (
            <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Searching GitHub…</div>
          )}
          {results.length > 0 && (
            <div className="flex-1 overflow-y-auto py-1">
              {results.map(item => (
                <div
                  key={item.raw_url}
                  onClick={() => selectRule(item)}
                  className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 ${selectedItem?.raw_url === item.raw_url ? 'bg-slate-800' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(item.raw_url)}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleCheck(item.raw_url)}
                    className="mt-0.5 flex-shrink-0 accent-blue-500"
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-slate-200 font-medium leading-tight truncate">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{item.category}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rule preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedItem && (
            <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">
              Select a rule to preview
            </div>
          )}
          {selectedItem && ruleLoading && (
            <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Loading rule…</div>
          )}
          {selectedItem && !ruleLoading && ruleDetail && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-slate-100">{ruleDetail.parsed.title ?? selectedItem.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ruleDetail.parsed.level && (
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${LEVEL_COLORS[ruleDetail.parsed.level] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                        {ruleDetail.parsed.level}
                      </span>
                    )}
                    {ruleDetail.parsed.status && (
                      <span className="px-2 py-0.5 rounded border text-xs bg-slate-700 text-slate-400 border-slate-600">{ruleDetail.parsed.status}</span>
                    )}
                    {ruleDetail.parsed.technique_ids.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30">{id}</span>
                    ))}
                  </div>
                </div>
                <a href={selectedItem.html_url} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex-shrink-0">
                  View on GitHub ↗
                </a>
              </div>

              {ruleDetail.parsed.description && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1">Description</div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{ruleDetail.parsed.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {ruleDetail.parsed.logsource && Object.keys(ruleDetail.parsed.logsource).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">Log Source</div>
                    <div className="space-y-0.5">
                      {Object.entries(ruleDetail.parsed.logsource).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="text-slate-500">{k}: </span>
                          <span className="text-slate-300">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1">Metadata</div>
                  <div className="space-y-0.5 text-xs">
                    {ruleDetail.parsed.author && <div><span className="text-slate-500">author: </span><span className="text-slate-300">{ruleDetail.parsed.author}</span></div>}
                    {ruleDetail.parsed.date && <div><span className="text-slate-500">date: </span><span className="text-slate-300">{ruleDetail.parsed.date}</span></div>}
                    {ruleDetail.parsed.id && <div><span className="text-slate-500">id: </span><span className="font-mono text-slate-400">{ruleDetail.parsed.id}</span></div>}
                  </div>
                </div>
              </div>

              {ruleDetail.parsed.detection_raw && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1">Detection Logic</div>
                  <pre className="text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-x-auto leading-relaxed">
                    {ruleDetail.parsed.detection_raw}
                  </pre>
                </div>
              )}

              {ruleDetail.parsed.falsepositives && ruleDetail.parsed.falsepositives.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1">False Positives</div>
                  <ul className="text-xs text-slate-400 space-y-0.5">
                    {ruleDetail.parsed.falsepositives.map((fp, i) => <li key={i}>• {fp}</li>)}
                  </ul>
                </div>
              )}

              {ruleDetail.parsed.references && ruleDetail.parsed.references.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1">References</div>
                  <ul className="text-xs space-y-0.5">
                    {ruleDetail.parsed.references.map((r, i) => (
                      <li key={i}><a href={r} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{r}</a></li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1">Full Rule YAML</div>
                <pre className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-x-auto leading-relaxed">
                  {ruleDetail.raw}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import bar */}
      {results.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{checked.size} selected</span>
            {importMsg && (
              <span className={`text-xs ${importMsg.startsWith('Import failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                {importMsg}
              </span>
            )}
          </div>
          <button
            onClick={importSelected}
            disabled={checked.size === 0 || importing}
            className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {importing ? 'Importing…' : `Import Selected (${checked.size})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Detection Templates tab ───────────────────────────────────────────────────

function TemplatesTab() {
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [filterTactic, setFilterTactic] = useState('');
  const [search, setSearch] = useState('');
  const [tacticNames, setTacticNames] = useState<string[]>([]);
  const [selectedTech, setSelectedTech] = useState<Technique | null>(null);
  const [template, setTemplate] = useState<SigmaTemplate | null>(null);
  const [editedYaml, setEditedYaml] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loadedTemplates, setLoadedTemplates] = useState<Map<string, string>>(new Map());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getTechniques(undefined, false).then(techs => {
      setTechniques(techs);
      // Extract unique tactic display names from tactic_ids
      api.getTactics().then(tactics => {
        setTacticNames(tactics.map(t => t.name));
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const [allTactics, setAllTactics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api.getTactics().then(setAllTactics).catch(() => {});
  }, []);

  const filtered = techniques
    .filter(t => {
      if (t.is_subtechnique) return false;
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (!filterTactic) return true;
      const tac = allTactics.find(a => a.name === filterTactic);
      return tac ? t.tactic_ids.includes(tac.id) : true;
    });

  async function selectTechnique(tech: Technique) {
    setSelectedTech(tech);
    setTemplate(null);
    setEditedYaml('');
    setImportMsg(null);
    setTemplateLoading(true);
    try {
      const t = await api.getSigmaTemplate(tech.id);
      setTemplate(t);
      const existing = loadedTemplates.get(tech.id);
      setEditedYaml(existing ?? t.yaml);
    } catch {
      setTemplate(null);
    } finally {
      setTemplateLoading(false);
    }
  }

  function toggleCheck(techId: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(techId) ? next.delete(techId) : next.add(techId);
      return next;
    });
  }

  function saveEdit() {
    if (!selectedTech) return;
    setLoadedTemplates(prev => new Map(prev).set(selectedTech.id, editedYaml));
  }

  async function importSelected() {
    if (checked.size === 0) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const yamls: string[] = [];
      for (const techId of checked) {
        const saved = loadedTemplates.get(techId);
        if (saved) {
          yamls.push(saved);
        } else {
          const t = await api.getSigmaTemplate(techId);
          yamls.push(t.yaml);
        }
      }
      const result = await api.importSigmaRules(yamls, 'template', 'planned');
      setImportMsg(`Created ${result.imported} detection${result.imported !== 1 ? 's' : ''} with status "planned"${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.`);
      setChecked(new Set());
    } catch (e: any) {
      setImportMsg(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-900/30 flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search techniques…"
          className="flex-1 max-w-xs px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={filterTactic}
          onChange={e => setFilterTactic(e.target.value)}
          className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Tactics</option>
          {allTactics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
        <span className="text-xs text-slate-500 self-center">{filtered.length} techniques</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Technique list */}
        <div className="w-72 flex-shrink-0 border-r border-slate-800 overflow-y-auto">
          {filtered.map(tech => (
            <div
              key={tech.id}
              onClick={() => selectTechnique(tech)}
              className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 ${selectedTech?.id === tech.id ? 'bg-slate-800' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked.has(tech.id)}
                onClick={e => e.stopPropagation()}
                onChange={() => toggleCheck(tech.id)}
                className="flex-shrink-0 accent-blue-500"
              />
              <div className="min-w-0">
                <div className="text-xs text-slate-200 font-medium leading-tight truncate">{tech.name}</div>
                <div className="text-xs text-slate-500 font-mono">{tech.id}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Template preview / editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedTech && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 px-4 text-center">
              <div className="text-3xl mb-2">⊞</div>
              <div className="text-sm font-medium text-slate-400 mb-1">Detection Templates</div>
              <div className="text-xs max-w-xs">
                Select a technique to generate a pre-filled detection starter. Templates import as "planned" — finish the logic before activating.
              </div>
            </div>
          )}
          {selectedTech && templateLoading && (
            <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Generating template…</div>
          )}
          {selectedTech && !templateLoading && template && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{template.technique_name} <span className="font-mono text-slate-400 font-normal text-xs">({template.technique_id})</span></div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${LEVEL_COLORS[template.level] ?? 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                      {template.level}
                    </span>
                    {template.logsource.category && (
                      <span className="text-xs text-slate-500">
                        logsource: {template.logsource.category}{template.logsource.product ? `/${template.logsource.product}` : ''}
                      </span>
                    )}
                    {template.tactic_names.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">{t}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={saveEdit}
                  title="Save edits to this template (used when importing)"
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  Save edits
                </button>
              </div>
              {template.data_sources.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2 border-b border-slate-800 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Detected data sources:</span>
                  {template.data_sources.map(ds => (
                    <span key={ds} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">{ds}</span>
                  ))}
                </div>
              )}
              <textarea
                value={editedYaml}
                onChange={e => setEditedYaml(e.target.value)}
                spellCheck={false}
                className="flex-1 resize-none font-mono text-xs text-slate-300 bg-slate-900 border-0 p-4 focus:outline-none leading-relaxed"
                placeholder="Template YAML will appear here..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Import bar */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{checked.size} selected</span>
          <span className="text-xs text-slate-500">Templates import as "planned" status — add your detection logic before activating.</span>
          {importMsg && (
            <span className={`text-xs ${importMsg.startsWith('Import failed') ? 'text-red-400' : 'text-emerald-400'}`}>
              {importMsg}
            </span>
          )}
        </div>
        <button
          onClick={importSelected}
          disabled={checked.size === 0 || importing}
          className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {importing ? 'Importing…' : `Import ${checked.size} Template${checked.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function SigmaLibrary() {
  const [tab, setTab] = useState<Tab>('library');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 relative">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div>
          <h1 className="text-xl font-semibold text-slate-100">SIGMA Rule Library</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Browse community rules from SigmaHQ and generate per-technique detection templates. Nothing is imported until you click "Import".
          </p>
        </div>
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setTab('library')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${tab === 'library' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            Community Rules (SigmaHQ)
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${tab === 'templates' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
            Detection Templates
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {tab === 'library' ? <LibraryTab /> : <TemplatesTab />}
      </div>
    </div>
  );
}
