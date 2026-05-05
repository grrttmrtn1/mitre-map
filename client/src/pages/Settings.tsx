import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Tag, AuditLogEntry } from '../types';

export default function Settings() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [riskScore, setRiskScore] = useState<any>(null);
  const [riskByTactic, setRiskByTactic] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'tags' | 'risk' | 'audit'>('tags');

  const [tagForm, setTagForm] = useState({ name: '', color: '#6366f1', description: '' });
  const [editTagId, setEditTagId] = useState<number | null>(null);
  const [savingTag, setSavingTag] = useState(false);

  const loadTags = () => api.getTags().then(setTags);
  const loadAudit = () => api.getAuditLog({ limit: 100 }).then(r => { setAuditRows(r.rows); setAuditTotal(r.total); });
  const loadRisk = () => Promise.all([api.getRiskScore(), api.getRiskByTactic()]).then(([s, t]) => { setRiskScore(s); setRiskByTactic(t); });

  useEffect(() => { loadTags(); loadAudit(); loadRisk(); }, []);

  const saveTag = async () => {
    if (!tagForm.name.trim()) return;
    setSavingTag(true);
    try {
      if (editTagId !== null) {
        await api.updateTag(editTagId, tagForm);
      } else {
        await api.createTag(tagForm);
      }
      setTagForm({ name: '', color: '#6366f1', description: '' });
      setEditTagId(null);
      loadTags();
    } finally { setSavingTag(false); }
  };

  const deleteTag = async (id: number) => {
    if (!confirm('Delete this tag? It will be removed from all entities.')) return;
    await api.deleteTag(id);
    loadTags();
  };

  const startEdit = (tag: Tag) => {
    setEditTagId(tag.id);
    setTagForm({ name: tag.name, color: tag.color, description: tag.description ?? '' });
  };

  const TABS = [
    { id: 'tags', label: 'Tag Management' },
    { id: 'risk', label: 'Risk Dashboard' },
    { id: 'audit', label: 'Audit Log' },
  ] as const;

  const riskLevelColor: Record<string, string> = {
    critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-emerald-400',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <h1 className="text-xl font-semibold text-slate-100">Settings &amp; Administration</h1>
        <div className="flex gap-1 mt-4">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTab === tab.id ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'tags' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">{editTagId !== null ? 'Edit Tag' : 'Create Tag'}</h2>
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Name</label>
                  <input value={tagForm.name} onChange={e => setTagForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. critical-asset"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={tagForm.color} onChange={e => setTagForm(f => ({ ...f, color: e.target.value }))}
                      className="w-9 h-9 rounded border border-slate-700 bg-slate-800 cursor-pointer" />
                    <input value={tagForm.color} onChange={e => setTagForm(f => ({ ...f, color: e.target.value }))}
                      className="w-24 px-2 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Description</label>
                  <input value={tagForm.description} onChange={e => setTagForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  {editTagId !== null && (
                    <button onClick={() => { setEditTagId(null); setTagForm({ name: '', color: '#6366f1', description: '' }); }}
                      className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
                  )}
                  <button onClick={saveTag} disabled={savingTag || !tagForm.name.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50">
                    {savingTag ? '...' : editTagId !== null ? 'Save' : 'Create'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-slate-200 flex-1">{tag.name}</span>
                  {tag.description && <span className="text-xs text-slate-500 flex-1 truncate">{tag.description}</span>}
                  <span className="font-mono text-xs" style={{ color: tag.color }}>{tag.color}</span>
                  <button onClick={() => startEdit(tag)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Edit</button>
                  <button onClick={() => deleteTag(tag.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Delete</button>
                </div>
              ))}
              {tags.length === 0 && <div className="text-sm text-slate-500 text-center py-8">No tags yet. Create one above.</div>}
            </div>
          </div>
        )}

        {activeTab === 'risk' && riskScore && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Overall Risk Score</div>
                  <div className={`text-5xl font-bold ${riskLevelColor[riskScore.level]}`}>{riskScore.score}</div>
                  <div className="text-xs text-slate-500 mt-1">out of 100</div>
                </div>
                <span className={`text-sm px-3 py-1.5 rounded-lg border font-semibold ${
                  riskScore.level === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                  riskScore.level === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/30' :
                  riskScore.level === 'medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' :
                  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                }`}>{riskScore.level.toUpperCase()}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
                <div>
                  <div className="text-slate-500 mb-0.5">Coverage Gap</div>
                  <div className="text-red-400 font-mono font-semibold">{riskScore.components.coverage_gap_pct}%</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Exposed Threat Groups</div>
                  <div className="text-orange-400 font-mono font-semibold">{riskScore.components.exposed_threat_groups}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Critical Gaps (3+ groups)</div>
                  <div className="text-red-400 font-mono font-semibold">{riskScore.components.critical_gaps}</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-3">Risk by Tactic</h2>
              <div className="space-y-2">
                {riskByTactic.map((t: any) => (
                  <div key={t.tactic_id} className="flex items-center gap-3">
                    <div className="text-xs text-slate-400 w-36 truncate flex-shrink-0">{t.tactic_name}</div>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        t.risk_level === 'critical' ? 'bg-red-500' :
                        t.risk_level === 'high' ? 'bg-orange-500' :
                        t.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`} style={{ width: `${t.risk_score}%` }} />
                    </div>
                    <div className={`text-xs font-mono w-8 text-right ${riskLevelColor[t.risk_level]}`}>{t.risk_score}</div>
                    <div className="text-xs text-slate-600 w-16 text-right">{t.coverage_pct}% cov.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Last 100 events of {auditTotal} total</div>
            </div>
            <div className="space-y-1">
              {auditRows.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                  <div className="text-xs text-slate-600 w-36 flex-shrink-0 pt-0.5">
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-400">{entry.entity_type}</span>
                      <span className="text-xs text-slate-500">#{entry.entity_id}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        entry.action.includes('delete') ? 'bg-red-500/10 text-red-400' :
                        entry.action.includes('create') || entry.action.includes('import') ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>{entry.action}</span>
                      <span className="text-xs text-slate-600">by {entry.actor}</span>
                    </div>
                    {entry.changes && (
                      <div className="text-xs text-slate-600 mt-0.5 font-mono truncate">
                        {JSON.stringify(entry.changes)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {auditRows.length === 0 && <div className="text-sm text-slate-500 text-center py-8">No audit events yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
