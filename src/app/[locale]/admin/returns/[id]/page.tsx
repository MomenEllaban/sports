import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';
import ReturnDetails from '@/components/admin/ReturnDetails';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReturnDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const role = (session?.user as { role?: string })?.role;
  const canAct = role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER';
  const { id } = await params;
  const r = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, name: true, nameEn: true } },
      order: { select: { id: true, orderNumber: true, totalAmount: true } },
      sale: { select: { id: true, saleNumber: true, totalAmount: true } },
      items: { include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true, images: true } } } },
      refunds: true,
    },
  });
  if (!r) notFound();
  return (
    <>
      <nav className="text-xs text-slate-400 flex items-center gap-2" aria-label="breadcrumb">
        <Link href="/admin/returns" className="hover:text-slate-200 min-h-[44px] flex items-center">{isAr ? 'المرتجعات' : 'Returns'}</Link>
        <span>/</span>
        <span className="font-mono font-bold text-slate-200" dir="ltr">{r.returnNumber}</span>
      </nav>
      <ReturnDetails
        canAct={canAct}
        data={{
          id: r.id,
          returnNumber: r.returnNumber,
          status: r.status,
          type: r.type,
          channel: r.channel,
          source: r.source,
          notes: r.notes,
          etaStatus: r.etaStatus,
          exchangeSaleId: r.exchangeSaleId,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          customerPhone: r.customerPhone,
          branch: r.branch,
          order: r.order ? { ...r.order, totalAmount: num(r.order.totalAmount) } : null,
          sale: r.sale ? { ...r.sale, totalAmount: num(r.sale.totalAmount) } : null,
          items: r.items.map((i) => ({
            ...i,
            refundAmount: num(i.refundAmount),
          })),
          refunds: r.refunds.map((f) => ({ ...f, amount: num(f.amount) })),
        }}
      />
    </>
  );
}
