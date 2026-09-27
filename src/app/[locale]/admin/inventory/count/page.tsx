import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import StocktakeClient from '@/components/admin/StocktakeClient';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import type { AppSession } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function StocktakePage() {
  const session = (await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER')) as AppSession;
  const isAr = (await getLocale()) === 'ar';
  const allowed = scopedBranchIds(session);
  const branchScope = allowed === null ? {} : { id: { in: allowed } };

  const [branches, sessions, categories, brands] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true, ...branchScope },
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
    prisma.stocktakeSession.findMany({
      where: allowed === null ? {} : { branchId: { in: allowed } },
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    // Filter options only. The line items of a session are resolved server-side
    // from the branch's own inventory, so the page no longer ships the whole
    // catalogue (previously 5000 products) to the browser.
    prisma.category.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: 'asc' } }),
    prisma.brand.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: 'asc' } }),
  ]);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'الجرد وتسوية المخزون' : 'Stocktake & inventory reconciliation'}
        </h1>
        <p className="text-xs text-slate-400">
          {isAr
            ? 'جلسة جرد تغطي أصناف فرع واحد: احفظ مسودة، راجع الفروقات، ثم اعتمد ذريًا مع سجل InventoryLog.'
            : 'One session per branch: save a draft, review the variances, then approve atomically with an InventoryLog trail.'}
        </p>
      </div>
      <StocktakeClient
        branches={branches}
        categories={categories}
        brands={brands}
        sessions={sessions.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          startedAt: item.startedAt.toISOString(),
          approvedAt: item.approvedAt?.toISOString() || null,
        }))}
      />
    </>
  );
}
