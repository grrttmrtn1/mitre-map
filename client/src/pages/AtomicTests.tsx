import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ArtTest } from '../types';

const PLATFORM_COLORS: Record<string, string> = {
  windows: 'bg-blue-500/20 text-blue-300',
  linux: 'bg-orange-500/20 text-orange-300',
  macos: 'bg-purple-500/20 text-purple-300',
};

const PLATFORM_ACTIVE_COLORS: Record<string, string> = {
  windows: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  linux: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
  macos: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
};

const PLATFORMS = ['windows', 'linux', 'macos', 'iaas:aws', 'iaas:gcp', 'iaas:azure', 'containers', 'network', 'office-365', 'saas'];
const EXECUTOR_TYPES = ['powershell', 'bash', 'sh', 'command_prompt', 'python', 'ruby', 'manual'];

interface CustomTestForm {
  technique_id: string;
  name: string;
  description: string;
  platform: string;
  executor_type: string;
  command: string;
}

const emptyForm = (): CustomTestForm => ({
  technique_id: '',
  name: '',
  description: '',
  platform: '',
  executor_type: '',
  command: '',
});

function PlatformFilterBar({ selected, onChange }: { selected: string[]; onChange: (p: string[]) => void }) {
  function toggle(p: string) {
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p]);
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-500 flex-shrink-0 mr-0.5">Platform:</span>
      {PLATFORMS.map(p => {
        const active = selected.includes(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              active
                ? (PLATFORM_ACTIVE_COLORS[p] ?? 'bg-blue-600/30 border-blue-500 text-blue-300')
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {p}
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function PlatformBadges({ platform }: { platform: string }) {
  const parts = platform.split(',').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className="flex gap-1.5 flex-wrap">
      {parts.map(p => (
        <span key={p} className={`text-xs px-2 py-0.5 rounded ${PLATFORM_COLORS[p.toLowerCase()] ?? 'bg-slate-800 text-slate-400'}`}>{p}</span>
      ))}
    </div>
  );
}

function AtomicTab({ tests, loading }: { tests: ArtTest[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [yamlInput, setYamlInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [allTests, setAllTests] = useState<ArtTest[]>(tests);

  useEffect(() => { setAllTests(tests); }, [tests]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.syncArtTests();
      setSyncResult(result);
      if (result.imported > 0) setAllTests(await api.getArtTests().then(ts => ts.filter(t => t.source !== 'custom')));
    } catch {
      setSyncResult({ imported: 0, skipped: 0, total: 0 });
    } finally {
      setSyncing(false);
    }
  }

  const platformFiltered = platformFilter.length === 0
    ? allTests
    : allTests.filter(t => {
        const testPlatforms = t.platform.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
        return platformFilter.some(p => testPlatforms.includes(p));
      });

  const grouped = platformFiltered.reduce<Record<string, ArtTest[]>>((acc, t) => {
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
      if (result.imported > 0) setAllTests(await api.getArtTests().then(ts => ts.filter(t => t.source === 'atomic')));
    } catch {
      setImportResult({ imported: 0, skipped: 0, total: 0 });
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-400">
              {loading ? 'Loading…' : `${allTests.length} tests across ${Object.keys(grouped).length} techniques`}
            </p>
            {syncResult && (
              <p className="text-xs mt-1 text-slate-500">
                Synced: <span className="text-emerald-400 font-medium">{syncResult.imported}</span> new,{' '}
                <span className="text-slate-500">{syncResult.skipped}</span> already present
                {' '}({syncResult.total} in index)
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Fetch the full Atomic Red Team test suite from GitHub"
              className="px-3 py-1.5 text-sm bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Syncing…' : 'Sync from GitHub'}
            </button>
            <button
              onClick={() => setShowImport(v => !v)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Import YAML
            </button>
          </div>
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
        <div className="mb-3">
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            placeholder="Search by technique ID or test name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <PlatformFilterBar selected={platformFilter} onChange={setPlatformFilter} />
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
                      {techniqueName && <span className="text-slate-300 text-sm truncate">{techniqueName}</span>}
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
                              <PlatformBadges platform={test.platform} />
                              {test.executor_type && (
                                <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">{test.executor_type}</span>
                              )}
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
    </>
  );
}

function CustomTestModal({
  initialValues,
  onSave,
  onCancel,
  saving,
}: {
  initialValues: CustomTestForm;
  onSave: (form: CustomTestForm) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CustomTestForm>(initialValues);
  const set = (k: keyof CustomTestForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            {initialValues.name ? 'Edit Custom Test' : 'New Custom Test'}
          </h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Technique ID <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 font-mono"
              placeholder="e.g. T1059.001"
              value={form.technique_id}
              onChange={e => set('technique_id', e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Test Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Name of the test"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Description</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-y"
              rows={3}
              placeholder="What does this test simulate?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Platform(s)</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => {
                  const selected = form.platform.split(',').map(x => x.trim()).includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        const parts = form.platform.split(',').map(x => x.trim()).filter(Boolean);
                        const next = selected ? parts.filter(x => x !== p) : [...parts, p];
                        set('platform', next.join(', '));
                      }}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${selected ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Executor Type</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.executor_type}
                onChange={e => set('executor_type', e.target.value)}
              >
                <option value="">— none —</option>
                {EXECUTOR_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Command / Steps</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              rows={5}
              placeholder="Commands or manual steps to execute…"
              value={form.command}
              onChange={e => set('command', e.target.value)}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.technique_id.trim() || !form.name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomTab({ tests, loading, onRefresh }: { tests: ArtTest[]; loading: boolean; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ArtTest | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const platformFiltered = platformFilter.length === 0
    ? tests
    : tests.filter(t => {
        const testPlatforms = (t.platform ?? '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
        return platformFilter.some(p => testPlatforms.includes(p));
      });

  const filtered = platformFiltered.filter(t =>
    !search ||
    t.technique_id.toLowerCase().includes(search.toLowerCase()) ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, ArtTest[]>>((acc, t) => {
    const base = t.technique_id.split('.')[0];
    if (!acc[base]) acc[base] = [];
    acc[base].push(t);
    return acc;
  }, {});

  function openCreate() { setEditTarget(null); setShowModal(true); }
  function openEdit(t: ArtTest) { setEditTarget(t); setShowModal(true); }

  async function handleSave(form: CustomTestForm) {
    setSaving(true);
    try {
      if (editTarget) {
        await api.updateCustomTest(editTarget.id, {
          name: form.name,
          description: form.description || undefined,
          platform: form.platform || undefined,
          executor_type: form.executor_type || undefined,
          command: form.command || undefined,
        });
      } else {
        await api.createCustomTest({
          technique_id: form.technique_id,
          name: form.name,
          description: form.description || undefined,
          platform: form.platform || undefined,
          executor_type: form.executor_type || undefined,
          command: form.command || undefined,
        });
      }
      setShowModal(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await api.deleteCustomTest(id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  const initialForm = editTarget
    ? {
        technique_id: editTarget.technique_id,
        name: editTarget.name,
        description: editTarget.description ?? '',
        platform: editTarget.platform ?? '',
        executor_type: editTarget.executor_type ?? '',
        command: editTarget.auto_generated_command ?? '',
      }
    : emptyForm();

  return (
    <>
      {showModal && (
        <CustomTestModal
          initialValues={initialForm}
          onSave={handleSave}
          onCancel={() => setShowModal(false)}
          saving={saving}
        />
      )}

      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {loading ? 'Loading…' : `${tests.length} custom test${tests.length !== 1 ? 's' : ''}`}
          </p>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
          >
            + New Test
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            placeholder="Search by technique ID or test name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <PlatformFilterBar selected={platformFilter} onChange={setPlatformFilter} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">Loading…</div>
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-3">
            <p>No custom tests yet.</p>
            <button onClick={openCreate} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              Create your first custom test →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(grouped).map(([techniqueId, techniqueTests]) => {
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
                      {techniqueName && <span className="text-slate-300 text-sm truncate">{techniqueName}</span>}
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
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-100 text-sm">{test.name}</span>
                                <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">custom</span>
                              </div>
                              <div className="text-slate-500 text-xs font-mono mt-0.5">{test.technique_id}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex gap-1.5 flex-wrap justify-end">
                                <PlatformBadges platform={test.platform ?? ''} />
                                {test.executor_type && (
                                  <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded">{test.executor_type}</span>
                                )}
                              </div>
                              <button
                                onClick={() => openEdit(test)}
                                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(test.id)}
                                disabled={deleting === test.id}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
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
            {Object.keys(grouped).length === 0 && (
              <div className="text-center text-slate-500 py-12">No tests match your search</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function AtomicTests() {
  const [tests, setTests] = useState<ArtTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'atomic' | 'custom'>('atomic');

  async function loadTests() {
    setLoading(true);
    try {
      setTests(await api.getArtTests());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTests(); }, []);

  const atomicTests = tests.filter(t => t.source !== 'custom');
  const customTests = tests.filter(t => t.source === 'custom');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 pt-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-slate-100">Red Team Tests</h1>
        </div>
        <div className="flex gap-0.5">
          {(['atomic', 'custom'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                tab === t
                  ? 'text-slate-100 border-blue-500 bg-slate-800/50'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              {t === 'atomic' ? 'Atomic Red Team' : 'Custom'}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-500'}`}>
                {t === 'atomic' ? atomicTests.length : customTests.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'atomic' ? (
        <AtomicTab tests={atomicTests} loading={loading} />
      ) : (
        <CustomTab tests={customTests} loading={loading} onRefresh={loadTests} />
      )}
    </div>
  );
}
