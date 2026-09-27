import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import ReturnsManager from '@/components/admin/ReturnsManager';
import { ArrowLeftRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminReturnsExchangesPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [rows, branches, grouped] = await Promise.all([
    prisma.returnRequest.findMany({
      where: { type: 'EXCHANGE' },
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
    prisma.returnRequest.groupBy({
      by: ['status'],
      where: { type: 'EXCHANGE' },
      _count: true,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.status] = g._count;

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-blue-400" />
          {L('طلبات وعمليات الاستبدال الفوري', 'Product Exchanges & Swaps')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'متابعة طلبات استبدال المقاسات والموديلات في الفروع والمتجر، مع ربط فاتورة البيع البديلة.',
            'Track product size/color exchanges across branches and storefront with linked exchange sales.'
          )}
        </p>
      </div>
      <ReturnsManager
        initial={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          refunds: r.refunds.map((f) => ({ ...f, amount: Number(f.amount) })),
        }))}
        branches={branches}
        counts={counts}
        filterType="EXCHANGE"
      />
    </>
  );
}
