import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import QuotationsManager from '@/components/admin/QuotationsManager';
import { num } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function QuotationsPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const allowedBranches = scopedBranchIds(session);
  const branchWhere = allowedBranches === null ? { isActive: true } : { id: { in: allowedBranches }, isActive: true };

  const [branches, customers, products] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true, nameEn: true, sku: true, price: true },
      orderBy: { nameAr: 'asc' },
      take: 500,
    }),
  ]);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {L('عروض الأسعار', 'Quotations')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'إنشاء عروض أسعار رسمية للعملاء، ومتابعة فترات الصلاحية، وتحويلها إلى فواتير مبيعات بنقرة واحدة.',
            'Create official quotations, track validity periods, and convert accepted quotes to sales invoices.'
          )}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 animate-fade-up">
        <QuotationsManager
          branches={branches}
          customers={customers}
          products={products.map((p) => ({
            ...p,
            price: num(p.price),
          }))}
        />
      </div>
    </>
  );
}
