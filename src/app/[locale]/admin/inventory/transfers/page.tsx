import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { ArrowLeftRight } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import TransfersManager from '@/components/admin/TransfersManager';

export const dynamic = 'force-dynamic';

export default async function AdminTransfersPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const allowed = scopedBranchIds(session);
  // A transfer needs access to BOTH ends, so the picker only offers the
  // branches this user is actually allowed to move stock between.
  const [branches, products] = await Promise.all([
    prisma.branch.findMany({
      where: allowed === null ? { isActive: true } : { isActive: true, id: { in: allowed } },
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    }),
  ]);

  return (
    <>
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-amber-400" />
              {isAr ? 'أوامر التحويل بين الفروع' : 'Inter-branch transfer orders'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? 'اعتماد ثم شحن ثم استلام: المخزون يخرج من الفرع المصدر عند الشحن ويدخل الفرع المستلم عند الاستلام'
                : 'Approve, then ship, then receive: stock leaves the source on shipment and enters the destination on receipt'}
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <TransfersManager branches={branches} products={products} />
          </div>
        </>
  );
}
