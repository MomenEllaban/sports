'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { DataTable } from '@/components/ui/foundation';

interface Supplier { id: string; name: string }
interface Payment { id: string; supplierId: string; amount: number; method: string; reference: string | null; notes: string | null; createdAt: string; supplier: { name: string } }

/** Supplier payments ledger (T13): record cash/bank payments to suppliers. */
export default function SupplierPayments({ suppliers, initial }: { suppliers: Supplier[]; initial: Payment[] }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [rows, setRows] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ supplierId: suppliers[0]?.id || '', amount: '', method: 'CASH', reference: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);

  const reload = async () => {
    const res = await fetch('/api/admin/supplier-payments');
    const data = await res.json();
    if (data.success) setRows(data.payments);
    router.refresh();
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/supplier-payments', 'POST', {
        supplierId: form.supplierId,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      });
      toast(isAr ? 'تم تسجيل الدفعة' : 'Payment recorded', 'success');
      setForm({ supplierId: suppliers[0]?.id || '', amount: '', method: 'CASH', reference: '', notes: '' });
      setShowNew(false);
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل';
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-sm text-slate-100">مدفوعات الموردين</h3>
        <button onClick={() => setShowNew(!showNew)} className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1">
          <Plus className="w-4 h-4" />{isAr ? 'دفعة جديدة' : 'New payment'}
        </button>
      </div>
      {showNew && (
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label htmlFor="sp-supplier" className="block font-bold text-slate-300 mb-1">المورد *</label>
            <select id="sp-supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sp-amount" className="block font-bold text-slate-300 mb-1">المبلغ (ج.م) *</label>
            <input id="sp-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-bold" />
          </div>
          <div>
            <label htmlFor="sp-method" className="block font-bold text-slate-300 mb-1">الطريقة</label>
            <select id="sp-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
              <option value="CASH">نقدي</option>
              <option value="BANK">تحويل بنكي</option>
              <option value="INSTAPAY">انستاباي</option>
            </select>
          </div>
          <div>
            <label htmlFor="sp-ref" className="block font-bold text-slate-300 mb-1">مرجع</label>
            <input id="sp-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="رقم الإيصال..." className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
          {formError && <p role="alert" className="sm:col-span-2 text-rose-400 font-bold">{formError}</p>}
          <button type="submit" disabled={busy} className="sm:col-span-2 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold">
            {busy ? '...' : (isAr ? 'حفظ الدفعة' : 'Save payment')}
          </button>
        </form>
      )}
      <DataTable
        rows={rows}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyTitle={isAr ? 'لا مدفوعات مسجلة' : 'No payments yet'}
        columns={[
          { key: 'supplier', header: 'المورد', render: (r) => <span className="font-bold">{r.supplier.name}</span> },
          { key: 'amount', header: 'المبلغ', render: (r) => <span className="font-black text-emerald-400">{r.amount.toLocaleString()} ج.م</span> },
          { key: 'method', header: 'الطريقة', render: (r) => r.method },
          { key: 'date', header: 'التاريخ', hideOnMobile: true, render: (r) => <span className="text-slate-400">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span> },
        ]}
      />
    </div>
  );
}
