import React from 'react';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import ReturnsManager from '@/components/admin/ReturnsManager';

export const dynamic = 'force-dynamic';

export default async function AdminReturnsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const [rows, branches, grouped] = await Promise.all([
    prisma.returnRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: { include: { product: { select: { nameAr: true } } } },
        branch: { select: { name: true } },
        order: { select: { orderNumber: true } },
        sale: { select: { saleNumber: true } },
        refunds: { select: { status: true, amount: true } },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.returnRequest.groupBy({ by: ['status'], _count: true }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count;
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">المرتجعات والاستبدال</h1>
        <p className="text-xs text-slate-400 mt-0.5">مسار واحد لكل المرتجعات — الأولوية لما يحتاج إجراءً</p>
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
