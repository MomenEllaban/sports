'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus, Trash2, Power } from 'lucide-react';
import { apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { DataTable, ConfirmDialog } from '@/components/ui/foundation';

interface Coupon {
  id: string;
  code: string;
  kind: string;
  value: number;
  capAmount: number;
  minTotal: number;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export default function CouponsManager({ initial }: { initial: Coupon[] }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: '', kind: 'PERCENT', value: '', capAmount: '', minTotal: '', usageLimit: '', endsAt: '' });
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);

  const reload = async () => {
    const res = await fetch('/api/admin/coupons');
    const data = await res.json();
    if (data.success) setRows(data.coupons);
    router.refresh();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('new');
    setFormError('');
    try {
      const res = (await apiFetch('/api/admin/coupons', 'POST', {
        code: form.code,
        kind: form.kind,
        value: Number(form.value),
        capAmount: form.capAmount === '' ? 0 : Number(form.capAmount),
        minTotal: form.minTotal === '' ? 0 : Number(form.minTotal),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        endsAt: form.endsAt || undefined,
      })) as { coupon?: Coupon };
      if (res.coupon) {
        toast(isAr ? `تم إنشاء الكوبون ${res.coupon.code}` : `Coupon ${res.coupon.code} created`, 'success');
        setForm({ code: '', kind: 'PERCENT', value: '', capAmount: '', minTotal: '', usageLimit: '', endsAt: '' });
        setShowNew(false);
        await reload();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الإنشاء';
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setBusy('');
    }
  };

  const toggle = async (c: Coupon) => {
    setBusy(c.id);
    try {
      await apiFetch(`/api/admin/coupons/${c.id}`, 'PATCH', { isActive: !c.isActive });
      toast(isAr ? 'تم التحديث' : 'Updated', 'success');
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
      await apiFetch(`/api/admin/coupons/${confirmDelete.id}`, 'DELETE');
      toast(isAr ? 'تم الحذف' : 'Deleted', 'success');
      setConfirmDelete(null);
      await reload();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'فشل', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-slate-400">{isAr ? 'أكواد الخصم للمتجر والكاشير — تُحتسب مرة واحدة ولا تتجاوز السقف.' : 'Promo codes for store & POS — single-use counted, capped.'}</p>
        <button onClick={() => setShowNew(!showNew)} className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1">
          <Plus className="w-4 h-4" />{isAr ? 'كوبون جديد' : 'New coupon'}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="glass-panel p-5 rounded-3xl border border-slate-800 grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label htmlFor="cp-code" className="block font-bold text-slate-300 mb-1">الكود *</label>
            <input id="cp-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE10" dir="ltr" className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono font-bold" />
          </div>
          <div>
            <label htmlFor="cp-kind" className="block font-bold text-slate-300 mb-1">النوع</label>
            <select id="cp-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700">
              <option value="PERCENT">نسبة %</option>
              <option value="FIXED">مبلغ ثابت</option>
            </select>
          </div>
          <div>
            <label htmlFor="cp-value" className="block font-bold text-slate-300 mb-1">القيمة *</label>
            <input id="cp-value" type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
          <div>
            <label htmlFor="cp-cap" className="block font-bold text-slate-300 mb-1">سقف الخصم (0 = بلا)</label>
            <input id="cp-cap" type="number" min="0" step="0.01" value={form.capAmount} onChange={(e) => setForm({ ...form, capAmount: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
          <div>
            <label htmlFor="cp-min" className="block font-bold text-slate-300 mb-1">حد أدنى للفاتورة</label>
            <input id="cp-min" type="number" min="0" step="0.01" value={form.minTotal} onChange={(e) => setForm({ ...form, minTotal: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
          <div>
            <label htmlFor="cp-limit" className="block font-bold text-slate-300 mb-1">حد الاستخدام (فارغ = بلا)</label>
            <input id="cp-limit" type="number" min="1" step="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className="w-full min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
          {formError && <p role="alert" className="sm:col-span-3 text-rose-400 font-bold">{formError}</p>}
          <button type="submit" disabled={busy === 'new'} className="sm:col-span-3 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold">
            {busy === 'new' ? '...' : isAr ? 'إنشاء الكوبون' : 'Create coupon'}
          </button>
        </form>
      )}

      <DataTable
        rows={rows}
        emptyTitle={isAr ? 'لا توجد كوبونات بعد' : 'No coupons yet'}
        emptyHint={isAr ? 'أنشئ أول كوبون خصم لحملاتك من الزر أعلاه.' : 'Create your first promo code above.'}
        columns={[
          { key: 'code', header: 'الكود', render: (r) => <span className="font-mono font-black text-amber-400" dir="ltr">{r.code}</span> },
          { key: 'value', header: 'القيمة', render: (r) => <span className="font-bold">{r.kind === 'PERCENT' ? `${r.value}%` : `${r.value} ج.م`}{r.capAmount > 0 ? ` (سقف ${r.capAmount})` : ''}</span> },
          { key: 'use', header: 'الاستخدام', render: (r) => <span className="text-slate-300">{r.usedCount}{r.usageLimit ? `/${r.usageLimit}` : ''}</span> },
          { key: 'status', header: 'الحالة', render: (r) => (
            <span className={`px-2 py-0.5 rounded-lg font-bold ${r.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              {r.isActive ? (isAr ? 'مفعل' : 'Active') : (isAr ? 'موقوف' : 'Off')}
            </span>
          )},
          {
            key: 'actions', header: isAr ? 'إجراءات' : 'Actions', render: (r) => (
              <span className="flex gap-1">
                <button onClick={() => toggle(r)} disabled={busy === r.id} aria-label={isAr ? 'تفعيل/إيقاف' : 'Toggle'} className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-60">
                  <Power className="w-4 h-4" />
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
        title={isAr ? `حذف الكوبون ${confirmDelete?.code}؟` : `Delete ${confirmDelete?.code}?`}
        impact={isAr ? 'الكوبونات المستخدمة من قبل لا تُحذف — عطّلها بدلاً من ذلك.' : 'Used coupons cannot be deleted — disable them instead.'}
        confirmLabel={isAr ? 'حذف' : 'Delete'}
        onConfirm={remove}
        onClose={() => setConfirmDelete(null)}
        busy={busy !== ''}
      />
    </div>
  );
}
