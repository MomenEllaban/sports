import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import AbandonedCartsManager, { AbandonedCartItem } from '@/components/admin/AbandonedCartsManager';

export const dynamic = 'force-dynamic';

export default async function AdminAbandonedCartsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  // Find orders where payment is UNPAID or PENDING, or order was left in PENDING status
  const rawOrders = await prisma.order.findMany({
    where: {
      OR: [
        { paymentStatus: { in: ['PENDING', 'FAILED'] } },
        { orderStatus: 'PENDING' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      customer: { select: { name: true, phone: true } },
      items: {
        include: {
          product: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
  });

  const carts: AbandonedCartItem[] = rawOrders.map((o) => {
    const custName = o.customer?.name || o.guestName || (isAr ? 'عميل زائر' : 'Guest Shopper');
    const custPhone = o.customer?.phone || o.guestPhone || '';
    const itemsSummary = o.items
      .map((it) => (isAr ? it.product.nameAr : it.product.nameEn))
      .slice(0, 3)
      .join('، ');

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: custName,
      customerPhone: custPhone,
      deliveryAddress: o.deliveryAddress,
      totalAmount: num(o.totalAmount),
      itemsCount: o.items.reduce((s, it) => s + it.quantity, 0),
      itemsSummary: itemsSummary || (isAr ? 'منتجات رياضية' : 'Sports goods'),
      createdAt: o.createdAt.toISOString(),
      paymentMethod: o.paymentMethod,
    };
  });

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'استعادة السلات المتروكة (Abandoned Carts Recovery)' : 'Abandoned Carts Recovery'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'متابعة العملاء الذين تركوا سلات الشراء دون إكمال الدفع، وإرسال رسائل استعادة ترويجية فورية عبر واتساب'
            : 'Track checkout drop-offs, recover lost revenue, and send automated WhatsApp recovery discounts'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <AbandonedCartsManager carts={carts} />
      </div>
    </>
  );
}
