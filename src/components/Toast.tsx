'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastKind, options?: ToastOptions) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(Ctx);
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'success', options: ToastOptions = {}) => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-2), { id, message, kind, actionLabel: options.actionLabel, onAction: options.onAction }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, options.actionLabel ? 8000 : 3500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 end-5 z-[100] space-y-2 w-[calc(100vw-2.5rem)] max-w-sm" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl border text-xs font-bold shadow-2xl animate-fade-up flex items-center gap-2.5 backdrop-blur-md ${
              t.kind === 'success'
                ? 'bg-emerald-600/95 border-emerald-400 text-white'
                : t.kind === 'error'
                  ? 'bg-rose-600/95 border-rose-400 text-white'
                  : 'bg-blue-600/95 border-blue-400 text-white'
            }`}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : t.kind === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            ) : (
              <Info className="w-5 h-5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.actionLabel && t.onAction && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.();
                  setItems((prev) => prev.filter((item) => item.id !== t.id));
                }}
                className="shrink-0 rounded-lg border border-white/30 px-2 py-1 text-[10px] font-black text-white hover:bg-white/15"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
