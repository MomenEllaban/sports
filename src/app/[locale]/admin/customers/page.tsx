import React from 'react';
import { getLocale } from 'next-intl/server';
import CustomersManager from '@/components/admin/CustomersManager';
import { requirePageRole } from '@/lib/auth/require-page';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const { phone } = await searchParams;
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      orders: { select: { id: true } },
      addresses: { select: { street: true, city: true } },
    },
  });

  const serializable = customers.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <>
          <div>
            <h1 className="text-2xl font-black text-slate-100">{isAr ? 'دليل العملاء ونقاط الولاء' : 'Customer directory & loyalty'}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{isAr ? 'سجل العملاء التراكمي (الهوية برقم الموبايل) وسجل الطلبات' : 'Cumulative customer directory (identified by mobile) and order history'}</p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <CustomersManager customers={serializable} initialPhone={phone || ''} />
          </div>
        </>
  );
}
