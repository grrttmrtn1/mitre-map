import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ArtTest } from '../types';

const STATUS_COLORS: Record<string, string> = {
  validated: 'bg-green-500/20 text-green-400 border border-green-500/40',
  tested: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/40',
  untested: 'bg-slate-700 text-slate-400 border border-slate-600',
};

const PLATFORM_COLORS: Record<string, string> = {
  windows: 'bg-blue-500/20 text-blue-300',
  linux: 'bg-orange-500/20 text-orange-300',
  macos: 'bg-purple-500/20 text-purple-300',
};

export default function AtomicTests() {
  const [tests, setTests] = useState<ArtTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [yamlInput, setYamlInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  useEffect(() => {
    api.getArtTests().then(setTests).finally(() => setLoading(false));
  }, []);

  const grouped = tests.reduce<Record<string, ArtTest[]>>((acc, t) => {
    const base = t.technique_id.split('.')[0];
    if (!acc[base]) acc[base] = [];
    acc[base].push(t);
    return acc;
  }, {});

  const filteredGroups = Object.entries(grouped).filter(([tid, ts]) =>
    !search || tid.toLowerCase().includes(search.toLowerCase()) ||
    ts.some(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleImport() {
    if (!yamlInput.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.importArtYaml(yamlInput);
      setImportResult(result);
      if (result.imported > 0) setTests(await api.getArtTests());
    } catch {
      setImportResult({ imported: 0, skipped: 0, total: 0 });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Atomic Red Team Tests</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {loading ? 'Loading…' : `${tests.length} tests across ${Object.keys(grouped).length} techniques`}
            </p>
          </div>
          <button
            onClick={() => setShowImport(v => !v)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            Import YAML
          </button>
        </div>

        {showImport && (
          <div className="mt-4 bg-slate-800 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-1">Import Atomic Red Team YAML</h3>
            <p className="text-xs text-slate-500 mb-3">Paste YAML from the AtomicRedTeam GitHub repository (atomics/*.yaml files).</p>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              rows={8}
              placeholder="Paste YAML here…"
              value={yamlInput}
              onChange={e => setYamlInput(e.target.value)}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleImport}
                disabled={importing || !yamlInput.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {importing ? 'Importing…' : 'Import'}
              </button>
              <button onClick={() => { setShowImport(false); setYamlInput(''); setImportResult(null); }}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Cancel
              </button>
              {importResult && (
                <span className="text-sm text-slate-400">
                  Imported <span className="text-emerald-400 font-medium">{importResult.imported}</span>,
                  skipped <span className="text-slate-500">{importResult.skipped}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4">
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            placeholder="Search by technique ID or test name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">Loading…</div>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map(([techniqueId, techniqueTests]) => {
              const isExpanded = expanded === techniqueId;
              const techniqueName = techniqueTests[0]?.technique_name;
              return (
                <div key={techniqueId} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors text-left"
                    onClick={() => setExpanded(isExpanded ? null : techniqueId)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-blue-400 font-semibold flex-shrink-0">{techniqueId}</span>
                      {techniqueName && (
                        <span className="text-slate-300 text-sm truncate">{techniqueName}</span>
                      )}
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-1">
                        {techniqueTests.length} test{techniqueTests.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800/50">
                      {techniqueTests.map(test => (
                        <div key={test.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-100 text-sm">{test.name}</div>
                              <div className="text-slate-500 text-xs font-mono mt-0.5">{test.technique_id} · {test.test_guid}</div>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                              {test.platform.split(',').map(p => p.trim()).filter(Boolean).map(p => (
                                <span key={p} className={`text-xs px-2 py-0.5 rounded ${PLATFORM_COLORS[p.toLowerCase()] ?? 'bg-slate-800 text-slate-400'}`}>{p}</span>
                              ))}
                              <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">{test.executor_type}</span>
                            </div>
                          </div>
                          {test.description && <p className="text-slate-400 text-xs mb-3 leading-relaxed">{test.description}</p>}
                          {test.auto_generated_command && (
                            <pre className="bg-slate-950 text-emerald-400 text-xs font-mono rounded-lg p-3 overflow-x-auto whitespace-pre-wrap border border-slate-800">{test.auto_generated_command}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredGroups.length === 0 && !loading && (
              <div className="text-center text-slate-500 py-12">No tests match your search</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
