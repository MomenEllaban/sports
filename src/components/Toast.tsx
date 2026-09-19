'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(Ctx);
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2 w-[calc(100vw-2.5rem)] max-w-sm" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
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
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
