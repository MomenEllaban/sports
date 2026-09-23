'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/Toast';
import { inputCls } from '@/components/ui/foundation';

// Shared dialog + canonical input class live in the foundation kit.
export { Modal } from '@/components/ui/foundation';
export const fieldInputCls = inputCls;

// Localized badge for any enum status (order / payment / transfer / PO / invoice)
export function StatusBadge({ value, tone }: { value: string; tone?: 'order' | 'payment' | 'generic' }) {
  const t = useTranslations('admin');
  const key = `status_${value}`;
  let label: string;
  try {
    label = t(key);
  } catch {
    label = value;
  }

  const color =
    ['DELIVERED', 'PAID', 'COMPLETED', 'APPROVED', 'VALID', 'RECEIVED'].includes(value)
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : ['CANCELLED', 'FAILED', 'INVALID', 'REJECTED', 'RETURNED'].includes(value)
        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
        : ['SHIPPED', 'PROCESSING', 'CONFIRMED', 'SUBMITTED'].includes(value)
          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
          : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

  return (
    <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border w-fit ${color}`}>
      {label}
    </span>
  );
}

export function PayLabel({ value }: { value: string }) {
  const t = useTranslations('admin');
  let label = value;
  try {
    label = t(`pay_${value}`);
  } catch { /* fallback to raw */ }
  return <span>{label}</span>;
}

export function SourceLabel({ value }: { value: string }) {
  const t = useTranslations('admin');
  let label = value;
  try {
    label = t(`src_${value}`);
  } catch { /* fallback to raw */ }
  return <span>{label}</span>;
}

// Button with built-in loading + toast feedback + inline error (no console noise for users)
export function ActionButton({
  onAction,
  children,
  className = '',
  confirmMessage,
  successMessage,
}: {
  onAction: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  successMessage?: string;
}) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (loading) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setLoading(true);
    setError('');
    try {
      await onAction();
      toast(successMessage || t('operationSuccess'), 'success');
    } catch {
      const msg = t('operationFailed');
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button onClick={handle} disabled={loading} className={`${className} disabled:opacity-60`}>
        {loading ? t('loading') : children}
      </button>
      {error && <span className="text-[10px] text-rose-400 font-bold">{error}</span>}
    </span>
  );
}

export async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// Unified labeled form field: visible <label> above every input + example placeholder + hint + error.
// Use for ALL user-editable inputs (admin + storefront + POS).
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block font-bold text-slate-300 text-xs">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-rose-400 font-bold">
          {error}
        </p>
      )}
    </div>
  );
}
