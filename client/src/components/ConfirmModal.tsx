import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  confirming?: boolean;
}

export default function ConfirmModal({
  open, onClose, onConfirm,
  title, message,
  confirmLabel = 'Confirm',
  destructive = false,
  confirming = false,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="text-base font-semibold text-slate-100 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {confirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
