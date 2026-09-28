import React from 'react';
import { getLocale } from 'next-intl/server';
import type { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { Link } from '@/i18n/routing';
import SuppliersManager from '@/components/admin/SuppliersManager';
import SupplierPayments from '@/components/admin/SupplierPayments';
import ServerPagination from '@/components/admin/ServerPagination';
import { prisma } from '@/lib/db';
import { money, num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { receivedValueOf } from '@/lib/purchasing/payables';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const LEDGER_TAKE = 200;

/** Ceiling on the open-order scan that backs the statement totals. */
const SCAN_LIMIT = 2000;

/** Orders that can carry a payable. A DRAFT is not yet a commitment; a cancelled one never was. */
const OPEN_STATUSES: PurchaseOrderStatus[] = ['SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

const statementSelect = {
  id: true,
  poNumber: true,
  totalAmount: true,
  status: true,
  createdAt: true,
  branch: { select: { name: true, nameEn: true } },
  items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
  payments: { select: { amount: true, createdAt: true, purchaseOrderId: true } },
} as const;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; page?: string }>;
}) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const params = await searchParams;
  const selectedId = typeof params.supplierId === 'string' ? params.supplierId : '';
  const page = Math.max(1, Number(params.page || 1) || 1);

  const allowedBranchIds = scopedBranchIds(session);
  // A BRANCH_MANAGER must not see another branch's supplier spend or payments.
  const scope: Prisma.PurchaseOrderWhereInput =
    allowedBranchIds === null ? {} : { branchId: { in: allowedBranchIds } };

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      contactPerson: true,
      phone: true,
      email: true,
      address: true,
      taxNumber: true,
    },
  });
  const selected = suppliers.find((supplier) => supplier.id === selectedId) || null;

  // The statement is only meaningful for one supplier, so the order and payment
  // history is not fetched at all until one is chosen. Previously both ran
  // unconditionally, dragging every PO in the system into the response.
  const paymentScope: Prisma.SupplierPaymentWhereInput = {
    ...(selectedId ? { supplierId: selectedId } : {}),
    ...(allowedBranchIds === null
      ? {}
      : { OR: [{ purchaseOrder: null }, { purchaseOrder: { branchId: { in: allowedBranchIds } } }] }),
  };
  const orderScope: Prisma.PurchaseOrderWhereInput = {
    ...scope,
    ...(selectedId ? { supplierId: selectedId } : {}),
  };

  const [statement, orderTotal, openOrders, payments] = await Promise.all([
    // Both the history page and its count are only rendered for a chosen
    // supplier. Unscoped they read one supplier-sized page of every PO in the
    // branch just to feed an empty state.
    selectedId
      ? prisma.purchaseOrder.findMany({
          where: orderScope,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: statementSelect,
        })
      : Promise.resolve([]),
    selectedId ? prisma.purchaseOrder.count({ where: orderScope }) : Promise.resolve(0),
    // Bounded scan used only for the totals. A supplier statement has to cover
    // every open order, not the page on screen, and outstanding balance is not
    // expressible as a simple `where`, so this walks the open set. Past the cap
    // the figures are a lower bound and the UI says so rather than implying
    // completeness.
    //
    // It only runs once a supplier is actually chosen. Unscoped it walked up to
    // SCAN_LIMIT orders with their items and payments on every visit to the
    // page, purely to compute totals that the empty state does not render.
    selectedId
      ? prisma.purchaseOrder.findMany({
          where: { ...orderScope, status: { in: OPEN_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: SCAN_LIMIT,
          select: statementSelect,
        })
      : Promise.resolve([]),
    prisma.supplierPayment.findMany({
      where: paymentScope,
      orderBy: { createdAt: 'desc' },
      take: LEDGER_TAKE,
      select: {
        id: true,
        supplierId: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        createdAt: true,
        purchaseOrderId: true,
        supplier: { select: { name: true } },
      },
    }),
  ]);

  // The statement totals are computed over every open order, not over the page
  // being displayed. The old figures summed the full order value of every
  // non-cancelled order and then subtracted every payment the supplier had ever
  // received, so a partly delivered order looked fully owed and a single advance
  // was applied to all of their orders at once.
  //
  // `openOrders` also carries each order's own payments, which makes the paid
  // figure exact and independent of the 200-row ledger window below: deriving it
  // from the ledger would silently understate cash for a busy supplier.
  let committed = 0;
  let paid = 0;
  for (const po of openOrders) {
    const totalAmount = num(po.totalAmount);
    committed = money(
      committed +
        receivedValueOf(
          { totalAmount },
          po.items.map((i) => ({
            quantityOrdered: i.quantityOrdered,
            quantityReceived: i.quantityReceived,
            unitCost: num(i.unitCost),
          })),
        ),
    );
    paid = money(
      paid +
        po.payments
          .filter((p) => p.purchaseOrderId === po.id)
          .reduce((sum, p) => money(sum + num(p.amount)), 0),
    );
  }
  const balance = money(Math.max(0, committed - paid));
  // Advances carry no order, so they cannot offset an invoice. They are reported
  // instead of being spread across the supplier's open orders.
  const unattributedTotal = payments
    .filter((p) => !p.purchaseOrderId)
    .reduce((sum, p) => money(sum + num(p.amount)), 0);

  const totalPages = Math.max(1, Math.ceil(orderTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  // Clamp an out-of-range page (a stale bookmark, or a supplier switch) to the
  // last real page. Skipped with no supplier chosen, since there is no history
  // to re-read and the empty state renders regardless of `page`.
  const rows = !selectedId || safePage === page ? statement : await prisma.purchaseOrder.findMany({
    where: orderScope,
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: statementSelect,
  });

  const pageHref = (target: number) => {
    const qs = new URLSearchParams({ supplierId: selectedId });
    if (target > 1) qs.set('page', String(target));
    return `/admin/purchasing/suppliers?${qs.toString()}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-100">{L('دليل الموردين وكشف الحساب', 'Supplier directory & account statement')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{L('إدارة بيانات الموردين وأوامر التوريد وملخص الالتزامات والمدفوعات لكل مورد.', 'Manage supplier records, purchase orders, commitments, and payments per supplier.')}</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">{L('بيانات الموردين', 'Supplier records')}</h2>
        {/* This list is the only place a supplier is picked. It used to be
            repeated as a second row of chips above the statement, so the same
            names appeared twice on one page and neither copy carried the
            selection state. */}
        <SuppliersManager suppliers={suppliers} selectedId={selectedId} />
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h2 className="font-extrabold text-sm text-slate-100">
            {selected ? L(`كشف حساب: ${selected.name}`, `Statement: ${selected.name}`) : L('كشف الحساب', 'Account statement')}
          </h2>
          {selected && (
            <Link
              href="/admin/purchasing/suppliers"
              className="min-h-[44px] inline-flex items-center rounded-xl border border-slate-700 bg-slate-800/60 px-3 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              {L('إغلاق الكشف', 'Close statement')}
            </Link>
          )}
        </div>
        {selected ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-[11px] text-slate-400">{L('إجمالي المستحق (أوامر مفتوحة)', 'Total committed (open orders)')}</div>
                <div className="mt-1 text-xl font-black text-slate-100">{committed.toLocaleString()} {currencyLabel}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-[11px] text-slate-400">{L('المسدد لأوامر التوريد', 'Paid against orders')}</div>
                <div className="mt-1 text-xl font-black text-emerald-300">{paid.toLocaleString()} {currencyLabel}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="text-[11px] text-slate-400">{L('الرصيد', 'Balance')}</div>
                <div className={`mt-1 text-xl font-black ${balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{balance.toLocaleString()} {currencyLabel}</div>
              </div>
            </div>
            {unattributedTotal > 0 && (
              <p className="text-[11px] text-amber-300/90">
                {L(
                  `تشمل الدفعات ${unattributedTotal.toLocaleString()} ${currencyLabel} غير مخصصة لأمر محدد (دفعة مقدمة)، فلا تُخصم من أي فاتورة.`,
                  `Payments include ${unattributedTotal.toLocaleString()} ${currencyLabel} not tied to a specific order (an advance), so it is not deducted from any invoice.`,
                )}
              </p>
            )}
            {openOrders.length >= SCAN_LIMIT && (
              <p role="alert" className="text-[11px] font-bold text-amber-300">
                {L(
                  `عدد الأوامر المفتوحة أكبر من الحد(${SCAN_LIMIT})، فالأرقام أعلاه حد أدنى وليست كاملة.`,
                  `This supplier has more than ${SCAN_LIMIT} open orders, so the totals above are a lower bound rather than complete.`,
                )}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              {L(
                'الملخص يغطي كل أوامر المورد المفتوحة، ويحتسب قيمة الأصناف المستلمة فعليًا؛ الجدول أدناه صفحة واحدة من السجل، استخدم التصفحات للوصول للأوامر الأقدم.',
                'The totals cover every open order for this supplier and value only goods actually received. The table below is one page of the history; use the pager to reach older orders.',
              )}
            </p>
            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
              <table className="w-full min-w-[680px] text-xs text-start">
                <thead className="bg-slate-950 text-slate-400">
                  <tr><th className="p-3">PO</th><th className="p-3">{L('الفرع', 'Branch')}</th><th className="p-3">{L('الحالة', 'Status')}</th><th className="p-3">{L('التاريخ', 'Date')}</th><th className="p-3">{L('الإجمالي', 'Total')}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((po) => (
                    <tr key={po.id}>
                      <td className="p-3 font-mono text-blue-300">{po.poNumber}</td>
                      <td className="p-3">{isAr ? po.branch?.name || '—' : po.branch?.nameEn || '—'}</td>
                      <td className="p-3">{po.status}</td>
                      <td className="p-3">{po.createdAt.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</td>
                      <td className="p-3 font-bold text-slate-100">{num(po.totalAmount).toLocaleString()} {currencyLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400">
                  {L(`${orderTotal} أمر توريد`, `${orderTotal} purchase orders`)}
                </span>
                <ServerPagination page={safePage} totalPages={totalPages} hrefFor={pageHref} />
              </div>
            )}
          </>
        ) : <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">{L('اختر موردًا من القائمة لعرض كشف حسابه وأوامره ومدفوعاته.', 'Select a supplier to view their statement, orders, and payments.')}</div>}
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
          {selected ? L(`مدفوعات ${selected.name}`, `${selected.name} payments`) : L('المدفوعات', 'Payments')}
        </h2>
        <SupplierPayments
          suppliers={suppliers}
          initial={payments.map((payment) => ({
            id: payment.id,
            supplierId: payment.supplierId,
            amount: num(payment.amount),
            method: payment.method,
            reference: payment.reference,
            notes: payment.notes,
            createdAt: payment.createdAt.toISOString(),
            supplier: payment.supplier,
          }))}
        />
      </div>
    </>
  );
}
