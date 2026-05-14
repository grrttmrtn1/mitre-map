const DETECTION_STATUS: Record<string, string> = {
  active:   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  tuning:   'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  disabled: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  planned:  'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  archived: 'bg-slate-700/40 text-slate-500 border border-slate-600/30',
};

const SEVERITY: Record<string, string> = {
  critical:    'bg-red-500/15 text-red-400 border border-red-500/30',
  high:        'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  medium:      'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  low:         'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  informational: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
};

const TOOL_STATUS: Record<string, string> = {
  active:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  planned:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  deprecated: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
};

interface Props {
  value: string;
  variant: 'detection_status' | 'severity' | 'tool_status';
  className?: string;
}

export default function StatusBadge({ value, variant, className = '' }: Props) {
  const map = variant === 'detection_status' ? DETECTION_STATUS
            : variant === 'severity' ? SEVERITY
            : TOOL_STATUS;
  const cls = map[value] ?? 'bg-slate-700 text-slate-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls} ${className}`}>
      {value}
    </span>
  );
}
