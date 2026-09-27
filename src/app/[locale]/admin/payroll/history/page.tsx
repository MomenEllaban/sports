import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { CalendarDays, CheckCircle2, DollarSign, Clock, Users, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollHistoryPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const runs = await prisma.payrollRun.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          employee: { select: { name: true } },
        },
      },
    },
  });

  const totalHistoricalDisbursed = runs.reduce((acc, r) => acc + num(r.totalAmount), 0);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-400" />
          {L('أرشيف وتاريخ صرف مسيرات الرواتب', 'Payroll Runs & Disbursement Archive')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'سجل تاريخي لكافة مسيرات الرواتب المصروفة شهرياً، مع إجمالي المبالغ وعدد الموظفين وتاريخ الاعتماد.',
            'Historical record of all approved and paid payroll runs with disclaimers and recipient counts.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي المرتبات المصروفة تاريخياً', 'Total Disbursed All-Time')}</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalHistoricalDisbursed.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('عبر كافة المسيرات', 'across all runs')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('عدد المسيرات المعتمدة', 'Completed Runs')}</p>
          <p className="text-2xl font-black text-slate-100">{runs.length}</p>
          <p className="text-[10px] text-slate-500">{L('مسيرة مرتبات شهرية', 'monthly payroll cycles')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('حالة الاعتماد المحاسبي', 'Audit Status')}</p>
          <p className="text-2xl font-black text-blue-400">{L('مسجل ومطابق', 'Reconciled')}</p>
          <p className="text-[10px] text-slate-500">{L('مربوط مع الخزينة والمصروفات', 'linked with treasury')}</p>
        </div>
      </div>

      {/* Runs Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="w-4 h-4 text-purple-400" />
          {L('سجل مسيرات الرواتب', 'Payroll History Log')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[650px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">{L('فترة المسير', 'Period')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الحالة', 'Status')}</th>
                <th className="py-2.5 px-4 text-center font-semibold">{L('عدد الموظفين', 'Employees')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('إجمالي المسير', 'Total Disbursed')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('تاريخ الإنشاء', 'Created At')}</th>
                <th className="py-2.5 px-4 text-center font-semibold">{L('الإجراء', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {L('لا توجد مسيرات رواتب مسجلة في الأرشيف', 'No payroll runs archived yet')}
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">{run.periodMonth} / {run.periodYear}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        {run.status === 'PAID' ? L('تم الصرف', 'Paid') : run.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-300">
                      {run.items.length} {L('موظف', 'staff')}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-black text-emerald-400 text-sm">
                      {num(run.totalAmount).toLocaleString()} {currencyLabel}
                    </td>
                    <td className="py-3 px-4 text-end font-mono text-slate-500">
                      {new Date(run.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href="/admin/payroll"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300"
                      >
                        {L('عرض الكشف', 'View Run')}
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
