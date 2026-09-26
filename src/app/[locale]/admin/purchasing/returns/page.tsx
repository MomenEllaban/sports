import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { num } from '@/lib/pricing';
import SupplierReturnsManager from '@/components/admin/SupplierReturnsManager';

export const dynamic = 'force-dynamic';

export default async function SupplierReturnsPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const allowedBranches = scopedBranchIds(session);
  const branchWhere = allowedBranches === null ? {} : { branchId: { in: allowedBranches } };

  const [logs, purchaseOrders] = await Promise.all([
    prisma.inventoryLog.findMany({
      where: {
        type: 'PURCHASE_RETURN',
        ...branchWhere,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { nameAr: true, nameEn: true, sku: true } },
        branch: { select: { name: true, nameEn: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        ...branchWhere,
        items: { some: { quantityReceived: { gt: 0 } } },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, nameAr: true, nameEn: true, sku: true } },
          },
        },
      },
    }),
  ]);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {L('مرتجعات الموردين (Supplier Returns)', 'Supplier Returns')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'إدارة إرجاع البضائع التالفة أو المخالفة للمواصفات إلى الموردين، وخصمها ذريًا من رصيد المخزون مع توثيق السجل.',
            'Manage vendor returns of damaged/defective stock, automatically decrementing branch inventory with audit trail.'
          )}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 animate-fade-up">
        <SupplierReturnsManager
          returnLogs={logs.map((l) => ({
            id: l.id,
            referenceId: l.referenceId,
            changeQuantity: l.changeQuantity,
            newQuantity: l.newQuantity,
            createdAt: l.createdAt.toISOString(),
            notes: l.notes,
            product: l.product,
            branch: l.branch,
          }))}
          eligiblePurchaseOrders={purchaseOrders.map((po) => ({
            id: po.id,
            poNumber: po.poNumber,
            status: po.status,
            branch: po.branch,
            supplier: po.supplier,
            items: po.items.map((i) => ({
              id: i.id,
              productId: i.productId,
              quantityOrdered: i.quantityOrdered,
              quantityReceived: i.quantityReceived,
              unitCost: num(i.unitCost),
              product: i.product,
            })),
          }))}
        />
      </div>
    </>
  );
}
