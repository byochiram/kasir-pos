'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 3000,
  info: 4000,
  // Error dibiarkan lebih lama supaya sempat dibaca.
  error: 7000,
};

const STYLES: Record<ToastKind, { bar: string; icon: string; label: string }> = {
  success: { bar: 'bg-emerald-500', icon: '✓', label: 'Berhasil' },
  error: { bar: 'bg-red-500', icon: '!', label: 'Gagal' },
  info: { bar: 'bg-sky-500', icon: 'i', label: 'Info' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS[kind]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:w-auto"
        role="region"
        aria-label="Notifikasi"
      >
        {toasts.map((toast) => {
          const style = STYLES[toast.kind];
          return (
            <div
              key={toast.id}
              role="status"
              aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
              className="animate-slide-up flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${style.bar}`}
                aria-hidden
              >
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-500">{style.label}</p>
                <p className="mt-0.5 break-words text-sm text-slate-800">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Tutup notifikasi"
                className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return context;
}
