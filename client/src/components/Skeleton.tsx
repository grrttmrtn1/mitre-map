import type { CSSProperties } from 'react';

function S({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`bg-gradient-to-r from-slate-800 via-slate-700/80 to-slate-800 bg-[length:200%_100%] animate-shimmer rounded ${className}`}
      style={style}
    />
  );
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <S className={`h-3 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <S key={i} className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return <S className={`rounded-xl ${className}`} />;
}

export function SkeletonKPI() {
  return (
    <div className="rounded-xl border border-slate-800 p-4 space-y-2">
      <S className="h-3 w-24" />
      <S className="h-8 w-16" />
      <S className="h-2.5 w-20" />
    </div>
  );
}

export function SkeletonRow({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${className}`}>
      <S className="h-3 w-16 flex-shrink-0" />
      <S className="h-3 flex-1" />
      <S className="h-5 w-14 rounded-full flex-shrink-0" />
    </div>
  );
}

export function SkeletonDetailPanel() {
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-2">
        <S className="h-3 w-20" />
        <S className="h-6 w-64" />
        <S className="h-3 w-40" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <SkeletonKPI key={i} />)}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map(i => <SkeletonRow key={i} className="bg-slate-800/40 rounded-lg" />)}
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <SkeletonKPI key={i} />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <S className="h-4 w-36" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <div key={i} className="grid grid-cols-[1fr_120px_36px] items-center gap-3">
              <S className="h-2.5" style={{ width: `${55 + (i * 17) % 45}%` }} />
              <S className="h-2" />
              <S className="h-2.5 w-full" />
            </div>
          ))}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <S className="h-4 w-28" />
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <S className="w-2.5 h-2.5 rounded-sm" />
                <S className="h-2.5 w-16" />
              </div>
              <S className="h-4 w-6" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <S className="h-4 w-44 mb-4" />
          <S className="h-[280px] w-full rounded-lg" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <S className="h-4 w-52 mb-4" />
          <S className="h-[280px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
