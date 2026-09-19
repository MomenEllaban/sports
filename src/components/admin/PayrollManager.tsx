'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { StatusBadge, ActionButton, apiFetch } from './ui';
import { useToast } from '@/components/Toast';
import Pagination from './Pagination';

interface RunRow {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  totalAmount: number;
  items: Array<{
    id: string;
    baseSalary: number;
    bonus: number;
    deductions: number;
    commissionAmount: number;
    netSalary: number;
    employee: { name: string };
  }>;
}

export default function PayrollManager({ runs }: { runs: RunRow[] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;
  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRuns = runs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const runPayroll = async () => {
    setError('');
    try {
      await apiFetch('/api/admin/payroll-runs', 'POST', {});
      toast(t('operationSuccess'), 'success');
      router.refresh();
    } catch {
      const msg = t('operationFailed');
      setError(msg);
      toast(msg, 'error');
    }
  };

  const transition = async (id: string, action: 'approve' | 'pay') => {
    await apiFetch(`/api/admin/payroll-runs/${id}`, 'POST', { action });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <span className="text-xs text-slate-400">{isAr ? 'دورات المرتبات الشهرية' : 'Monthly payroll runs'}</span>
        <button onClick={runPayroll} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="w-4 h-4" />
          {t('newPayrollRun')}
        </button>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}

      {runs.length === 0 && <div className="text-center text-xs text-slate-500 py-8">{t('noData')}</div>}

      {pagedRuns.map((run) => (
        <div key={run.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <span className="font-extrabold text-slate-100">
              {isAr ? `مسير ${run.periodMonth}/${run.periodYear}` : `Payroll ${run.periodMonth}/${run.periodYear}`}
            </span>
            <StatusBadge value={run.status} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-2">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="pb-2">{isAr ? 'الأساسي' : 'Base'}</th>
                  <th className="pb-2">{isAr ? 'العمولة' : 'Commission'}</th>
                  <th className="pb-2">{isAr ? 'الصافي' : 'Net'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {run.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 font-bold text-slate-200">{i.employee.name}</td>
                    <td className="py-2 text-slate-400">{i.baseSalary.toLocaleString()}</td>
                    <td className="py-2 text-amber-400">{i.commissionAmount.toLocaleString()}</td>
                    <td className="py-2 font-black text-emerald-400">{i.netSalary.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="font-black text-slate-100">{isAr ? 'الإجمالي' : 'Total'}: {run.totalAmount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span>
            <div className="flex gap-2">
              {run.status === 'DRAFT' && (
                <ActionButton onAction={() => transition(run.id, 'approve')} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs">
                  {t('status_APPROVED')}
                </ActionButton>
              )}
              {run.status === 'APPROVED' && (
                <ActionButton onAction={() => transition(run.id, 'pay')} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
                  {isAr ? 'صرف المرتبات' : 'Mark as paid'}
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      ))}

      {runs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] font-bold text-slate-400">
            {isAr ? `${runs.length} مسير` : `${runs.length} payroll runs`}
          </span>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
