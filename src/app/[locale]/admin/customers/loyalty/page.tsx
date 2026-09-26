import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import CustomerLoyaltyManager, { CustomerLoyaltyItem } from '@/components/admin/CustomerLoyaltyManager';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerLoyaltyPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const [rawCustomers, earnSetting, pointValSetting] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { loyaltyPoints: 'desc' },
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
    }),
    prisma.setting.findUnique({ where: { key: 'loyalty.earnPerEgp' } }),
    prisma.setting.findUnique({ where: { key: 'loyalty.pointValueEgp' } }),
  ]);

  const earnRate = earnSetting ? Math.max(1, Number(earnSetting.value) || 10) : 10;
  const pointValue = pointValSetting ? Math.max(0.01, Number(pointValSetting.value) || 0.5) : 0.5;

  const customers: CustomerLoyaltyItem[] = rawCustomers.map((c) => {
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
    };
  });

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'برنامج ونقاط الولاء والمكافآت' : 'Customer Loyalty & Rewards Program'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'متابعة أرصدة نقاط العملاء، فئات التميز (بلاتيني، ذهبي، فضي)، تعديل الأرصدة، وإرسال إشعارات الاستبدال'
            : 'Track points balances, customer reward tiers, adjust balances with audit trails, and notify members'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <CustomerLoyaltyManager customers={customers} earnRate={earnRate} pointValue={pointValue} />
      </div>
    </>
  );
}
