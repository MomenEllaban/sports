import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import EmployeesManager from '@/components/admin/EmployeesManager';
import { prisma } from '@/lib/db';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-100">إدارة الموظفين والكادر الوظيفي</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              إضافة وتعديل بيانات الموظفين لكل فرع — الراتب والمسمى الوظيفي ونسبة العمولة
            </p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <EmployeesManager employees={employees} branches={branches} />
          </div>
        </main>
      </div>
    </div>
  );
}
