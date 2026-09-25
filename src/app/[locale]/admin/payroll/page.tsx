import React from 'react';
import { getLocale } from 'next-intl/server';
import PayrollManager from '@/components/admin/PayrollManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const [employees, runs] = await Promise.all([
    prisma.employee.findMany({ include: { branch: true } }),
    prisma.payrollRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { employee: true } } },
    }),
  ]);

  return (
    <>
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100">{L('مرتبات الموظفين والعمولات (Payroll System)', 'Payroll & commissions')}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{L('إدارة أجور الموظفين بالفروع والنسب المؤوية من المبيعات (Commissions)', 'Manage branch payroll and sales commission percentages.')}</p>
          </div>

          {/* Employees List */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-100">{L('فريق العمل ومستحقات الموظفين', 'Team & employee earnings')}</h3>
            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs text-start">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">{L('اسم الموظف', 'Employee name')}</th>
                    <th className="p-3">{L('المسمى الوظيفي', 'Job title')}</th>
                    <th className="p-3">{L('الفرع', 'Branch')}</th>
                    <th className="p-3">{L('الراتب الأساسي', 'Base salary')}</th>
                    <th className="p-3">{L('نسبة العمولة', 'Commission rate')}</th>
                    <th className="p-3">{L('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-slate-100">{emp.name}</td>
                      <td className="p-3 text-slate-300">{emp.roleTitle}</td>
                      <td className="p-3 text-slate-400">{isAr ? emp.branch.name : emp.branch.nameEn}</td>
                      <td className="p-3 font-black text-emerald-400">{num(emp.salary).toLocaleString()} {currencyLabel}</td>
                      <td className="p-3 font-bold text-amber-400">{(emp.commissionRate * 100).toFixed(0)}% {L('من المبيعات', 'of sales')}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">{L('نشط', 'Active')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <PayrollManager
              runs={runs.map((r) => ({
                ...r,
                totalAmount: num(r.totalAmount),
                items: r.items.map((i) => ({
                  ...i,
                  baseSalary: num(i.baseSalary),
                  bonus: num(i.bonus),
                  deductions: num(i.deductions),
                  commissionAmount: num(i.commissionAmount),
                  netSalary: num(i.netSalary),
                })),
              }))}
            />
          </div>
        </>
  );
}
