import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import ReturnsManager from '@/components/admin/ReturnsManager';

export const dynamic = 'force-dynamic';

export default async function AdminReturnsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const [rows, branches, grouped] = await Promise.all([
    prisma.returnRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true } } } },
        branch: { select: { name: true, nameEn: true } },
        order: { select: { orderNumber: true } },
        sale: { select: { saleNumber: true } },
        refunds: { select: { status: true, amount: true } },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } }),
    prisma.returnRequest.groupBy({ by: ['status'], _count: true }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count;
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">{isAr ? 'المرتجعات والاستبدال' : 'Returns & Exchanges'}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{isAr ? 'مسار واحد لكل المرتجعات — الأولوية لما يحتاج إجراءً' : 'One workflow for every return — prioritizing items that need action'}</p>
      </div>
      <ReturnsManager
        initial={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          refunds: r.refunds.map((f) => ({ ...f, amount: Number(f.amount) })),
        }))}
        branches={branches}
        counts={counts}
      />
    </>
  );
}
