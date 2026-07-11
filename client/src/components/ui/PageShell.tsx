import type { ReactNode } from 'react';

export function PageShell({ children, print = false }: { children: ReactNode; print?: boolean }) {
  return <div className={`flex h-full flex-col ${print ? 'print:block print:h-auto' : ''}`}>{children}</div>;
}

export function PageHeader({ title, description, actions, children }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative flex-shrink-0 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-gray-50 to-white px-3 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:px-4 lg:px-6">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function PageContent({ children, scroll = true, className = '' }: { children: ReactNode; scroll?: boolean; className?: string }) {
  return <div className={`flex-1 p-3 sm:p-4 lg:p-6 ${scroll ? 'overflow-y-auto' : 'overflow-hidden'} ${className}`}>{children}</div>;
}
