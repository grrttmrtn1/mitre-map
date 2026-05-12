import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import type {
  Exercise, ExerciseDetail, ExerciseFinding, ExerciseReport,
  ExerciseTestRun, ExerciseTechnique, ThreatGroup, FindingSeverity, FindingType,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  red_team: 'Red Team', purple_team: 'Purple Team', tabletop: 'Tabletop',
};
const TYPE_COLORS: Record<string, string> = {
  red_team: 'bg-red-500/15 text-red-400 border-red-500/30',
  purple_team: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  tabletop: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};
const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-slate-700 text-slate-300',
  active: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-red-500/20 text-red-400',
};
const OUTCOME_COLORS: Record<string, string> = {
  pending: 'bg-slate-800 text-slate-400 border-slate-700',
  detected: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  not_detected: 'bg-red-500/20 text-red-400 border-red-500/30',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  blocked: 'bg-slate-700 text-slate-400 border-slate-600',
  n_a: 'bg-slate-800/50 text-slate-600 border-slate-800',
};
const OUTCOME_LABELS: Record<string, string> = {
  pending: 'Pending', detected: 'Detected', not_detected: 'Not Detected',
  partial: 'Partial', blocked: 'Blocked', n_a: 'N/A',
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600/20 text-red-400 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  informational: 'bg-slate-700 text-slate-400 border-slate-600',
};
const FINDING_TYPE_LABELS: Record<string, string> = {
  gap: 'Detection Gap', detection_validated: 'Detection Validated',
  detection_failed: 'Detection Failed', control_weakness: 'Control Weakness', new_ttp: 'New TTP',
};

// ── Small components ──────────────────────────────────────────────────────────

function Badge({ text, className }: { text: string; className: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>{text}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  return <Badge text={severity} className={SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.informational} />;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  return <Badge text={OUTCOME_LABELS[outcome] ?? outcome} className={OUTCOME_COLORS[outcome] ?? OUTCOME_COLORS.pending} />;
}

function DetectionRateBar({ rate }: { rate: number }) {
  const color = rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{rate}%</span>
    </div>
  );
}

// ── Exercise List Modal (Create/Edit) ─────────────────────────────────────────

interface ExerciseFormData {
  name: string; description: string; type: string; status: string;
  threat_group_id: string; scope_notes: string; start_date: string;
  end_date: string; lead: string;
}

function emptyForm(): ExerciseFormData {
  return {
    name: '', description: '', type: 'purple_team', status: 'planning',
    threat_group_id: '', scope_notes: '', start_date: '', end_date: '', lead: '',
  };
}

