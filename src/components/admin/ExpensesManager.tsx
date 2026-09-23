'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { Modal, Field, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import { inputCls } from '@/components/ui/foundation';
import Pagination from './Pagination';

interface ExpenseRow {
  id: string;
  expenseNumber: string;
  branchId: string;
  category: string;
  description: string;
  amount: number;
  branch: { name: string; nameEn: string };
}

const CATEGORIES = ['RENT', 'UTILITIES', 'SALARIES', 'MARKETING', 'MAINTENANCE', 'SUPPLIES', 'TAXES', 'OTHER'];

export default function ExpensesManager({
  expenses,
  branches,
}: {
  expenses: ExpenseRow[];
  branches: Array<{ id: string; name: string; nameEn: string }>;
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [rowError, setRowError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ branchId: branches[0]?.id || '', category: 'OTHER', description: '', amount: '' });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = expenses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openAdd = () => {
    setEditing(null);
    setForm({ branchId: branches[0]?.id || '', category: 'OTHER', description: '', amount: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (e: ExpenseRow) => {
    setEditing(e);
    setForm({ branchId: e.branchId, category: e.category, description: e.description, amount: String(e.amount) });
    setFormError('');
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await apiFetch(`/api/admin/expenses/${editing.id}`, 'PATCH', { ...form, amount: Number(form.amount) });
      } else {
        await apiFetch('/api/admin/expenses', 'POST', { ...form, amount: Number(form.amount) });
      }
      setShowModal(false);
      setEditing(null);
      setForm({ branchId: branches[0]?.id || '', category: 'OTHER', description: '', amount: '' });
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch {
      const msg = t('operationFailed');
      setFormError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(isAr ? 'حذف هذا المصروف؟' : 'Delete this expense?')) return;
    setRowError('');
    setDeletingId(id);
    try {
      await apiFetch(`/api/admin/expenses/${id}`, 'DELETE', {});
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch {
      const msg = t('operationFailed');
      setRowError(msg);
      toast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-sm text-slate-100">{isAr ? 'مصروفات التشغيل' : 'Operating expenses'}</h3>
        <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          {t('newExpense')}
        </button>
      </div>

      {rowError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
          {rowError}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="pb-2">{isAr ? 'الرقم' : 'No.'}</th>
              <th className="pb-2">{isAr ? 'الفرع' : 'Branch'}</th>
              <th className="pb-2">{isAr ? 'التصنيف' : 'Category'}</th>
              <th className="pb-2">{isAr ? 'البيان' : 'Description'}</th>
              <th className="pb-2">{isAr ? 'المبلغ' : 'Amount'}</th>
              <th className="pb-2">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {pagedRows.map((e) => (
              <tr key={e.id} className="hover:bg-slate-900/50">
                <td className="py-2.5 font-bold text-amber-400">{e.expenseNumber}</td>
                <td className="py-2.5 text-slate-300">{isAr ? e.branch.name : e.branch.nameEn}</td>
                <td className="py-2.5 text-slate-400">{e.category}</td>
                <td className="py-2.5 text-slate-200">{e.description}</td>
                <td className="py-2.5 font-black text-rose-400">{e.amount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</td>
                <td className="py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(e)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all">
                      {t('edit')}
                    </button>
                    <button onClick={() => remove(e.id)} disabled={deletingId === e.id} className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold transition-all disabled:opacity-50">
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}
      </div>

      {expenses.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${expenses.length} مصروف` : `${expenses.length} expenses`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {showModal && (
        <Modal title={editing ? t('edit') : t('newExpense')} onClose={() => { setShowModal(false); setEditing(null); }}>
          <form onSubmit={submit} className="space-y-3 text-xs">
            {formError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={isAr ? 'الفرع' : 'Branch'}>
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className={inputCls}>
                  {branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>)}
                </select>
              </Field>
              <Field label={isAr ? 'تصنيف المصروف' : 'Category'}>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label={isAr ? 'بيان المصروف *' : 'Description *'} hint={isAr ? 'مثال: إيجار الفرع - سبتمبر' : 'e.g. Branch rent - September'}>
              <input required placeholder={isAr ? 'بيان المصروف' : 'Description'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
            </Field>
            <Field label={isAr ? 'المبلغ (ج.م) *' : 'Amount (EGP) *'}>
              <input required type="number" min="1" placeholder={isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
            </Field>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
