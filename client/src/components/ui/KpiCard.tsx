import type { ReactNode } from 'react';

export default function KpiCard({ label, value, detail, trend, className = '', valueClassName = '' }: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  trend?: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <section aria-label={label} className={`relative overflow-hidden rounded-xl border p-4 ${className}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-end gap-2">
        <div className={`text-3xl font-bold ${valueClassName}`}>{value}</div>
        {trend && <div className="mb-1">{trend}</div>}
      </div>
      {detail && <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">{detail}</div>}
    </section>
  );
}
