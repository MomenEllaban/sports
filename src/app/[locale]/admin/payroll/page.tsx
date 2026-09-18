import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { Briefcase, DollarSign, Plus, UserCheck } from 'lucide-react';

export const revalidate = 10;

export default async function AdminPayrollPage() {
  const employees = await prisma.employee.findMany({
    include: { branch: true },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-amber-500" />
                مرتبات الموظفين والعمولات (Payroll System)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة أجور الموظفين بالفروع والنسب المؤوية من المبيعات (Commissions)
              </p>
            </div>
            <button className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20">
              <Plus className="w-4 h-4" />
              إصدار مسير مرتبات الشهر الحالي
            </button>
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
                      <td className="p-3 font-black text-emerald-400">{emp.salary.toLocaleString()} ج.م</td>
                      <td className="p-3 font-bold text-amber-400">{(emp.commissionRate * 100).toFixed(0)}% من المبيعات</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                          نشط
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
