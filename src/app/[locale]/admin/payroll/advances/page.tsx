import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { BadgeMinus, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { TABLE_PAGE_SIZE } from '@/lib/table-paging';
import ServerTablePager from '@/components/admin/ServerTablePager';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ page?: string }>;

const PAGE_SIZE = TABLE_PAGE_SIZE;

export default async function AdminPayrollAdvancesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const page = Math.max(1, Number((await searchParams).page || 1) || 1);

  const runs = await prisma.payrollRun.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        where: {
          OR: [
            { deductions: { gt: 0 } },
            { bonus: { gt: 0 } },
          ],
        },
        include: {
          employee: {
            include: { branch: { select: { name: true, nameEn: true } } },
          },
        },
      },
    },
    take: 5000,
  });

  const adjustmentItems: Array<{
    id: string;
    employeeName: string;
    branchName: string;
    period: string;
    deductions: number;
    bonus: number;
    netSalary: number;
  }> = [];

  for (const r of runs) {
    for (const item of r.items) {
      adjustmentItems.push({
        id: item.id,
        employeeName: item.employee.name,
        branchName: isAr ? item.employee.branch.name : (item.employee.branch.nameEn || item.employee.branch.name),
        period: `${r.periodMonth} / ${r.periodYear}`,
        deductions: num(item.deductions),
        bonus: num(item.bonus),
        netSalary: num(item.netSalary),
      });
    }
  }

  const totalDeductions = adjustmentItems.reduce((acc, i) => acc + i.deductions, 0);
  const totalBonuses = adjustmentItems.reduce((acc, i) => acc + i.bonus, 0);

  const pageRows = adjustmentItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <BadgeMinus className="w-6 h-6 text-rose-400" />
          {L('سجل السلف والخصومات والجزاءات', 'Salary Advances & Deductions Ledger')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'متابعة الخصومات التأديبية وسلف الموظفين المسحوبة والمخصومة من كشف المرتبات الشهري.',
            'Track salary advances, disciplinary deductions, and performance bonuses applied to payroll.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي الخصومات والسلف', 'Total Deductions')}</p>
          <p className="text-2xl font-black text-rose-400">
            {totalDeductions.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('مخصومة من كشوف المرتبات', 'deducted from payslips')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي المكافآت والحوافز', 'Total Bonuses')}</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalBonuses.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('مضافة للمرتبات', 'added to base salary')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('الحركات المسجلة', 'Recorded Adjustments')}</p>
          <p className="text-2xl font-black text-slate-100">{adjustmentItems.length}</p>
          <p className="text-[10px] text-slate-500">{L('قيد خصم أو مكافأة', 'adjustments on record')}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          {L('سجل قيود الخصم والمكافأة', 'Deduction & Bonus Records')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[650px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الموظف', 'Employee')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الفرع', 'Branch')}</th>
                <th className="py-2.5 px-4 text-center font-semibold">{L('الفترة (الشهر/السنة)', 'Period (M/Y)')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('الخصم / السلفة', 'Deduction')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('المكافأة', 'Bonus')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('صافي المرتب', 'Net Salary')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {adjustmentItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {L('لا توجد خصومات أو سلف مسجلة حالياً', 'No deductions or advances recorded yet')}
                  </td>
                </tr>
              ) : (
                pageRows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-bold text-slate-200">{item.employeeName}</td>
                    <td className="py-3 px-4 text-slate-400">{item.branchName}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {item.period}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-bold text-rose-400">
                      {item.deductions > 0 ? `-${item.deductions.toLocaleString()} ${currencyLabel}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-bold text-emerald-400">
                      {item.bonus > 0 ? `+${item.bonus.toLocaleString()} ${currencyLabel}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-black text-slate-100">
                      {item.netSalary.toLocaleString()} {currencyLabel}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ServerTablePager
          page={page}
          total={adjustmentItems.length}
          hrefFor={(n) => (n > 1 ? `/admin/payroll/advances?page=${n}` : '/admin/payroll/advances')}
          isAr={isAr}
        />
      </div>
    </>
  );
}
