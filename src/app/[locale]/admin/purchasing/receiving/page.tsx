import React from 'react';
import { getLocale } from 'next-intl/server';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import GoodsReceivingManager, { ReceivingPurchaseOrder } from '@/components/admin/GoodsReceivingManager';

export const dynamic = 'force-dynamic';

/**
 * How much closed history the receiving queue keeps.
 *
 * A receiving screen is about work still to do, plus a short tail for reference.
 * Without a bound, every order ever received stayed in the payload forever.
 */
const RECEIVED_HISTORY = 100;

const OPEN_STATUSES: PurchaseOrderStatus[] = ['SUBMITTED', 'PARTIALLY_RECEIVED'];

const select = {
  id: true,
  poNumber: true,
  supplierId: true,
  totalAmount: true,
  status: true,
  branchId: true,
  createdAt: true,
  supplier: { select: { name: true } },
  branch: { select: { name: true, nameEn: true } },
  items: {
    select: {
      id: true,
      productId: true,
      quantityOrdered: true,
      quantityReceived: true,
      unitCost: true,
      product: { select: { nameAr: true, nameEn: true, sku: true } },
    },
  },
} as const;

export default async function AdminPurchasingReceivingPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  // The previous `session as unknown as {...}` cast duplicated the branch-scope
  // rules and could drift from them.
  const allowedBranchIds = scopedBranchIds(session);
  const scope: Prisma.PurchaseOrderWhereInput =
    allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };

  // Two queries instead of "every order ever": the open queue in full, plus a
  // bounded slice of recently closed orders for the history tab. DRAFT and
  // CANCELLED orders are excluded because they can never be received.
  const [open, received] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { ...scope, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select,
    }),
    prisma.purchaseOrder.findMany({
      where: { ...scope, status: 'RECEIVED' },
      orderBy: { createdAt: 'desc' },
      take: RECEIVED_HISTORY,
      select,
    }),
  ]);

  const toRow = (po: Awaited<typeof open>[number]): ReceivingPurchaseOrder => ({
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    branchId: po.branchId,
    branchName: isAr ? po.branch.name : po.branch.nameEn || po.branch.name,
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
  });

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
        <GoodsReceivingManager purchaseOrders={[...open, ...received].map(toRow)} />
      </div>
    </>
  );
}
