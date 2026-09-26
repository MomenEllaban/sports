import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import PurchaseInvoicesManager, { PurchaseInvoiceItem, SupplierOption } from '@/components/admin/PurchaseInvoicesManager';

export const dynamic = 'force-dynamic';

export default async function AdminPurchasingInvoicesPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const actor = session as unknown as { user?: { role?: string; branchIds?: string[] } };

  const [rawOrders, rawSuppliers, rawPayments] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: actor.user?.role === 'SUPER_ADMIN' ? undefined : { branch: { id: { in: actor.user?.branchIds || [] } } },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        branch: true,
        items: true,
      },
    }),
    prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.supplierPayment.findMany({
      select: { supplierId: true, amount: true, createdAt: true },
    }),
  ]);

  // Map supplier payments total
  const paymentsBySupplier: Record<string, number> = {};
  rawPayments.forEach((p) => {
    paymentsBySupplier[p.supplierId] = (paymentsBySupplier[p.supplierId] || 0) + num(p.amount);
  });

  const invoices: PurchaseInvoiceItem[] = rawOrders.map((po) => {
    const total = num(po.totalAmount);
    // If PO is received, consider the billing active
    // For demo/ERP reconciliation: calculate payments attributed to this PO or supplier
    const totalSupplierPaid = paymentsBySupplier[po.supplierId] || 0;
    // Estimate paid per order or full if received and supplier paid
    const isReceived = po.status === 'RECEIVED';
    const paid = isReceived && totalSupplierPaid >= total ? total : Math.min(total, totalSupplierPaid);
    const balance = Math.max(0, total - paid);
    const paymentStatus: PurchaseInvoiceItem['paymentStatus'] =
      balance === 0 && total > 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      branchName: isAr ? po.branch.name : (po.branch.nameEn || po.branch.name),
      totalAmount: total,
      paidAmount: paid,
      outstandingBalance: balance,
      status: po.status as PurchaseInvoiceItem['status'],
      paymentStatus,
      createdAt: po.createdAt.toISOString(),
      itemsCount: po.items.length,
    };
  });

  const suppliers: SupplierOption[] = rawSuppliers.map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'فواتير المشتريات ومطابقة الموردين (Purchase Invoices)' : 'Purchase Invoices & Bills'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'متابعة فواتير التوريد، مطابقة الفواتير مع الشحنات المستلمة، وتسجيل دفعات الموردين'
            : 'Track supplier bills, match invoice amounts to received stock, and record vendor disbursements'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <PurchaseInvoicesManager invoices={invoices} suppliers={suppliers} />
      </div>
    </>
  );
}
