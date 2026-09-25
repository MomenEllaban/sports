'use client';

/**
 * Unified UI foundation (F0 §1.4–1.6):
 * Button, inputCls, Modal, ConfirmDialog, EmptyState, Skeleton, SafeImage,
 * DataTable (responsive), Stepper, PageHeader, LocaleSwitcher, DirectionalIcon.
 * Dark-theme first, touch targets ≥44px, RTL/LTR aware.
 * Toasts live ONLY in @/components/Toast (mounted once in the root layout).
 */
import React, { useEffect, useRef, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { ChevronLeft, ChevronRight, Globe, Inbox, X } from 'lucide-react';

// ── DirectionalIcon (Group 07): semantic back/forward chevron.
// Renders ChevronLeft for "back" (ChevronRight for "forward") and auto-flips
// in RTL via .rtl-flip. Vertical chevrons must NOT use this (no flip).
// Semantic rule: clocks, spinners, media-play and brand marks never flip.
export function DirectionalIcon({ back, className }: { back?: boolean; className?: string }) {
  const cls = `rtl-flip ${className || 'h-4 w-4'}`;
  return back ? (
    <ChevronLeft className={cls} aria-hidden />
  ) : (
    <ChevronRight className={cls} aria-hidden />
  );
}

// ── Button (F0 §1.4): one primary/secondary/danger/ghost spec ──
export type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary' | 'ghost' | 'brand';

const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-control',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-control',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-control',
  brand: 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-control',
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
  'w-full min-h-[44px] px-3 py-2 rounded-control bg-slate-900 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors';

// ── NumberField: debounce-free numeric editing without caret loss ──
// The raw text stays in local state while typing, so the field can always
// be cleared/edited freely (Number() never snaps back mid-keystroke).
// The parsed, min/max-clamped value is committed to the parent on blur/Enter.
interface NumberFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value' | 'defaultValue'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  inputClassName?: string;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  inputClassName = '',
  onBlur,
  onKeyDown,
  ...rest
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    let next = Number(raw);
    if (!Number.isFinite(next)) next = 0;
    if (typeof min === 'number' && next < min) next = min;
    if (typeof max === 'number' && next > max) next = max;
    setDraft(null);
    onChange(next);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      dir="ltr"
      min={min}
      max={max}
      step={step}
      value={draft ?? (value || '')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        commit(e.target.value);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        onKeyDown?.(e);
      }}
      {...rest}
      className={`${inputCls} font-mono tabular-nums ${inputClassName}`}
    />
  );
}

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
          <DirectionalIcon back className="h-4 w-4" />
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
          <DirectionalIcon className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

// ── DataTable (responsive: cards on small screens) ───────
export interface Column<T> { key: string; header: string; render: (row: T) => React.ReactNode; hideOnMobile?: boolean }
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  emptyHint,
  actionLabel,
  onAction,
  page,
  pageSize,
  onPageChange,
  totalCount,
  loading,
}: {
  rows: T[];
  columns: Column<T>[];
  emptyTitle: string;
  emptyHint?: string;
  actionLabel?: string;
  onAction?: () => void;
  page?: number;
  pageSize?: number;
  onPageChange?: (p: number) => void;
  totalCount?: number;
  loading?: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2 p-4 rounded-card border border-slate-800 bg-slate-900/40">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} actionLabel={actionLabel} onAction={onAction} />;
  const showPager = typeof page === 'number' && typeof pageSize === 'number' && onPageChange;
  const isServerPaged = typeof totalCount === 'number';
  const effectiveTotal = isServerPaged ? totalCount : rows.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(effectiveTotal / pageSize)) : 1;
  const safePage = showPager ? Math.min(Math.max(1, page!), totalPages) : 1;
  const visible = isServerPaged ? rows : (showPager ? rows.slice((safePage - 1) * pageSize!, safePage * pageSize!) : rows);
  return (
    <>
      {/* Desktop table */}
      <div className="app-scrollbar app-scrollbar-horizontal hidden md:block overflow-x-auto rounded-card border border-slate-800 shadow-card">
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
                <span className="text-slate-100 text-end">{c.render(r)}</span>
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

// ── Focus trap (Group 08): keep Tab cycling inside open dialogs ──
function useFocusTrap(activeRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = activeRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = [...root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, activeRef]);
}

// ── Shared dialog frame ────────────────────────────────────────────────
// One viewport-owned surface for every dialog. The panel has no fixed
// height: it grows with its content and only scrolls its body after the
// viewport cap is reached. This is important for short tables and long
// forms alike, and avoids measuring heights in JavaScript.
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

let openDialogCount = 0;
let bodyOverflowBeforeDialog = '';

function useDialogScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (openDialogCount === 0) {
      bodyOverflowBeforeDialog = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogCount += 1;
    return () => {
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) document.body.style.overflow = bodyOverflowBeforeDialog;
    };
  }, [active]);
}

function useDialogLifecycle(
  panelRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useFocusTrap(panelRef, active);
  useDialogScrollLock(active);
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [active, panelRef]);
}

export function DialogFrame({
  title,
  onClose,
  children,
  size = 'md',
  footer,
  active = true,
  role = 'dialog',
  panelClassName = '',
  bodyClassName = '',
  footerClassName = '',
  overlayClassName = '',
  closeLabel = 'إغلاق',
  header,
  headerClassName = '',
  showCloseButton = true,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: DialogSize;
  footer?: React.ReactNode;
  active?: boolean;
  role?: 'dialog' | 'alertdialog';
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  overlayClassName?: string;
  closeLabel?: string;
  header?: React.ReactNode;
  headerClassName?: string;
  showCloseButton?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogLifecycle(panelRef, active, onClose);
  if (!active) return null;

  const width = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-lg';
  return (
    <div
      className={`app-modal-overlay bg-slate-950/80 backdrop-blur-sm animate-fade-in ${overlayClassName}`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`app-modal-panel app-scrollbar bg-slate-900 border border-slate-700 rounded-panel ${width} shadow-modal animate-fade-up outline-none ${panelClassName}`}
      >
        <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-6 pb-3 pt-6 ${headerClassName}`}>
          {header ?? <h3 className="font-extrabold text-sm text-slate-100">{title}</h3>}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={`app-modal-body app-scrollbar px-6 ${footer ? 'pb-4' : 'pb-6'} ${bodyClassName}`}>
          {children}
        </div>
        {footer && (
          <div className={`flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-6 pb-6 pt-4 ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ConfirmDialog for dangerous actions (F0 §1.4) ────────
export function ConfirmDialog({ open, title, impact, confirmLabel, onConfirm, onClose, busy }: {
  open: boolean; title: string; impact: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  return (
    <DialogFrame
      active={open}
      role="alertdialog"
      title={title}
      onClose={onClose}
      panelClassName="max-w-sm"
      bodyClassName="text-xs leading-relaxed text-slate-400"
      footer={(
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>رجوع</Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? '...' : confirmLabel}</Button>
        </div>
      )}
    >
      <p>{impact}</p>
    </DialogFrame>
  );
}

// ── Modal (F0 §1.4): one shared dialog with Escape/focus management ─
export function Modal({ title, onClose, children, size = 'md', footer }: {
  title: string; onClose: () => void; children: React.ReactNode;
  size?: DialogSize; footer?: React.ReactNode;
}) {
  return (
    <DialogFrame title={title} onClose={onClose} size={size} footer={footer} bodyClassName="space-y-4">
      {children}
    </DialogFrame>
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
