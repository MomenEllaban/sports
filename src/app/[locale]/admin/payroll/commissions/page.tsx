import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { Percent, TrendingUp, DollarSign, Award, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollCommissionsPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [employees, sales] = await Promise.all([
    prisma.employee.findMany({
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
      },
    }),
    prisma.sale.findMany({
      where: { paymentStatus: 'PAID' },
      select: {
        id: true,
        cashierId: true,
        totalAmount: true,
        createdAt: true,
      },
    }),
  ]);

  // Map employee userIds
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  // Calculate commissions
  const employeeCommissions = employees.map((emp) => {
    // Match sales where cashierId matches emp.userId or emp.id
    const empSales = sales.filter(
      (s) => s.cashierId === emp.userId || s.cashierId === emp.id
    );

    const totalSalesAchieved = empSales.reduce((acc, s) => acc + num(s.totalAmount), 0);
    const rate = emp.commissionRate || 0;
    const earnedCommission = totalSalesAchieved * rate;

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      roleTitle: emp.roleTitle,
      branchName: isAr ? emp.branch.name : (emp.branch.nameEn || emp.branch.name),
      rate,
      salesCount: empSales.length,
      totalSalesAchieved,
      earnedCommission,
    };
  });

  const totalCommissionsEarned = employeeCommissions.reduce((acc, e) => acc + e.earnedCommission, 0);
  const totalSalesTracked = employeeCommissions.reduce((acc, e) => acc + e.totalSalesAchieved, 0);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-400" />
          {L('حساب عمولات ونسب مبيعات الموظفين', 'Sales Commission Tracking & Payouts')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'حساب آلي للعمولات بناءً على إجمالي مبيعات كل كاشير أو بائع في نقاط البيع والنسبة المحددة بعقده.',
            'Automated commission calculation based on live POS sales per staff member and contracted rates.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي العمولات المستحقة', 'Total Earned Commissions')}</p>
          <p className="text-2xl font-black text-amber-400">
            {totalCommissionsEarned.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('مستحقة عن المبيعات المحققة', 'accrued from sales')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('مبيعات فريق العمل المرتبطة', 'Attributed Sales Total')}</p>
          <p className="text-2xl font-black text-slate-100">
            {totalSalesTracked.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('إجمالي مبيعات البائعين', 'sales volume by reps')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('الموظفون بعمولة بيعية', 'Commission Eligible Staff')}</p>
          <p className="text-2xl font-black text-emerald-400">
            {employeeCommissions.filter((e) => e.rate > 0).length} / {employees.length}
          </p>
          <p className="text-[10px] text-slate-500">{L('نسبة عمولة محددة بعقودهم', 'with active commission rate')}</p>
        </div>
      </div>

      {/* Commission Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Percent className="w-4 h-4 text-amber-400" />
          {L('تفصيل عمولات الموظفين', 'Staff Commission Breakdown')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الموظف', 'Employee')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('الفرع والمسمى', 'Branch & Role')}</th>
                <th className="py-2.5 px-4 text-center font-semibold">{L('نسبة العمولة', 'Commission Rate')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('عدد الفواتير', 'Transactions')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('إجمالي المبيعات', 'Total Sales')}</th>
                <th className="py-2.5 px-4 text-end font-semibold">{L('العمولة المستحقة', 'Earned Commission')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {employeeCommissions.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-900/40">
                  <td className="py-3 px-4 font-bold text-slate-200">{emp.name}</td>
                  <td className="py-3 px-4 text-slate-400">
                    <span className="text-slate-300 font-semibold">{emp.roleTitle}</span> · {emp.branchName}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono font-bold">
                      {(emp.rate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-end font-mono text-slate-300">{emp.salesCount}</td>
                  <td className="py-3 px-4 text-end font-mono text-slate-200">
                    {emp.totalSalesAchieved.toLocaleString()} {currencyLabel}
                  </td>
                  <td className="py-3 px-4 text-end font-mono font-black text-amber-400 text-sm">
                    {emp.earnedCommission.toLocaleString()} {currencyLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
