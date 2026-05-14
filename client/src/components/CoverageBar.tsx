interface Props {
  covered: number;
  total: number;
  showLabel?: boolean;
  height?: 'sm' | 'md';
}

export default function CoverageBar({ covered, total, showLabel = true, height = 'sm' }: Props) {
  const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

  const gradient =
    pct >= 80 ? 'from-emerald-500 to-emerald-400' :
    pct >= 60 ? 'from-teal-500 to-emerald-500' :
    pct >= 40 ? 'from-yellow-500 to-amber-400' :
    pct >= 20 ? 'from-orange-500 to-amber-500' :
    'from-red-500 to-orange-500';

  const glow =
    pct >= 80 ? 'shadow-[0_0_6px_rgba(16,185,129,0.5)]' :
    pct >= 60 ? 'shadow-[0_0_6px_rgba(20,184,166,0.4)]' :
    '';

  const trackH = height === 'md' ? 'h-2' : 'h-1.5';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${trackH} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${gradient} ${glow}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
      )}
    </div>
  );
}
