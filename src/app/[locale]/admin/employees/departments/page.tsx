import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { Users, Briefcase, Building2, DollarSign, UserCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesDepartmentsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const employees = await prisma.employee.findMany({
    orderBy: { roleTitle: 'asc' },
    include: {
      branch: { select: { id: true, name: true, nameEn: true } },
    },
  });

  // Group employees by roleTitle
  const groups: Record<
    string,
    {
      roleTitle: string;
      employees: typeof employees;
      totalSalary: number;
    }
  > = {};

  for (const emp of employees) {
    const title = emp.roleTitle || (isAr ? 'موظف عام' : 'General Staff');
    if (!groups[title]) {
      groups[title] = {
        roleTitle: title,
        employees: [],
        totalSalary: 0,
      };
    }
    groups[title].employees.push(emp);
    groups[title].totalSalary += num(emp.salary);
  }

  const groupList = Object.values(groups).sort((a, b) => b.employees.length - a.employees.length);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-blue-400" />
          {L('الهيكل الوظيفي والأقسام (Departments & Roles)', 'Organizational Structure & Roles')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'توزيع الكادر الوظيفي حسب الأدوار والمسؤوليات، إحصائيات القوى العاملة، وإجمالي ميزانية الأجور لكل تخصص.',
            'Workforce distribution by job title and department with headcount and salary budgets.'
          )}
        </p>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي الموظفين', 'Total Headcount')}</p>
          <p className="text-2xl font-black text-slate-100">{employees.length}</p>
          <p className="text-[10px] text-slate-500">{L('في جميع الفروع', 'across all branches')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('عدد التخصصات والأدوار', 'Active Roles')}</p>
          <p className="text-2xl font-black text-blue-400">{groupList.length}</p>
          <p className="text-[10px] text-slate-500">{L('مسمى وظيفي معرف', 'defined job titles')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي فاتورة الأجور الشهرية', 'Monthly Salary Budget')}</p>
          <p className="text-2xl font-black text-emerald-400">
            {groupList.reduce((acc, g) => acc + g.totalSalary, 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('رواتب أساسية', 'base salaries')}</p>
        </div>
      </div>

      {/* Department Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groupList.map((group) => (
          <div key={group.roleTitle} className="glass-panel rounded-3xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-100">{group.roleTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {group.employees.length} {L('موظف', 'staff')} · {L('الميزانية:', 'Budget:')}{' '}
                  <span className="font-bold text-emerald-400">{group.totalSalary.toLocaleString()} {currencyLabel}</span>
                </p>
              </div>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-300">
                {group.employees.length} {L('أعضاء', 'members')}
              </span>
            </div>

            <div className="space-y-2">
              {group.employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-[11px]">
                      {emp.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-200">{emp.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono" dir="ltr">{emp.phone}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="font-bold text-emerald-400 font-mono">
                      {num(emp.salary).toLocaleString()} {currencyLabel}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {isAr ? emp.branch.name : (emp.branch.nameEn || emp.branch.name)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
