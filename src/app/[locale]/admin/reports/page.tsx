import React from 'react';
import { prisma } from '@/lib/db';
import { BarChart3 } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import ReportsClient from '@/components/admin/ReportsClient';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-400" />
          التقارير التحليلية
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">الربحية، أداء الكاشير والشحن، والأصناف الميتة — بفلاتر وتصدير CSV</p>
      </div>
      <ReportsClient branches={branches} />
    </>
  );
}
