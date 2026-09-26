import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import GoodsReceivingManager, { ReceivingPurchaseOrder } from '@/components/admin/GoodsReceivingManager';

export const dynamic = 'force-dynamic';

export default async function AdminPurchasingReceivingPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const actor = session as unknown as { user?: { role?: string; branchIds?: string[] } };

  const rawOrders = await prisma.purchaseOrder.findMany({
    where: actor.user?.role === 'SUPER_ADMIN' ? undefined : { branch: { id: { in: actor.user?.branchIds || [] } } },
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: true,
      branch: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
              sku: true,
            },
          },
        },
      },
    },
  });

  const purchaseOrders: ReceivingPurchaseOrder[] = rawOrders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    branchId: po.branchId,
    branchName: isAr ? po.branch.name : (po.branch.nameEn || po.branch.name),
    status: po.status as ReceivingPurchaseOrder['status'],
    totalAmount: num(po.totalAmount),
    createdAt: po.createdAt.toISOString(),
    items: po.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productNameAr: it.product.nameAr,
      productNameEn: it.product.nameEn,
      sku: it.product.sku,
      quantityOrdered: it.quantityOrdered,
      quantityReceived: it.quantityReceived,
      unitCost: num(it.unitCost),
    })),
  }));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'استلام وفحص شحنات المشتريات (Goods Receiving)' : 'Goods Receiving & Inspection (GRN)'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'فحص ومطابقة كميات البضائع الواردة من الموردين وإدخالها فورياً إلى رصيد المخزن'
            : 'Inspect incoming supplier shipments, record verified quantities, and update branch inventory'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <GoodsReceivingManager purchaseOrders={purchaseOrders} />
      </div>
    </>
  );
}
