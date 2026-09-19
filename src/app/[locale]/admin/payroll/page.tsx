import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import PayrollManager from '@/components/admin/PayrollManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const [employees, runs] = await Promise.all([
    prisma.employee.findMany({ include: { branch: true } }),
    prisma.payrollRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { employee: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100">مرتبات الموظفين والعمولات (Payroll System)</h1>
            <p className="text-xs text-slate-400 mt-0.5">إدارة أجور الموظفين بالفروع والنسب المؤوية من المبيعات (Commissions)</p>
          </div>

          {/* Employees List */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-100">فريق العمل ومستحقات الموظفين</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">اسم الموظف</th>
                    <th className="p-3">المسمى الوظيفي</th>
                    <th className="p-3">الفرع</th>
                    <th className="p-3">الراتب الأساسي</th>
                    <th className="p-3">نسبة العمولة</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-slate-100">{emp.name}</td>
                      <td className="p-3 text-slate-300">{emp.roleTitle}</td>
                      <td className="p-3 text-slate-400">{emp.branch.name}</td>
                      <td className="p-3 font-black text-emerald-400">{num(emp.salary).toLocaleString()} ج.م</td>
                      <td className="p-3 font-bold text-amber-400">{(emp.commissionRate * 100).toFixed(0)}% من المبيعات</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">نشط</span>
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
        </main>
      </div>
    </div>
  );
}