function ExerciseFormModal({
  initial, threatGroups, onSave, onCancel, saving,
}: {
  initial: ExerciseFormData;
  threatGroups: ThreatGroup[];
  onSave: (data: ExerciseFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ExerciseFormData>(initial);
  const set = (k: keyof ExerciseFormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            {initial.name ? 'Edit Exercise' : 'New Exercise'}
          </h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Exercise Name <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g. Q2 Purple Team – Lazarus Group"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Type</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.type}
                onChange={e => set('type', e.target.value)}
              >
                <option value="purple_team">Purple Team</option>
                <option value="red_team">Red Team</option>
                <option value="tabletop">Tabletop</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Status</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Target Threat Group</label>
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              value={form.threat_group_id}
              onChange={e => set('threat_group_id', e.target.value)}
            >
              <option value="">— None —</option>
              {threatGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {!initial.name && form.threat_group_id && (
              <p className="text-xs text-blue-400 mt-1">Techniques will be auto-populated from this group.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Lead / Operator</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Name or team"
              value={form.lead}
              onChange={e => set('lead', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Start Date</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.start_date}
                onChange={e => set('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">End Date</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.end_date}
                onChange={e => set('end_date', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Description</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-y"
              rows={2}
              placeholder="Exercise objectives and context"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Scope Notes</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-y"
              rows={2}
              placeholder="In-scope systems, exclusions, rules of engagement"
              value={form.scope_notes}
              onChange={e => set('scope_notes', e.target.value)}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Exercise'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan Tab ──────────────────────────────────────────────────────────────────

function PlanTab({
  exercise, threatGroups, onRefresh,
}: {
  exercise: ExerciseDetail;
  threatGroups: ThreatGroup[];
  onRefresh: () => void;
}) {
  const [addTid, setAddTid] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const tid = addTid.trim().toUpperCase();
    if (!tid) return;
    setAdding(true);
    try {
      await api.addExerciseTechniques(exercise.id, [tid]);
      setAddTid('');
      onRefresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(tid: string) {
    setRemoving(tid);
    try {
      await api.removeExerciseTechnique(exercise.id, tid);
      onRefresh();
    } finally {
      setRemoving(null);
    }
  }

  const tg = threatGroups.find(g => g.id === exercise.threat_group_id);

  return (
    <div className="p-6 space-y-6">
      {/* Meta */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          {exercise.description && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Description</div>
              <p className="text-sm text-slate-300">{exercise.description}</p>
            </div>
          )}
          {exercise.scope_notes && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Scope / Rules of Engagement</div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{exercise.scope_notes}</p>
            </div>
          )}
          {tg && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Target Threat Group</div>
              <span className="text-sm text-slate-200 font-medium">{tg.name}</span>
              {tg.aliases?.length > 0 && (
                <span className="text-xs text-slate-500 ml-2">({tg.aliases.join(', ')})</span>
              )}
            </div>
          )}
        </div>
        <div className="space-y-3 text-sm">
          {exercise.lead && (
            <div className="flex justify-between">
              <span className="text-slate-500">Lead</span>
              <span className="text-slate-200">{exercise.lead}</span>
            </div>
          )}
          {exercise.start_date && (
            <div className="flex justify-between">
              <span className="text-slate-500">Start</span>
              <span className="text-slate-200">{exercise.start_date}</span>
            </div>
          )}
          {exercise.end_date && (
            <div className="flex justify-between">
              <span className="text-slate-500">End</span>
              <span className="text-slate-200">{exercise.end_date}</span>
            </div>
          )}
        </div>
      </div>

      {/* Technique scope */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Techniques in Scope
            <span className="ml-2 text-xs text-slate-500 font-normal">{exercise.techniques.length} selected</span>
          </h3>
          <div className="flex gap-2">
            <input
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500 w-32"
              placeholder="T1059.001"
              value={addTid}
              onChange={e => setAddTid(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !addTid.trim()}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {exercise.techniques.length === 0 ? (
          <div className="text-center text-slate-500 py-10 text-sm">
            No techniques in scope. Add them manually or select a threat group when creating the exercise.
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_2fr_auto] text-xs text-slate-500 px-4 py-2 border-b border-slate-800">
              <span>Technique ID</span>
              <span>Name</span>
              <span>Tests Available</span>
            </div>
            <div className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
              {exercise.techniques.map(t => (
                <div key={t.technique_id} className="grid grid-cols-[1fr_2fr_auto] items-center px-4 py-2.5 group hover:bg-slate-900/50">
                  <span className="font-mono text-blue-400 text-xs">{t.technique_id}</span>
                  <span className="text-slate-300 text-sm truncate">{t.technique_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{t.available_tests} test{t.available_tests !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => handleRemove(t.technique_id)}
                      disabled={removing === t.technique_id}
                      className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all disabled:opacity-50 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Execute Tab ───────────────────────────────────────────────────────────────

interface ArtTestRow {
  id: number;
  technique_id: string;
  name: string;
  description: string | null;
  platform: string | null;
  executor_type: string | null;
  auto_generated_command: string | null;
}

function ExecuteTab({
  exercise, onRefresh,
}: {
  exercise: ExerciseDetail;
  onRefresh: () => void;
}) {
  const [techTests, setTechTests] = useState<Record<string, ArtTestRow[]>>({});
  const [loadingTests, setLoadingTests] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [noteEditing, setNoteEditing] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState('');

  useEffect(() => {
    async function load() {
      setLoadingTests(true);
      try {
        const byTech: Record<string, ArtTestRow[]> = {};
        await Promise.all(exercise.techniques.map(async (t: ExerciseTechnique) => {
          const tests = await api.getArtTestsForTechnique(t.technique_id);
          byTech[t.technique_id] = tests as unknown as ArtTestRow[];
        }));
        setTechTests(byTech);
      } finally {
        setLoadingTests(false);
      }
    }
    load();
  }, [exercise.techniques]);

  const runsByTestId = new Map<number, ExerciseTestRun>();
  for (const r of exercise.test_runs) runsByTestId.set(r.art_test_id, r);

  async function handleOutcome(testId: number, outcome: string) {
    setUpdating(testId);
    try {
      const existing = runsByTestId.get(testId);
      if (existing) {
        await api.updateExerciseTestRun(exercise.id, existing.id, { outcome });
      } else {
        await api.addExerciseTestRun(exercise.id, { art_test_id: testId, outcome });
      }
      onRefresh();
    } finally {
      setUpdating(null);
    }
  }

  async function handleNoteSave(testId: number) {
    const existing = runsByTestId.get(testId);
    if (existing) {
      await api.updateExerciseTestRun(exercise.id, existing.id, { notes: noteValue });
    } else {
      await api.addExerciseTestRun(exercise.id, { art_test_id: testId, notes: noteValue });
    }
    setNoteEditing(null);
    onRefresh();
  }

  const outcomes: ExerciseTestRun['outcome'][] = ['detected', 'partial', 'not_detected', 'blocked', 'n_a'];

  if (exercise.techniques.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Add techniques in the Plan tab first.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-2">
      {loadingTests && (
        <div className="text-center text-slate-500 py-10">Loading tests…</div>
      )}
      {!loadingTests && exercise.techniques.map(tech => {
        const tests = techTests[tech.technique_id] ?? [];
        const isExpanded = expanded === tech.technique_id;
        const techRuns = exercise.test_runs.filter(r => r.technique_id?.split('.')[0] === tech.technique_id.split('.')[0]);
        const detected = techRuns.filter(r => r.outcome === 'detected').length;
        const total = techRuns.filter(r => r.outcome !== 'pending').length;

        return (
          <div key={tech.technique_id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors text-left"
              onClick={() => setExpanded(isExpanded ? null : tech.technique_id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-blue-400 font-semibold text-sm flex-shrink-0">{tech.technique_id}</span>
                <span className="text-slate-300 text-sm truncate">{tech.technique_name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {total > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${detected === total ? 'bg-emerald-500/20 text-emerald-300' : detected > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-400'}`}>
                    {detected}/{total} detected
                  </span>
                )}
                <span className="text-xs text-slate-500">{tests.length} test{tests.length !== 1 ? 's' : ''}</span>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-800 divide-y divide-slate-800/50">
                {tests.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-slate-500">No ART tests available for this technique.</div>
                ) : tests.map(test => {
                  const run = runsByTestId.get(test.id);
                  const outcome = run?.outcome ?? 'pending';
                  const isUpdating = updating === test.id;

                  return (
                    <div key={test.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-100">{test.name}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {test.platform && (
                              <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{test.platform}</span>
                            )}
                            {test.executor_type && (
                              <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{test.executor_type}</span>
                            )}
                          </div>
                          {test.description && (
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{test.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          {outcomes.map(o => (
                            <button
                              key={o}
                              disabled={isUpdating}
                              onClick={() => handleOutcome(test.id, o)}
                              className={`text-xs px-2.5 py-1 rounded border transition-all ${
                                outcome === o
                                  ? OUTCOME_COLORS[o]
                                  : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                              } disabled:opacity-50`}
                            >
                              {OUTCOME_LABELS[o]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      {noteEditing === test.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                            value={noteValue}
                            onChange={e => setNoteValue(e.target.value)}
                            placeholder="Add note…"
                            onKeyDown={e => e.key === 'Enter' && handleNoteSave(test.id)}
                            autoFocus
                          />
                          <button onClick={() => handleNoteSave(test.id)} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                          <button onClick={() => setNoteEditing(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                        </div>
                      ) : (
                        <div
                          className="mt-1.5 cursor-pointer"
                          onClick={() => { setNoteEditing(test.id); setNoteValue(run?.notes ?? ''); }}
                        >
                          {run?.notes ? (
                            <p className="text-xs text-slate-400 hover:text-slate-300 transition-colors">{run.notes}</p>
                          ) : (
                            <p className="text-xs text-slate-700 hover:text-slate-500 transition-colors">+ add note</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Findings Tab ──────────────────────────────────────────────────────────────

interface FindingFormData {
  title: string;
  technique_id: string;
  finding_type: FindingType;
  severity: FindingSeverity;
  description: string;
  recommendation: string;
}

function emptyFinding(): FindingFormData {
  return { title: '', technique_id: '', finding_type: 'gap', severity: 'medium', description: '', recommendation: '' };
}

function FindingModal({
  initial, onSave, onCancel, saving, techniques,
}: {
  initial: FindingFormData;
  onSave: (data: FindingFormData) => void;
  onCancel: () => void;
  saving: boolean;
  techniques: ExerciseTechnique[];
}) {
  const [form, setForm] = useState<FindingFormData>(initial);
  const set = <K extends keyof FindingFormData>(k: K, v: FindingFormData[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            {initial.title ? 'Edit Finding' : 'Add Finding'}
          </h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Title <span className="text-red-400">*</span></label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              placeholder="e.g. PowerShell execution undetected"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Finding Type</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.finding_type}
                onChange={e => set('finding_type', e.target.value as FindingType)}
              >
                {Object.entries(FINDING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Severity</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
                value={form.severity}
                onChange={e => set('severity', e.target.value as FindingSeverity)}
              >
                {['critical', 'high', 'medium', 'low', 'informational'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Related Technique</label>
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              value={form.technique_id}
              onChange={e => set('technique_id', e.target.value)}
            >
              <option value="">— None —</option>
              {techniques.map(t => <option key={t.technique_id} value={t.technique_id}>{t.technique_id} – {t.technique_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Description</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-y"
              rows={3}
              placeholder="What was observed?"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Recommendation</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 resize-y"
              rows={3}
              placeholder="How should this be remediated?"
              value={form.recommendation}
              onChange={e => set('recommendation', e.target.value)}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Finding'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FindingsTab({ exercise, onRefresh }: { exercise: ExerciseDetail; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ExerciseFinding | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleSave(form: FindingFormData) {
    setSaving(true);
    try {
      if (editTarget) {
        await api.updateExerciseFinding(exercise.id, editTarget.id, {
          title: form.title,
          technique_id: form.technique_id || undefined,
          finding_type: form.finding_type,
          severity: form.severity,
          description: form.description || undefined,
          recommendation: form.recommendation || undefined,
        });
      } else {
        await api.addExerciseFinding(exercise.id, {
          title: form.title,
          technique_id: form.technique_id || undefined,
          finding_type: form.finding_type,
          severity: form.severity,
          description: form.description || undefined,
          recommendation: form.recommendation || undefined,
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
      await api.deleteExerciseFinding(exercise.id, id);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  const initialForm = editTarget ? {
    title: editTarget.title,
    technique_id: editTarget.technique_id ?? '',
    finding_type: editTarget.finding_type,
    severity: editTarget.severity,
    description: editTarget.description ?? '',
    recommendation: editTarget.recommendation ?? '',
  } : emptyFinding();

  return (
    <>
      {showModal && (
        <FindingModal
          initial={initialForm}
          onSave={handleSave}
          onCancel={() => setShowModal(false)}
          saving={saving}
          techniques={exercise.techniques}
        />
      )}

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Findings
            <span className="ml-2 text-xs text-slate-500 font-normal">{exercise.findings.length} total</span>
          </h3>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            + Add Finding
          </button>
        </div>

        {exercise.findings.length === 0 ? (
          <div className="text-center text-slate-500 py-16 text-sm">
            No findings yet. Add findings as you execute the exercise.
          </div>
        ) : (
          <div className="space-y-3">
            {exercise.findings.map(f => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-100">{f.title}</span>
                      <SeverityBadge severity={f.severity} />
                      <Badge text={FINDING_TYPE_LABELS[f.finding_type] ?? f.finding_type} className="bg-slate-700 text-slate-300 border-slate-600" />
                      {f.technique_id && (
                        <span className="font-mono text-xs text-blue-400">{f.technique_id}</span>
                      )}
                    </div>
                    {f.description && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{f.description}</p>}
                    {f.recommendation && (
                      <div className="mt-2 pl-3 border-l-2 border-blue-500/40">
                        <p className="text-xs text-blue-300/80 leading-relaxed">{f.recommendation}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setEditTarget(f); setShowModal(true); }}
                      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={deleting === f.id}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Report Tab ────────────────────────────────────────────────────────────────

function ReportTab({ exerciseId }: { exerciseId: number }) {
  const [report, setReport] = useState<ExerciseReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getExerciseReport(exerciseId)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [exerciseId]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Generating report…</div>;
  if (!report) return <div className="flex items-center justify-center h-64 text-slate-500">Failed to load report.</div>;

  const { summary, exercise, technique_breakdown, gaps, findings, findings_by_severity } = report;

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-bold text-slate-100">{exercise.name}</h2>
          <Badge text={TYPE_LABELS[exercise.type] ?? exercise.type} className={TYPE_COLORS[exercise.type] ?? ''} />
        </div>
        <div className="flex gap-4 text-sm text-slate-500 flex-wrap">
          {exercise.threat_group_name && <span>Target: <span className="text-slate-300">{exercise.threat_group_name}</span></span>}
          {exercise.lead && <span>Lead: <span className="text-slate-300">{exercise.lead}</span></span>}
          {exercise.start_date && <span>Period: <span className="text-slate-300">{exercise.start_date}{exercise.end_date ? ` – ${exercise.end_date}` : ''}</span></span>}
          <span>Generated: <span className="text-slate-300">{new Date(report.generated_at).toLocaleString()}</span></span>
        </div>
      </div>

      {/* Executive Summary */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Executive Summary</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Detection Rate', value: `${summary.detection_rate}%`, sub: `${summary.detected} of ${summary.total_runs} tests`, accent: summary.detection_rate >= 70 ? 'text-emerald-400' : summary.detection_rate >= 40 ? 'text-amber-400' : 'text-red-400' },
            { label: 'Techniques Scoped', value: String(summary.total_techniques), sub: `${gaps.length} undetected`, accent: 'text-blue-400' },
            { label: 'Tests Executed', value: String(summary.total_runs), sub: `${summary.not_detected} not detected`, accent: 'text-slate-200' },
            { label: 'Findings', value: String(summary.total_findings), sub: `${summary.critical_findings} critical`, accent: summary.critical_findings > 0 ? 'text-red-400' : 'text-slate-200' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className={`text-2xl font-bold ${s.accent} mb-0.5`}>{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="text-xs text-slate-600 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detection rate bar */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Technique Coverage</h3>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_2fr_auto_auto_auto_auto] text-xs text-slate-500 px-4 py-2 border-b border-slate-800 gap-3">
            <span>Technique</span>
            <span>Detection Rate</span>
            <span className="text-center w-16">Tests</span>
            <span className="text-center w-16 text-emerald-500">Detected</span>
            <span className="text-center w-16 text-red-400">Not Det.</span>
            <span className="text-center w-16">Status</span>
          </div>
          <div className="divide-y divide-slate-800/50 max-h-72 overflow-y-auto">
            {technique_breakdown.map(t => {
              const rate = t.total_runs > 0 ? Math.round(((t.detected + t.partial * 0.5) / t.total_runs) * 100) : 0;
              return (
                <div key={t.technique_id} className="grid grid-cols-[1fr_2fr_auto_auto_auto_auto] items-center px-4 py-2.5 gap-3 hover:bg-slate-900/50">
                  <div>
                    <span className="font-mono text-blue-400 text-xs">{t.technique_id}</span>
                    <span className="text-slate-400 text-xs ml-2 truncate">{t.technique_name}</span>
                  </div>
                  <div>
                    {t.total_runs > 0
                      ? <DetectionRateBar rate={rate} />
                      : <span className="text-xs text-slate-600">Untested</span>
                    }
                  </div>
                  <span className="text-xs text-slate-400 text-center w-16">{t.total_runs}</span>
                  <span className="text-xs text-emerald-400 text-center w-16">{t.detected}</span>
                  <span className="text-xs text-red-400 text-center w-16">{t.not_detected}</span>
                  <div className="flex justify-center w-16">
                    <OutcomeBadge outcome={t.status === 'detected' ? 'detected' : t.status === 'partial' ? 'partial' : t.status === 'not_detected' ? 'not_detected' : 'pending'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Findings by severity */}
      {summary.total_findings > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Findings by Severity</h3>
          <div className="flex gap-3 mb-4">
            {findings_by_severity.filter(s => s.count > 0).map(s => (
              <div key={s.severity} className="flex items-center gap-2">
                <Badge text={`${s.count} ${s.severity}`} className={SEVERITY_COLORS[s.severity] ?? ''} />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {findings.map(f => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <SeverityBadge severity={f.severity} />
                  <Badge text={FINDING_TYPE_LABELS[f.finding_type] ?? f.finding_type} className="bg-slate-700 text-slate-300 border-slate-600" />
                  <span className="text-sm font-medium text-slate-100">{f.title}</span>
                  {f.technique_id && <span className="font-mono text-xs text-blue-400">{f.technique_id}</span>}
                </div>
                {f.description && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{f.description}</p>}
                {f.recommendation && (
                  <div className="mt-2 pl-3 border-l-2 border-blue-500/40">
                    <p className="text-xs text-blue-300/80 font-medium mb-0.5">Recommendation</p>
                    <p className="text-xs text-blue-300/70 leading-relaxed">{f.recommendation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detection gaps */}
      {gaps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Detection Gaps <span className="text-red-400 font-normal">({gaps.length})</span>
          </h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-800/50">
              {gaps.map(g => (
                <div key={g.technique_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-blue-400 text-xs w-24 flex-shrink-0">{g.technique_id}</span>
                  <span className="text-sm text-slate-300">{g.technique_name}</span>
                  <span className="ml-auto text-xs text-red-400 flex-shrink-0">Not Detected</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scope notes */}
      {exercise.scope_notes && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Scope / Rules of Engagement</h3>
          <p className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{exercise.scope_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Exercise Detail Panel ─────────────────────────────────────────────────────

type TabKey = 'plan' | 'execute' | 'findings' | 'report';

function ExerciseDetail({
  exercise, threatGroups, onRefresh, onBack,
}: {
  exercise: ExerciseDetail;
  threatGroups: ThreatGroup[];
  onRefresh: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<TabKey>('plan');
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleEditSave(form: ExerciseFormData) {
    setSaving(true);
    try {
      await api.updateExercise(exercise.id, {
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        status: form.status,
        threat_group_id: form.threat_group_id || undefined,
        scope_notes: form.scope_notes || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        lead: form.lead || undefined,
      });
      setShowEdit(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'plan', label: 'Plan', count: exercise.techniques.length },
    { key: 'execute', label: 'Execute', count: exercise.test_runs.length },
    { key: 'findings', label: 'Findings', count: exercise.findings.length },
    { key: 'report', label: 'Report' },
  ];

  const detected = exercise.test_runs.filter(r => r.outcome === 'detected').length;
  const totalRuns = exercise.test_runs.length;
  const rate = totalRuns > 0 ? Math.round((detected / totalRuns) * 100) : 0;

  return (
    <>
      {showEdit && (
        <ExerciseFormModal
          initial={{
            name: exercise.name,
            description: exercise.description ?? '',
            type: exercise.type,
            status: exercise.status,
            threat_group_id: exercise.threat_group_id ?? '',
            scope_notes: exercise.scope_notes ?? '',
            start_date: exercise.start_date ?? '',
            end_date: exercise.end_date ?? '',
            lead: exercise.lead ?? '',
          }}
          threatGroups={threatGroups}
          onSave={handleEditSave}
          onCancel={() => setShowEdit(false)}
          saving={saving}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">← Back</button>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-semibold text-slate-100 truncate">{exercise.name}</h1>
              <Badge text={TYPE_LABELS[exercise.type] ?? exercise.type} className={TYPE_COLORS[exercise.type] ?? ''} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[exercise.status] ?? STATUS_COLORS.planning}`}>
                {exercise.status}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3 flex-shrink-0">
              {totalRuns > 0 && (
                <div className="flex items-center gap-2 w-32">
                  <span className="text-xs text-slate-500">Detection:</span>
                  <div className="flex-1"><DetectionRateBar rate={rate} /></div>
                </div>
              )}
              <button
                onClick={() => setShowEdit(true)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="flex gap-0.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                  tab === t.key
                    ? 'text-slate-100 border-blue-500 bg-slate-800/50'
                    : 'text-slate-400 border-transparent hover:text-slate-300'
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-500'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'plan' && <PlanTab exercise={exercise} threatGroups={threatGroups} onRefresh={onRefresh} />}
          {tab === 'execute' && <ExecuteTab exercise={exercise} onRefresh={onRefresh} />}
          {tab === 'findings' && <FindingsTab exercise={exercise} onRefresh={onRefresh} />}
          {tab === 'report' && <ReportTab exerciseId={exercise.id} />}
        </div>
      </div>
    </>
  );
}

// ── Main Exercises Page ───────────────────────────────────────────────────────

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [threatGroups, setThreatGroups] = useState<ThreatGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ExerciseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function loadList() {
    setLoading(true);
    try {
      setExercises(await api.getExercises());
    } finally {
      setLoading(false);
    }
  }

  const loadDetail = useCallback(async (id: number) => {
    setLoadingDetail(true);
    try {
      setSelected(await api.getExercise(id));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadList();
    api.getThreatGroups().then(setThreatGroups).catch(() => {});
  }, []);

  async function handleCreate(form: ExerciseFormData) {
    setCreating(true);
    try {
      const ex = await api.createExercise({
        name: form.name,
        description: form.description || undefined,
        type: form.type,
        status: form.status,
        threat_group_id: form.threat_group_id || undefined,
        scope_notes: form.scope_notes || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        lead: form.lead || undefined,
      });
      setShowCreate(false);
      await loadList();
      await loadDetail(ex.id);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await api.deleteExercise(id);
      if (selected?.id === id) setSelected(null);
      await loadList();
    } finally {
      setDeleting(null);
    }
  }

  async function handleRefresh() {
    if (selected) await loadDetail(selected.id);
    await loadList();
  }

  if (selected) {
    return (
      <ExerciseDetail
        exercise={selected}
        threatGroups={threatGroups}
        onRefresh={handleRefresh}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <>
      {showCreate && (
        <ExerciseFormModal
          initial={emptyForm()}
          threatGroups={threatGroups}
          onSave={handleCreate}
          onCancel={() => setShowCreate(false)}
          saving={creating}
        />
      )}

      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Red Team / Purple Team Exercises</h1>
              <p className="text-sm text-slate-500 mt-0.5">Plan exercises, execute ART tests, record findings, and generate reports.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
            >
              + New Exercise
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500">Loading…</div>
          ) : exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-4">
              <div className="text-4xl">⚔</div>
              <p className="text-sm">No exercises yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create your first exercise →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {exercises.map(ex => {
                const rate = (ex.test_run_count ?? 0) > 0
                  ? Math.round(((ex.detected_count ?? 0) / (ex.test_run_count ?? 1)) * 100)
                  : 0;

                return (
                  <div
                    key={ex.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors cursor-pointer group"
                    onClick={() => loadDetail(ex.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-100 group-hover:text-white transition-colors">{ex.name}</span>
                            <Badge text={TYPE_LABELS[ex.type] ?? ex.type} className={TYPE_COLORS[ex.type] ?? ''} />
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ex.status] ?? STATUS_COLORS.planning}`}>
                              {ex.status}
                            </span>
                          </div>
                          <div className="flex gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                            {ex.threat_group_name && <span>Target: <span className="text-slate-400">{ex.threat_group_name}</span></span>}
                            {ex.lead && <span>Lead: <span className="text-slate-400">{ex.lead}</span></span>}
                            {ex.start_date && <span>{ex.start_date}{ex.end_date ? ` – ${ex.end_date}` : ''}</span>}
                            <span>{ex.technique_count ?? 0} techniques · {ex.test_run_count ?? 0} tests · {ex.finding_count ?? 0} findings</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {(ex.test_run_count ?? 0) > 0 && (
                          <div className="w-28">
                            <div className="text-xs text-slate-500 mb-1">Detection Rate</div>
                            <DetectionRateBar rate={rate} />
                          </div>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(ex.id); }}
                          disabled={deleting === ex.id}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}

              {loadingDetail && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
                  <div className="text-slate-400 text-sm">Loading exercise…</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
