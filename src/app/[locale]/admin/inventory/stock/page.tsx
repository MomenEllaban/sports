import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { Boxes } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import InventoryTable from '@/components/admin/InventoryTable';

export const dynamic = 'force-dynamic';

export default async function AdminStockPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const allowed = scopedBranchIds(session);
  const branches = await prisma.branch.findMany({
    where: allowed === null ? { isActive: true } : { isActive: true, id: { in: allowed } },
    select: { id: true, name: true, nameEn: true },
    orderBy: { name: 'asc' },
  });

  return (
    <>
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-sky-400" />
              {isAr ? 'أرصدة المخزون' : 'Stock balances'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? 'رصيد كل صنف في كل فرع من فروعك، مع قيمة المخزون بالتكلفة'
                : 'Per-branch balance for every item you own, valued at cost'}
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <InventoryTable view="stock" branches={branches} showAdjust />
          </div>
        </>
  );
}
