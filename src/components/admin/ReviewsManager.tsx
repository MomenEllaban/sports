'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Check, Trash2, Star } from 'lucide-react';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { DataTable, ConfirmDialog } from '@/components/ui/foundation';

interface ReviewRow {
  id: string;
  rating: number;
  text: string | null;
  phone: string | null;
  approved: boolean;
  createdAt: string;
  product: { nameAr: string; sku: string };
}

export default function ReviewsManager({ initial }: { initial: ReviewRow[] }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ReviewRow | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  const reload = async () => {
    const res = await fetch(`/api/admin/reviews${pendingOnly ? '?pending=1' : ''}`);
    const data = await res.json();
    if (data.success) setRows(data.reviews);
    router.refresh();
  };

  const setApproval = async (r: ReviewRow, approved: boolean) => {
    setBusy(r.id);
    try {
      await apiFetch('/api/admin/reviews', 'PATCH', { id: r.id, approved });
      toast(isAr ? (approved ? 'تم الاعتماد' : 'تم إخفاء التقييم') : 'Done', 'success');
      await reload();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'فشل', 'error');
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(confirmDelete.id);
    try {
      await fetch(`/api/admin/reviews?id=${confirmDelete.id}`, { method: 'DELETE' });
      toast(isAr ? 'تم الحذف' : 'Deleted', 'success');
      setConfirmDelete(null);
      await reload();
    } catch {
      toast('فشل', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
        <input type="checkbox" checked={pendingOnly} onChange={(e) => { setPendingOnly(e.target.checked); }} className="w-5 h-5 accent-amber-500" />
        {isAr ? 'بانتظار المراجعة فقط' : 'Pending only'}
        <button onClick={reload} className="min-h-[44px] px-3 rounded-xl bg-slate-800 text-[11px]">{isAr ? 'تحديث' : 'Refresh'}</button>
      </label>
      <DataTable
        rows={rows}
        emptyTitle={isAr ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
        emptyHint={isAr ? 'تقييمات العملاء من صفحات المنتجات ستظهر هنا للاعتماد.' : 'Customer reviews will appear here for approval.'}
        columns={[
          { key: 'product', header: 'المنتج', render: (r) => <span className="font-bold">{r.product.nameAr} <span className="text-slate-500 font-mono text-[10px]">{r.product.sku}</span></span> },
          { key: 'rating', header: 'التقييم', render: (r) => <span className="flex items-center gap-1 font-black text-amber-400"><Star className="w-3.5 h-3.5 fill-amber-400" />{r.rating}</span> },
          { key: 'text', header: 'النص', hideOnMobile: true, render: (r) => <span className="text-slate-300 line-clamp-2 max-w-xs block">{r.text || '—'}</span> },
          {
            key: 'status', header: 'الحالة', render: (r) => (
              <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${r.approved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                {r.approved ? (isAr ? 'معتمد' : 'Approved') : (isAr ? 'معلق' : 'Pending')}
              </span>
            ),
          },
          {
            key: 'actions', header: isAr ? 'إجراءات' : 'Actions', render: (r) => (
              <span className="flex gap-1">
                <button onClick={() => setApproval(r, !r.approved)} disabled={busy === r.id} aria-label={isAr ? 'اعتماد/إخفاء' : 'Approve/hide'} className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 flex items-center justify-center disabled:opacity-60">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDelete(r)} aria-label={isAr ? 'حذف' : 'Delete'} className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </span>
            ),
          },
        ]}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isAr ? 'حذف التقييم نهائياً؟' : 'Delete review?'}
        impact={isAr ? 'سيُحذف نص التقييم ولن يظهر للعملاء.' : 'The review text will be removed.'}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
        busy={busy !== ''}
      />
    </div>
  );
}
