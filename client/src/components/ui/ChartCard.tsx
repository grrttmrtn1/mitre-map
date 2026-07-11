import type { ReactNode } from 'react';

export default function ChartCard({ title, description, actions, summary, children, className = '' }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`chart-${title.replace(/\W+/g, '-').toLowerCase()}`} className={`rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 id={`chart-${title.replace(/\W+/g, '-').toLowerCase()}`} className="text-sm font-semibold text-gray-700 dark:text-slate-200">{title}</h2>{description && <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{description}</p>}</div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
      {summary && <div className="sr-only">{summary}</div>}
    </section>
  );
}
