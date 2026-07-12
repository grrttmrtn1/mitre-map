import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function KpiCard({ label, value, detail, trend, className = '', valueClassName = '', icon: Icon, accent, featured = false }: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  trend?: ReactNode;
  className?: string;
  valueClassName?: string;
  icon?: LucideIcon;
  accent?: string;
  featured?: boolean;
}) {
  return (
    <section aria-label={label} className={`group relative overflow-hidden p-5 ${featured ? 'surface-featured' : 'surface-card-interactive'} ${className}`}>
      <div aria-hidden="true" className={`absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent ?? 'from-blue-500/15 to-cyan-400/5'} blur-2xl transition-transform duration-500 group-hover:scale-125`} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="data-label">{label}</div>
        {Icon && <div className="rounded-lg border border-current/10 bg-current/5 p-2 text-blue-500 dark:text-cyan-400"><Icon size={17} /></div>}
      </div>
      <div className="relative mt-2 flex items-end gap-2">
        <div className={`font-mono text-3xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
        {trend && <div className="mb-1">{trend}</div>}
      </div>
      {detail && <div className="relative mt-1.5 text-xs text-gray-500 dark:text-slate-400">{detail}</div>}
      <div aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-blue-500 to-cyan-400 transition-transform duration-300 group-hover:scale-x-100" />
    </section>
  );
}
