import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageShell({ children, print = false }: { children: ReactNode; print?: boolean }) {
  return <div className={`command-grid flex h-full flex-col ${print ? 'print:block print:h-auto' : ''}`}>{children}</div>;
}

export function PageHeader({ title, description, actions, children, icon: Icon, eyebrow, meta }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="relative flex-shrink-0 overflow-hidden border-b border-gray-200/80 bg-white/82 px-3 py-4 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/78 sm:px-4 lg:px-6">
      <div aria-hidden="true" className="absolute -right-12 -top-24 h-52 w-72 rounded-full bg-blue-500/10 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="relative flex min-w-0 items-start gap-3">
          {Icon && <div className="mt-0.5 hidden rounded-xl border border-blue-400/20 bg-blue-500/10 p-2 text-blue-500 shadow-sm shadow-blue-500/10 sm:block"><Icon size={20} /></div>}
          <div className="min-w-0">
          {eyebrow && <div className="data-label mb-0.5 text-blue-500 dark:text-cyan-400">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap gap-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="relative flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function PageContent({ children, scroll = true, className = '' }: { children: ReactNode; scroll?: boolean; className?: string }) {
  return <div className={`flex-1 p-3 sm:p-4 lg:p-6 ${scroll ? 'overflow-y-auto' : 'overflow-hidden'} ${className}`}>{children}</div>;
}
