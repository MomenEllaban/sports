import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import AttendanceManager from '@/components/admin/AttendanceManager';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const allowedBranches = scopedBranchIds(session);
  const branchWhere = allowedBranches === null ? { isActive: true } : { id: { in: allowedBranches }, isActive: true };

  const [branches, employees] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.findMany({
      where: {
        isActive: true,
        ...(allowedBranches === null ? {} : { branchId: { in: allowedBranches } }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        roleTitle: true,
        branchId: true,
        branch: { select: { name: true, nameEn: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {L('سجل الحضور والانصراف (Attendance Register)', 'Daily Attendance Register')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'متابعة حضور وانصراف الموظفين يوميًا، احتساب التأخير والغياب آليًا، وتعديل البصمات وفق صلاحيات الإدارة.',
            'Track daily employee attendance, automatic late/absence calculations, and manage punch records.'
          )}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 animate-fade-up">
        <AttendanceManager branches={branches} employees={employees} />
      </div>
    </>
  );
}
