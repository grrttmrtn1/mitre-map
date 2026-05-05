import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Comment } from '../types';

interface Props {
  entityType: string;
  entityId: string | number;
}

export default function CommentThread({ entityType, entityId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('analyst');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const load = () => api.getComments(entityType, entityId).then(setComments);
  useEffect(() => { load(); }, [entityType, entityId]);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.createComment(entityType, entityId, text.trim(), author);
      setText('');
      load();
    } finally { setSaving(false); }
  };

  const saveEdit = async (id: number) => {
    if (!editText.trim()) return;
    await api.updateComment(id, editText.trim());
    setEditId(null);
    load();
  };

  const del = async (id: number) => {
    if (!confirm('Delete comment?')) return;
    await api.deleteComment(id);
    load();
  };

  return (
    <div className="space-y-3">
      {comments.length === 0 && (
        <div className="text-xs text-slate-500 italic py-2">No comments yet.</div>
      )}
      {comments.map(c => (
        <div key={c.id} className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 flex-shrink-0 mt-0.5">
            {c.author[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-slate-300">{c.author}</span>
              <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
              {c.updated_at !== c.created_at && <span className="text-xs text-slate-600">(edited)</span>}
            </div>
            {editId === c.id ? (
              <div className="mt-1 flex gap-2">
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                  className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 resize-none focus:outline-none focus:border-blue-500" />
                <div className="flex flex-col gap-1">
                  <button onClick={() => saveEdit(c.id)} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap">{c.body}</p>
            )}
            <div className="flex gap-3 mt-1">
              <button onClick={() => { setEditId(c.id); setEditText(c.body); }} className="text-xs text-slate-600 hover:text-slate-400">Edit</button>
              <button onClick={() => del(c.id)} className="text-xs text-slate-600 hover:text-red-400">Delete</button>
            </div>
          </div>
        </div>
      ))}

      <div className="pt-3 border-t border-slate-800">
        <div className="flex gap-2 mb-2">
          <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author"
            className="w-28 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment..." rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
            className="flex-1 px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500" />
          <button onClick={submit} disabled={saving || !text.trim()}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 self-end">
            {saving ? '...' : 'Post'}
          </button>
        </div>
        <div className="text-xs text-slate-600 mt-1">Ctrl+Enter to submit</div>
      </div>
    </div>
  );
}
