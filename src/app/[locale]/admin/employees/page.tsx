import React from 'react';
import EmployeesManager from '@/components/admin/EmployeesManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const [employees, branches] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { id: true, name: true, nameEn: true } } },
    }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } }),
  ]);

  return (
    <>
          <div>
            <h1 className="text-2xl font-black text-slate-100">إدارة الموظفين والكادر الوظيفي</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              إضافة وتعديل بيانات الموظفين لكل فرع — الراتب والمسمى الوظيفي ونسبة العمولة
            </p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <EmployeesManager
              employees={employees.map((e) => ({ ...e, salary: num(e.salary) }))}
              branches={branches}
            />
          </div>
        </>
  );
}
