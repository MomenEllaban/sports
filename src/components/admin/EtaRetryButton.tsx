'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { RotateCcw } from 'lucide-react';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { useLocale } from 'next-intl';

/** Retry one INVALID ETA invoice (T14). */
export default function EtaRetryButton({ id }: { id: string }) {
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const res = (await apiFetch(`/api/admin/tax-invoices/${id}/retry`, 'POST', {})) as { status?: string; message?: string };
          toast(L(`إعادة المحاولة: ${res.status || ''} — ${res.message || ''}`, `Retry: ${res.status || ''} — ${res.message || ''}`), 'success');
          router.refresh();
        } catch (err: unknown) {
          toast(err instanceof Error ? err.message : L('فشل', 'Operation failed'), 'error');
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      aria-label={L('إعادة محاولة الإرسال', 'Retry submission')}
      className="min-h-[44px] px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 disabled:opacity-60 flex items-center gap-1"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      {busy ? '...' : L('إعادة المحاولة', 'Retry')}
    </button>
  );
}
