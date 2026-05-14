import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++_nextId;
    setToasts(prev => [...prev, { id, type, message }]);
    const timeout = type === 'error' ? 6000 : 3500;
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), timeout);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => add('success', msg),
    error:   (msg: string) => add('error', msg),
    info:    (msg: string) => add('info', msg),
    warning: (msg: string) => add('warning', msg),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
