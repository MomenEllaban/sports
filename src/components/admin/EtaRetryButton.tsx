'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { RotateCcw } from 'lucide-react';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';

/** Retry one INVALID ETA invoice (T14). */
export default function EtaRetryButton({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const res = (await apiFetch(`/api/admin/tax-invoices/${id}/retry`, 'POST', {})) as { status?: string; message?: string };
          toast(`إعادة المحاولة: ${res.status || ''} — ${res.message || ''}`, 'success');
          router.refresh();
        } catch (err: unknown) {
          toast(err instanceof Error ? err.message : 'فشل', 'error');
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      aria-label="إعادة محاولة الإرسال"
      className="min-h-[44px] px-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold hover:bg-amber-500/25 disabled:opacity-60 flex items-center gap-1"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      {busy ? '...' : 'إعادة المحاولة'}
    </button>
  );
}
