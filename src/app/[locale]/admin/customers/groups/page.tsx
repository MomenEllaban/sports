import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import CustomerSegmentsManager, { CustomerSegmentItem } from '@/components/admin/CustomerSegmentsManager';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerGroupsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const rawCustomers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      orders: {
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      sales: {
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const customers: CustomerSegmentItem[] = rawCustomers.map((c) => {
    const allTransactions = [
      ...c.orders.map((o) => ({ amount: num(o.totalAmount), date: o.createdAt })),
      ...c.sales.map((s) => ({ amount: num(s.totalAmount), date: s.createdAt })),
    ];

    const totalSpent = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    const ordersCount = allTransactions.length;

    allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    const lastOrderDate = allTransactions[0] ? allTransactions[0].date.toISOString() : null;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      loyaltyPoints: c.loyaltyPoints,
      ordersCount,
      totalSpent,
      lastOrderDate,
      createdAt: c.createdAt.toISOString(),
    };
  });

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'مجموعات وشرائح العملاء' : 'Customer Segments & Groups'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'تصنيف تلقائي متقدم للعملاء (VIP، نشط، جديد، خامل) مع تحليلات الشراء والتواصل المباشر'
            : 'Automated RFM segmentation (VIP, Active, New, Inactive) with purchase analytics and direct communication'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <CustomerSegmentsManager customers={customers} />
      </div>
    </>
  );
}
