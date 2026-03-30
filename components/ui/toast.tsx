// components/ui/toast.tsx
// Lightweight toast notifications for error/success/info feedback.
// Drop-in: import { useToast, ToastContainer } from '@/components/ui/toast';
// Add <ToastContainer /> to layout once, then use toast() anywhere.

'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

type ToastType = 'error' | 'success' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
  toastError: () => {},
  toastSuccess: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
  warning: AlertCircle,
};

const STYLES: Record<ToastType, string> = {
  error: 'bg-h1-red-light border-red-200 text-h1-red',
  success: 'bg-green-50 border-green-200 text-h1-success',
  info: 'bg-h1-teal-light border-teal-200 text-h1-teal',
  warning: 'bg-h1-yellow-light border-yellow-200 text-h1-yellow',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    toastError: useCallback((msg: string) => addToast(msg, 'error', 6000), [addToast]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    toastSuccess: useCallback((msg: string) => addToast(msg, 'success', 3000), [addToast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`
                flex items-start gap-2.5 px-4 py-3 rounded-h1 border shadow-h1-dropdown
                animate-h1-fade-in ${STYLES[t.type]}
              `}
              role="alert"
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-h1-body font-medium flex-1">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="p-0.5 rounded hover:bg-black/5 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
