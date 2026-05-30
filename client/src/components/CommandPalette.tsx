import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api';

interface SearchResult {
  type: 'detection' | 'technique' | 'threat_group' | 'exercise' | 'tool';
  id: string | number;
  name: string;
  href: string;
  subtitle?: string;
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  detection: 'Detection',
  technique: 'Technique',
  threat_group: 'Threat Group',
  exercise: 'Exercise',
  tool: 'Tool',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  detection: 'bg-blue-500/10 text-blue-400',
  technique: 'bg-purple-500/10 text-purple-400',
  threat_group: 'bg-red-500/10 text-red-400',
  exercise: 'bg-orange-500/10 text-orange-400',
  tool: 'bg-emerald-500/10 text-emerald-400',
};

let _cache: SearchResult[] | null = null;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadCache = useCallback(async () => {
    if (_cache) return _cache;
    setLoading(true);
    try {
      const [detections, techniques, groups, exercises, tools] = await Promise.all([
        api.getDetections().catch(() => []),
        api.getTechniques(undefined, true).catch(() => []),
        api.getThreatGroups().catch(() => []),
        api.getExercises().catch(() => []),
        api.getTools().catch(() => []),
      ]);
      _cache = [
        ...detections.map((d: any) => ({
          type: 'detection' as const, id: d.id, name: d.name,
          href: `/detections`, subtitle: d.source ?? d.status,
        })),
        ...techniques.map((t: any) => ({
          type: 'technique' as const, id: t.id, name: t.name,
          href: `/matrix?technique=${t.id}`, subtitle: t.id,
        })),
        ...groups.map((g: any) => ({
          type: 'threat_group' as const, id: g.id, name: g.name,
          href: `/threats`, subtitle: g.country ?? undefined,
        })),
        ...exercises.map((e: any) => ({
          type: 'exercise' as const, id: e.id, name: e.name,
          href: `/exercises`, subtitle: e.status,
        })),
        ...tools.map((t: any) => ({
          type: 'tool' as const, id: t.id, name: t.name,
          href: `/tools`, subtitle: t.vendor ?? undefined,
        })),
      ];
      return _cache;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    loadCache();
  }, [open, loadCache]);

  useEffect(() => {
    if (!query.trim() || !_cache) { setResults([]); return; }
    const q = query.toLowerCase();
    const matches = _cache.filter(r =>
      r.name.toLowerCase().includes(q) ||
      String(r.id).toLowerCase().includes(q) ||
      r.subtitle?.toLowerCase().includes(q)
    ).slice(0, 12);
    setResults(matches);
    setHighlighted(0);
  }, [query]);

  const navigateTo = (href: string) => {
    navigate(href);
    setOpen(false);
    setQuery('');
    _cache = null;
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && results[highlighted]) navigateTo(results[highlighted].href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm"
      onClick={() => { setOpen(false); setQuery(''); }}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-800">
          <Search size={16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search detections, techniques, threat groups…"
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none"
          />
          <kbd className="text-[10px] text-gray-400 dark:text-slate-600 border border-gray-200 dark:border-slate-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {loading && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-slate-600">Loading…</div>
        )}

        {!loading && query && results.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-slate-600">No results for "{query}"</div>
        )}

        {!loading && results.length > 0 && (
          <div className="max-h-72 overflow-y-auto py-1">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => navigateTo(r.href)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === highlighted ? 'bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
              >
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLORS[r.type]}`}>
                  {TYPE_LABELS[r.type]}
                </span>
                <span className="flex-1 text-sm text-gray-800 dark:text-slate-200 truncate">{r.name}</span>
                {r.subtitle && <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">{r.subtitle}</span>}
              </button>
            ))}
          </div>
        )}

        {!query && (
          <div className="px-4 py-4 text-xs text-gray-400 dark:text-slate-600">
            Search across detections, techniques, threat groups, exercises, and tools.
          </div>
        )}
      </div>
    </div>
  );
}
