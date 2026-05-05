interface Props {
  covered: number;
  total: number;
  showLabel?: boolean;
}

export default function CoverageBar({ covered, total, showLabel = true }: Props) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : pct >= 25 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
      )}
    </div>
  );
}
