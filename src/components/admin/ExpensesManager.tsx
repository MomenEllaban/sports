'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { Modal, apiFetch } from './ui';

interface ExpenseRow {
  id: string;
  expenseNumber: string;
  category: string;
  description: string;
  amount: number;
  date: Date;
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
  const isAr = locale === 'ar';
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ branchId: branches[0]?.id || '', category: 'OTHER', description: '', amount: '' });

  const inputCls = 'w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-emerald-500';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await apiFetch('/api/admin/expenses', 'POST', { ...form, amount: Number(form.amount) });
      setShowModal(false);
      setForm({ branchId: branches[0]?.id || '', category: 'OTHER', description: '', amount: '' });
      router.refresh();
    } catch {
      setFormError(t('operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-sm text-slate-100">{isAr ? 'مصروفات التشغيل' : 'Operating expenses'}</h3>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all">
          <Plus className="w-4 h-4" />
          {t('newExpense')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>
              <th className="pb-2">{isAr ? 'الرقم' : 'No.'}</th>
              <th className="pb-2">{isAr ? 'الفرع' : 'Branch'}</th>
              <th className="pb-2">{isAr ? 'التصنيف' : 'Category'}</th>
              <th className="pb-2">{isAr ? 'البيان' : 'Description'}</th>
              <th className="pb-2">{isAr ? 'المبلغ' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-900/50">
                <td className="py-2.5 font-bold text-amber-400">{e.expenseNumber}</td>
                <td className="py-2.5 text-slate-300">{isAr ? e.branch.name : e.branch.nameEn}</td>
                <td className="py-2.5 text-slate-400">{e.category}</td>
                <td className="py-2.5 text-slate-200">{e.description}</td>
                <td className="py-2.5 font-black text-rose-400">{e.amount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}
      </div>

      {showModal && (
        <Modal title={t('newExpense')} onClose={() => setShowModal(false)}>
          <form onSubmit={submit} className="space-y-3 text-xs">
            {formError && <div role="alert" className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} className={inputCls}>
                {branches.map((b) => <option key={b.id} value={b.id}>{isAr ? b.name : b.nameEn}</option>)}
              </select>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input required placeholder={isAr ? 'بيان المصروف' : 'Description'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
            <input required type="number" min="1" placeholder={isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold transition-all">
              {saving ? t('loading') : t('confirm')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
