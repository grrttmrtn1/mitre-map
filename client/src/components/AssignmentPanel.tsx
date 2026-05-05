import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Assignment } from '../types';

interface Props {
  entityType: string;
  entityId: string | number;
}

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix'] as const;

const statusColor: Record<string, string> = {
  open: 'text-red-400 bg-red-500/10 border-red-500/20',
  in_progress: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  resolved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  wont_fix: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const priorityColor: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-slate-400',
};

export default function AssignmentPanel({ entityType, entityId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assignee: '', status: 'open', priority: 'medium', due_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.getEntityAssignments(entityType, entityId).then(setAssignments);
  useEffect(() => { load(); }, [entityType, entityId]);

  const create = async () => {
    if (!form.assignee.trim()) return;
    setSaving(true);
    try {
      await api.createAssignment({ entity_type: entityType, entity_id: String(entityId), ...form } as any);
      setForm({ assignee: '', status: 'open', priority: 'medium', due_date: '', notes: '' });
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    await api.updateAssignment(id, { status } as any);
    load();
  };

  const del = async (id: number) => {
    await api.deleteAssignment(id);
    load();
  };

  return (
    <div className="space-y-2">
      {assignments.map(a => (
        <div key={a.id} className="flex items-start gap-3 p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-200">{a.assignee}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor[a.status]}`}>{a.status.replace('_', ' ')}</span>
              <span className={`text-xs font-medium ${priorityColor[a.priority]}`}>{a.priority}</span>
              {a.due_date && <span className="text-xs text-slate-500">Due: {new Date(a.due_date).toLocaleDateString()}</span>}
            </div>
            {a.notes && <p className="text-xs text-slate-500 mt-0.5">{a.notes}</p>}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none">
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <button onClick={() => del(a.id)} className="text-xs text-slate-600 hover:text-red-400">×</button>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
              placeholder="Assignee name" className="col-span-2 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500" />
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none" />
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)" className="col-span-2 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
            <button onClick={create} disabled={saving || !form.assignee.trim()}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
              {saving ? '...' : 'Assign'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
          + Assign to analyst
        </button>
      )}
    </div>
  );
}
