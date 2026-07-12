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
    <section aria-labelledby={`chart-${title.replace(/\W+/g, '-').toLowerCase()}`} className={`surface-card group p-5 transition-colors hover:border-blue-400/25 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 id={`chart-${title.replace(/\W+/g, '-').toLowerCase()}`} className="text-base font-semibold tracking-tight text-gray-800 dark:text-slate-100">{title}</h2>{description && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{description}</p>}</div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
      {summary && <div className="sr-only">{summary}</div>}
    </section>
  );
}
