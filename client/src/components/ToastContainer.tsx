import { useToast } from '../context/ToastContext';

const STYLES: Record<string, string> = {
  success: 'bg-emerald-950/95 border-emerald-500/40 text-emerald-100',
  error:   'bg-red-950/95 border-red-500/40 text-red-100',
  info:    'bg-blue-950/95 border-blue-500/40 text-blue-100',
  warning: 'bg-amber-950/95 border-amber-500/40 text-amber-100',
};

const ICON_STYLES: Record<string, string> = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  info:    'text-blue-400',
  warning: 'text-amber-400',
};

const ICONS: Record<string, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-2xl text-sm pointer-events-auto max-w-sm backdrop-blur-sm ${STYLES[t.type]}`}
        >
          <span className={`font-bold flex-shrink-0 mt-px ${ICON_STYLES[t.type]}`}>{ICONS[t.type]}</span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
