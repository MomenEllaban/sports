'use client';

/**
 * Unified UI foundation (F0 §1.4–1.6):
 * Button, inputCls, Modal, ConfirmDialog, EmptyState, Skeleton, SafeImage,
 * DataTable (responsive), Stepper, PageHeader, LocaleSwitcher.
 * Dark-theme first, touch targets ≥44px, RTL/LTR aware.
 * Toasts live ONLY in @/components/Toast (mounted once in the root layout).
 */
import React, { useEffect, useRef, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { AlertTriangle, ChevronLeft, ChevronRight, Globe, Inbox, X } from 'lucide-react';

// ── Button (F0 §1.4): one primary/secondary/danger/ghost spec ──
export type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary' | 'ghost';

const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-control',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-control',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-control',
  secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 border border-slate-800',
};

export const btnBaseCls =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-control text-xs font-bold transition-colors disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} {...props} className={`${btnBaseCls} ${btnVariants[variant]} ${className}`} />;
}

// ── Inputs (F0 §1.4): single canonical class for every editable field ──
export const inputCls =
  'w-full min-h-[44px] px-3 py-2 rounded-control bg-slate-900 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors';

// ── Skeleton (F0 §1.5): shimmer placeholder for loading states ──
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-card bg-slate-800/60 ${className}`} />;
}

// ── PageHeader (F0 §3): page title + description + actions ─────
export function PageHeader({ title, description, actions }: {
  title: string; description?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl font-black text-slate-100 tracking-tight leading-tight">{title}</h1>
        {description && <p className="text-sm text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
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

// ── Table (F0 §1.5): one consistent data-table spec ─────
export const tableCls = 'w-full text-xs text-start';
export const tableHeadCls = 'text-slate-400 bg-slate-950 border-b border-slate-800';
export const tableHeadCellCls = 'p-3 whitespace-nowrap';
export const tableRowCls = 'hover:bg-slate-900/50';
export const tableCellCls = 'p-3';

// ── Pagination (F0 §1.5): shared pager for every list ───
function pageWindow(page: number, total: number, width = 2): (number | '…')[] {
  const pages = new Set<number>([1, total]);
  for (let i = Math.max(1, page - width); i <= Math.min(total, page + width); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  const isRtl = locale === 'ar';

  if (totalPages <= 1) return null;

  const btn =
    'flex h-10 min-w-10 items-center justify-center rounded-control border border-slate-700 px-2 text-xs font-bold transition-colors';

  return (
    <nav aria-label={ariaLabel || 'Pagination'} className="pt-4">
      <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          aria-disabled={page <= 1}
          className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ChevronRight className={`h-4 w-4 ${isRtl ? 'rtl-flip' : ''}`} />
        </button>

        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-slate-500">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${
                p === page
                  ? 'border-blue-500 bg-blue-600 text-white shadow-control'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          aria-disabled={page >= totalPages}
          className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ChevronLeft className={`h-4 w-4 ${isRtl ? 'rtl-flip' : ''}`} />
        </button>
      </div>
    </nav>
  );
}

// ── DataTable (responsive: cards on small screens) ───────
export interface Column<T> { key: string; header: string; render: (row: T) => React.ReactNode; hideOnMobile?: boolean }
export function DataTable<T extends { id: string }>({ rows, columns, emptyTitle, emptyHint, actionLabel, onAction, page, pageSize, onPageChange }: {
  rows: T[]; columns: Column<T>[]; emptyTitle: string; emptyHint?: string; actionLabel?: string; onAction?: () => void;
  page?: number; pageSize?: number; onPageChange?: (p: number) => void;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} actionLabel={actionLabel} onAction={onAction} />;
  const showPager = typeof page === 'number' && typeof pageSize === 'number' && onPageChange;
  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const safePage = showPager ? Math.min(Math.max(1, page!), totalPages) : 1;
  const visible = showPager ? rows.slice((safePage - 1) * pageSize!, safePage * pageSize!) : rows;
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-card border border-slate-800 shadow-card">
        <table className={tableCls}>
          <thead className={tableHeadCls}>
            <tr>{columns.map((c) => <th key={c.key} className={tableHeadCellCls}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((r) => (
              <tr key={r.id} className={tableRowCls}>{columns.map((c) => <td key={c.key} className={tableCellCls}>{c.render(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {visible.map((r) => (
          <div key={r.id} className="p-3.5 rounded-card bg-slate-900 border border-slate-800 text-xs space-y-1.5 shadow-card">
            {columns.filter((c) => !c.hideOnMobile).map((c) => (
              <div key={c.key} className="flex justify-between gap-2">
                <span className="text-slate-500 shrink-0">{c.header}</span>
                <span className="text-slate-100 text-left">{c.render(r)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {showPager && <Pagination page={safePage} totalPages={totalPages} onPageChange={onPageChange!} />}
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 animate-fade-in" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-panel bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-modal outline-none animate-fade-up">
        <h3 className="font-black text-sm text-slate-100 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{impact}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>رجوع</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? '...' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Modal (F0 §1.4): one shared dialog with Escape/focus management ─
export function Modal({ title, onClose, children, size = 'md', footer }: {
  title: string; onClose: () => void; children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg'; footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, [onClose]);
  const width = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`bg-slate-900 border border-slate-700 p-6 rounded-panel w-full ${width} space-y-4 shadow-modal max-h-[90vh] overflow-y-auto animate-fade-up outline-none`}
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-sm text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 flex items-center justify-center rounded-control bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">{footer}</div>
        )}
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
