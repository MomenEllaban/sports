import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import ReceivablesManager from '@/components/admin/ReceivablesManager';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, nameEn: true },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {L('ذمم العملاء والتحصيلات (Accounts Receivable)', 'Accounts Receivable & Collections')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'متابعة مديونيات العملاء، الفواتير المفتوحة والمتأخرة، وتتبع سجل التحصيلات وسندات القبض بدقة.',
            'Monitor customer debt, open and overdue invoices, and track payment receipts with precision.'
          )}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 animate-fade-up">
        <ReceivablesManager branches={branches} />
      </div>
    </>
  );
}
