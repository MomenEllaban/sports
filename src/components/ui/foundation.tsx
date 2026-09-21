'use client';

/**
 * Unified UI foundation (F0 §1.4–1.6):
 * Toast, EmptyState, SafeImage, DataTable (responsive), Stepper, ConfirmDialog,
 * LocaleSwitcher. Dark-theme first, touch targets ≥44px, RTL/LTR aware.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { CheckCircle2, AlertTriangle, Info, Inbox, Globe } from 'lucide-react';

// ── Toast ────────────────────────────────────────────────
type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; kind: ToastKind; text: string }
const ToastCtx = createContext<{ toast: (text: string, kind?: ToastKind) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);
let toastSeq = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = toastSeq++;
    setItems((p) => [...p, { id, kind, text }]);
    setTimeout(() => setItems((p) => p.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto min-h-[44px] flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold shadow-2xl max-w-md w-full sm:w-auto ${
              t.kind === 'success' ? 'bg-emerald-600 text-white border-emerald-400'
              : t.kind === 'error' ? 'bg-rose-600 text-white border-rose-400'
              : t.kind === 'warning' ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-800 text-slate-100 border-slate-600'
            }`}
          >
            {t.kind === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : t.kind === 'error' || t.kind === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
            <span className="leading-relaxed">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ── EmptyState (F0 §1.5: never a bare table header) ──────
export function EmptyState({ title, hint, actionLabel, onAction }: { title: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 px-6 text-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/40">
      <Inbox className="w-8 h-8 text-slate-500" />
      <p className="font-extrabold text-sm text-slate-200">{title}</p>
      {hint && <p className="text-xs text-slate-400 leading-relaxed max-w-sm">{hint}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-2 min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── SafeImage (F0 §1.6) ──────────────────────────────────
export function SafeImage({ alt, fallbackSrc = '/placeholder-product.svg', ...props }: ImageProps & { fallbackSrc?: string }) {
  const [src, setSrc] = useState<ImageProps['src']>(props.src);
  return <Image {...props} src={src} alt={alt} onError={() => setSrc(fallbackSrc)} />;
}

// ── DataTable (responsive: cards on small screens) ───────
export interface Column<T> { key: string; header: string; render: (row: T) => React.ReactNode; hideOnMobile?: boolean }
export function DataTable<T extends { id: string }>({ rows, columns, emptyTitle, emptyHint, actionLabel, onAction }: {
  rows: T[]; columns: Column<T>[]; emptyTitle: string; emptyHint?: string; actionLabel?: string; onAction?: () => void;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} actionLabel={actionLabel} onAction={onAction} />;
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>{columns.map((c) => <th key={c.key} className="p-3 whitespace-nowrap">{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-900/50">{columns.map((c) => <td key={c.key} className="p-3">{c.render(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
            {columns.filter((c) => !c.hideOnMobile).map((c) => (
              <div key={c.key} className="flex justify-between gap-2">
                <span className="text-slate-500 shrink-0">{c.header}</span>
                <span className="text-slate-100 text-left">{c.render(r)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Stepper / Wizard shell (F0 §1.4) ─────────────────────
export function Stepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <ol className="flex items-center gap-1" aria-label="progress">
      {steps.map((s, i) => (
        <li key={s} className="flex-1 flex items-center gap-1">
          <div className="flex flex-col items-center gap-1 w-full">
            <span className={`w-full h-1.5 rounded-full ${i < active ? 'bg-emerald-500' : i === active ? 'bg-blue-500' : 'bg-slate-700'}`} />
            <span className={`text-[10px] font-bold text-center leading-tight ${i === active ? 'text-blue-300' : 'text-slate-500'}`}>{s}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── ConfirmDialog for dangerous actions (F0 §1.4) ────────
export function ConfirmDialog({ open, title, impact, confirmLabel, onConfirm, onClose, busy }: {
  open: boolean; title: string; impact: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-black text-sm text-slate-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{impact}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={busy} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-xs font-bold">رجوع</button>
          <button onClick={onConfirm} disabled={busy} className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-bold">
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LocaleSwitcher (F0 §1.3) for dashboard + POS headers ─
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === 'ar' ? 'en' : 'ar';
  return (
    <button
      onClick={() => router.replace(pathname, { locale: next })}
      aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={locale === 'ar' ? 'English' : 'عربي'}
      className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black border border-slate-700 flex items-center justify-center gap-1"
    >
      <Globe className="w-4 h-4" />
      {locale === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
