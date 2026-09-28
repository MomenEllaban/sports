import React from 'react';
import { getLocale } from 'next-intl/server';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { num } from '@/lib/pricing';
import PurchaseInvoicesManager, { PurchaseInvoiceItem } from '@/components/admin/PurchaseInvoicesManager';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import {
  paidForOrder,
  paymentStateFor,
  receivedValueOf,
  outstandingFor,
  splitPayments,
} from '@/lib/purchasing/payables';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

/**
 * Ceiling for the outstanding-only view.
 *
 * "Outstanding" depends on received quantities and on how much cash is booked
 * against each order, so it cannot be expressed as a simple `where`. The normal
 * view paginates in the database; this view walks the open orders in memory, so
 * it needs a bound. Above it the UI says the list was truncated rather than
 * showing a silently wrong total.
 */
const OUTSTANDING_SCAN_LIMIT = 2000;

/** Orders that can still carry a payable. DRAFT and CANCELLED cannot. */
const OPEN_STATUSES: readonly PurchaseOrderStatus[] = ['SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

/** Exactly the shape the order query selects, so the row mapper cannot drift. */
const orderSelect = {
  id: true,
  poNumber: true,
  supplierId: true,
  totalAmount: true,
  status: true,
  createdAt: true,
  supplier: { select: { name: true } },
  branch: { select: { name: true, nameEn: true } },
  items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
  payments: { select: { amount: true, createdAt: true, purchaseOrderId: true } },
} as const;

type OrderRow = Prisma.PurchaseOrderGetPayload<{ select: typeof orderSelect }>;

export default async function AdminPurchasingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; supplierId?: string; unpaid?: string }>;
}) {
  const session = await requirePageRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const supplierFilter = typeof sp.supplierId === 'string' ? sp.supplierId : '';
  const unpaidOnly = sp.unpaid === '1';

  // A BRANCH_MANAGER only ever sees orders in their own branches, and therefore
  // only the payments that settle those orders.
  const allowedBranchIds = scopedBranchIds(session);
  const orderWhere = {
    ...(allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } }),
    ...(supplierFilter ? { supplierId: supplierFilter } : {}),
  };

  const [suppliers, scoped] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    // The full matching set with its payments. One query instead of a page of
    // orders plus an unbounded payment list, and it is what makes the balance
    // attribution exact.
    prisma.purchaseOrder.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: OUTSTANDING_SCAN_LIMIT,
      select: orderSelect,
    }),
  ]);

  const { attributed, unattributedTotal } = splitPayments(
    scoped.flatMap((po) =>
      po.payments.map((p) => ({
        amount: num(p.amount),
        createdAt: p.createdAt.toISOString(),
        purchaseOrderId: p.purchaseOrderId,
      })),
    ),
  );

  const toRow = (po: OrderRow): PurchaseInvoiceItem => {
    const totalAmount = num(po.totalAmount);
    // Undelivered lines are not yet a payable, so the commitment is the
    // received share of the order value. T10: Decimal converts at this boundary.
    const committed = receivedValueOf(
      { totalAmount },
      po.items.map((item) => ({
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        unitCost: num(item.unitCost),
      })),
    );
    const paid = paidForOrder({ id: po.id, totalAmount }, attributed);
    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      branchName: isAr ? po.branch.name : po.branch.nameEn || po.branch.name,
      totalAmount,
      committed,
      paidAmount: paid,
      outstandingBalance: outstandingFor(committed, paid),
      status: po.status,
      paymentStatus: paymentStateFor(paid, committed),
      createdAt: po.createdAt.toISOString(),
      itemsCount: po.items.length,
    };
  };

  const allRows = scoped.map(toRow);
  // Unpaid is derived, not a `where`: it depends on received quantities and on
  // cash booked against each order. The two counts are kept apart so the "All"
  // button never shows the unpaid total just because the filter is on.
  const unpaidRows = allRows.filter(
    (row) => OPEN_STATUSES.includes(row.status) && row.outstandingBalance > 0,
  );
  const matching = unpaidOnly ? unpaidRows : allRows;

  const total = matching.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = matching.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        <PurchaseInvoicesManager
          invoices={visible}
          suppliers={suppliers}
          totalCount={total}
          allCount={allRows.length}
          unpaidCount={unpaidRows.length}
          page={safePage}
          totalPages={totalPages}
          unpaidOnly={unpaidOnly}
          selectedSupplierId={supplierFilter}
          totals={{ unattributed: unattributedTotal }}
          truncated={scoped.length >= OUTSTANDING_SCAN_LIMIT}
        />
      </div>
    </>
  );
}
