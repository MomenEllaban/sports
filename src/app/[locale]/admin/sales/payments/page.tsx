import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import CustomerPaymentsManager from '@/components/admin/CustomerPaymentsManager';

export const dynamic = 'force-dynamic';

export default async function SalesPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; invoiceId?: string }>;
}) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const { customerId, invoiceId } = await searchParams;

  const allowedBranches = scopedBranchIds(session);
  const branchWhere = allowedBranches === null ? { isActive: true } : { id: { in: allowedBranches }, isActive: true };

  const [branches, customers] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
      take: 300,
    }),
  ]);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {L('سندات القبض وتحصيل الدفعات', 'Customer Payments & Receipts')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'تسجيل المبالغ المقبوضة من العملاء، وإصدار سندات القبض الرسمية، وتوزيع السداد على الفواتير المستحقة.',
            'Record received payments, issue official receipts, and allocate funds against open customer invoices.'
          )}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 animate-fade-up">
        <CustomerPaymentsManager
          branches={branches}
          customers={customers}
          initialCustomerId={customerId}
          initialInvoiceId={invoiceId}
        />
      </div>
    </>
  );
}
