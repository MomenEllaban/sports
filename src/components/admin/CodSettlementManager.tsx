'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { calculateCodReconciliation } from '@/lib/payments';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { useRouter } from '@/i18n/routing';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface CodRow {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  customerName: string | null;
  guestPhone: string;
  trackingNumber: string | null;
  orderStatus: string;
  paymentStatus: string;
  collectedAmount: number;
  remittedAmount: number;
  codReconciled: boolean;
  createdAt: string;
}

export default function CodSettlementManager({ initialOrders }: { initialOrders: CodRow[] }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { toast } = useToast();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const save = async (row: CodRow) => {
    const raw = drafts[row.id] ?? String(row.remittedAmount);
    const remitted = Number(raw);
    if (!Number.isFinite(remitted) || remitted < 0) {
      toast(isAr ? 'المبلغ المحصّل غير صالح' : 'Invalid remitted amount', 'error');
      return;
    }
    setSavingId(row.id);
    try {
      await apiFetch('/api/admin/cod-settlement', 'POST', { orderId: row.id, remittedAmount: remitted });
      toast(isAr ? 'تم حفظ التسوية' : 'Remittance saved', 'success');
      router.refresh();
    } catch {
      toast(isAr ? 'فشل حفظ التسوية' : 'Failed to save', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const totals = initialOrders.reduce(
    (s, o) => ({
      collected: s.collected + o.collectedAmount,
      remitted: s.remitted + o.remittedAmount,
    }),
    { collected: 0, remitted: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-slate-400 font-bold">{isAr ? 'المحصّل (طلبات COD)' : 'Collected'}</div>
          <div className="text-xl font-black text-slate-100">{totals.collected.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-slate-400 font-bold">{isAr ? 'الموَرَّد من المناديب' : 'Remitted'}</div>
          <div className="text-xl font-black text-blue-400">{totals.remitted.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-slate-400 font-bold">{isAr ? 'الفرق' : 'Discrepancy'}</div>
          <div className={`text-xl font-black ${(totals.collected - totals.remitted) > 0.01 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {(totals.collected - totals.remitted).toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'الطلب' : 'Order'}</th>
              <th className="p-3">{isAr ? 'الفرع / التتبع' : 'Branch / Tracking'}</th>
              <th className="p-3">{isAr ? 'المحصّل' : 'Collected'}</th>
              <th className="p-3">{isAr ? 'الموَرَّد (كشف الشركة)' : 'Remitted (sheet)'}</th>
              <th className="p-3">{isAr ? 'الفرق' : 'Diff'}</th>
              <th className="p-3">{isAr ? 'الحالة' : 'Status'}</th>
              <th className="p-3">{isAr ? 'حفظ' : 'Save'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {initialOrders.map((o) => {
              const draft = drafts[o.id] !== undefined ? Number(drafts[o.id]) : o.remittedAmount;
              const rec = calculateCodReconciliation({
                branchId: o.branchId,
                orderNumber: o.orderNumber,
                collectedAmount: o.collectedAmount,
                remittedAmount: Number.isFinite(draft) ? draft : o.remittedAmount,
                discrepancy: 0,
                isReconciled: false,
              });
              return (
                <tr key={o.id} className="hover:bg-slate-900/60">
                  <td className="p-3">
                    <div className="font-bold text-amber-400">{o.orderNumber}</div>
                    <div className="text-[10px] text-slate-500">{o.customerName || '—'} • <span dir="ltr">{o.guestPhone}</span></div>
                  </td>
                  <td className="p-3 text-slate-300">
                    <div className="font-bold">{o.branchName}</div>
                    <div className="text-[10px] text-slate-500">{o.trackingNumber || '—'}</div>
                  </td>
                  <td className="p-3 font-black text-slate-100">{o.collectedAmount.toLocaleString()}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={o.remittedAmount}
                      aria-label={isAr ? `المبلغ المورد للطلب ${o.orderNumber}` : `Remitted for ${o.orderNumber}`}
                      onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                      className="w-28 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100"
                    />
                  </td>
                  <td className={`p-3 font-black ${rec.isReconciled ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {rec.discrepancy.toLocaleString()}
                  </td>
                  <td className="p-3">
                    {o.codReconciled ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> {isAr ? 'مطابق' : 'Matched'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                        <AlertTriangle className="w-4 h-4" /> {isAr ? 'معلّق' : 'Pending'}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => save(o)}
                      disabled={savingId === o.id}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold"
                    >
                      {savingId === o.id ? '...' : isAr ? 'حفظ' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {initialOrders.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">لا توجد طلبات دفع عند الاستلام بعد.</div>
        )}
      </div>
    </div>
  );
}
