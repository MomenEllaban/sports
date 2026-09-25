import React from 'react';
import { getLocale } from 'next-intl/server';
import BranchManager from '@/components/admin/BranchManager';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminBranchesPage() {
  await requirePageRole('SUPER_ADMIN');
  const isAr = (await getLocale()) === 'ar';
  const branches = await prisma.branch.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <>
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100">{isAr ? 'إدارة الفروع ونقاط البيع' : 'Branches & points of sale'}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr ? 'إنشاء فرع يولّد أرصدة مخزون صفرية لكل الأصناف تلقائياً — التعطيل محظور أثناء وجود مخزون' : 'Creating a branch automatically creates zero stock balances for every item; deactivation is blocked while stock exists.'}
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <BranchManager branches={branches} />
          </div>
        </>
  );
}
