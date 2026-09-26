import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import CustomerLedgerManager, { CustomerLedgerEntry } from '@/components/admin/CustomerLedgerManager';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerLedgerPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const rawCustomers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paidAmount: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          paymentStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      sales: {
        select: {
          id: true,
          saleNumber: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const customers: CustomerLedgerEntry[] = rawCustomers.map((c) => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;
    let unpaidInvoicesCount = 0;

    const invoicesList: CustomerLedgerEntry['invoices'] = [];

    // Aggregate B2B/AR invoices
    c.invoices.forEach((inv) => {
      const invTotal = num(inv.total);
      const invPaid = num(inv.paidAmount);
      const invBalance = Math.max(0, invTotal - invPaid);

      totalInvoiced += invTotal;
      totalPaid += invPaid;
      outstandingBalance += invBalance;

      if (invBalance > 0) unpaidInvoicesCount++;

      invoicesList.push({
        id: inv.id,
        number: inv.invoiceNumber,
        date: inv.createdAt.toISOString(),
        total: invTotal,
        paid: invPaid,
        balance: invBalance,
        status: inv.status,
      });
    });

    // Aggregate online/POS orders where customer bought directly
    c.orders.forEach((o) => {
      const oTotal = num(o.totalAmount);
      totalInvoiced += oTotal;
      if (o.paymentStatus === 'PAID') {
        totalPaid += oTotal;
      } else {
        outstandingBalance += oTotal;
        unpaidInvoicesCount++;
        invoicesList.push({
          id: o.id,
          number: o.orderNumber,
          date: o.createdAt.toISOString(),
          total: oTotal,
          paid: 0,
          balance: oTotal,
          status: o.paymentStatus,
        });
      }
    });

    // POS sales are usually paid at counter
    c.sales.forEach((s) => {
      const sTotal = num(s.totalAmount);
      totalInvoiced += sTotal;
      totalPaid += sTotal;
    });

    const allDates = [
      ...c.invoices.map((i) => i.createdAt),
      ...c.orders.map((o) => o.createdAt),
      ...c.sales.map((s) => s.createdAt),
    ].sort((a, b) => b.getTime() - a.getTime());

    const lastActivityDate = allDates[0] ? allDates[0].toISOString() : null;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      transactionsCount: c.invoices.length + c.orders.length + c.sales.length,
      lastActivityDate,
      unpaidInvoicesCount,
      invoices: invoicesList,
    };
  });

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'السجل المالي وحسابات العملاء (AR Ledger)' : 'Customer Financial Ledger & Receivables'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'متابعة الذمم المدينة، المديونيات المستحقة، كشوف الحسابات التفصيلية، وتذكيرات السداد'
            : 'Track accounts receivable, due customer balances, statement breakdowns, and payment reminders'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <CustomerLedgerManager customers={customers} />
      </div>
    </>
  );
}
