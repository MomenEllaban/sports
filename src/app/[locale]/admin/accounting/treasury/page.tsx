import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import TreasuryManager from '@/components/admin/TreasuryManager';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const [openShifts, allCodOrders, expensesSum, paymentsSum, recentShifts, recentExpenses, recentPayments] =
    await Promise.all([
      prisma.shift.findMany({
        where: { status: 'OPEN' },
        select: { openingFloat: true },
      }),
      prisma.order.findMany({
        where: { paymentMethod: 'COD' },
        select: { totalAmount: true, paymentStatus: true },
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
      }),
      prisma.customerPayment.aggregate({
        _sum: { amount: true },
      }),
      prisma.shift.findMany({
        take: 10,
        orderBy: { openedAt: 'desc' },
        include: {
          branch: { select: { name: true, nameEn: true } },
          cashier: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { branch: { select: { name: true, nameEn: true } } },
      }),
      prisma.customerPayment.findMany({
        take: 10,
        orderBy: { paidAt: 'desc' },
        include: {
          branch: { select: { name: true, nameEn: true } },
          customer: { select: { name: true } },
        },
      }),
    ]);

  const totalCashInTill = openShifts.reduce((acc, s) => acc + num(s.openingFloat), 0);
  const totalCodCollected = allCodOrders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((acc, o) => acc + num(o.totalAmount), 0);
  const totalCodPending = allCodOrders
    .filter((o) => o.paymentStatus !== 'PAID')
    .reduce((acc, o) => acc + num(o.totalAmount), 0);
  const totalExpensesDisbursed = num(expensesSum._sum.amount);
  const totalCustomerReceipts = num(paymentsSum._sum.amount);

  // Formulate recent combined cash transactions
  const txList: Array<{
    id: string;
    type: 'INFLOW' | 'OUTFLOW';
    category: string;
    amount: number;
    branchName: string;
    date: string;
    reference: string;
    notes: string | null;
  }> = [];

  recentPayments.forEach((p) => {
    txList.push({
      id: p.id,
      type: 'INFLOW',
      category: `${L('سند قبض عميل', 'Customer Receipt')} (${p.customer?.name || '—'})`,
      amount: num(p.amount),
      branchName: isAr ? p.branch.name : p.branch.nameEn,
      date: p.paidAt.toISOString(),
      reference: p.receiptNumber,
      notes: p.notes,
    });
  });

  recentExpenses.forEach((e) => {
    txList.push({
      id: e.id,
      type: 'OUTFLOW',
      category: `${L('مصروف تشغيلي', 'Operating Expense')} (${e.category})`,
      amount: num(e.amount),
      branchName: isAr ? e.branch.name : e.branch.nameEn,
      date: e.createdAt.toISOString(),
      reference: e.expenseNumber,
      notes: e.description,
    });
  });

  txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {L('الخزينة وحركة السيولة النقدية', 'Treasury & Cash Management')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'متابعة السيولة النقدية المتاحة، أرصدة أدراج الفروع، تسويات الدفع عند الاستلام، وتدفق المقبوضات والمصروفات.',
            'Track realized cash liquidity, branch till drawer balances, COD settlements, and net cash flow.'
          )}
        </p>
      </div>

      <div className="animate-fade-up">
        <TreasuryManager
          totalCashInTill={totalCashInTill}
          totalCodCollected={totalCodCollected}
          totalCodPending={totalCodPending}
          totalExpensesDisbursed={totalExpensesDisbursed}
          totalCustomerReceipts={totalCustomerReceipts}
          recentShifts={recentShifts.map((s) => ({
            id: s.id,
            shiftNumber: s.id.slice(-6).toUpperCase(),
            branchName: isAr ? s.branch.name : s.branch.nameEn,
            cashierName: s.cashier.name || '—',
            startingCash: num(s.openingFloat),
            actualCash: s.actualCash !== null ? num(s.actualCash) : null,
            cashDifference: s.difference !== null ? num(s.difference) : null,
            status: s.status,
            openedAt: s.openedAt.toISOString(),
            closedAt: s.closedAt?.toISOString() || null,
          }))}
          recentTransactions={txList.slice(0, 15)}
        />
      </div>
    </>
  );
}
