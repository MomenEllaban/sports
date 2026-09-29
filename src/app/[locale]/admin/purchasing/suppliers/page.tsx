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
import { TABLE_PAGE_SIZE } from '@/lib/table-paging';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = TABLE_PAGE_SIZE;
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
    <div className="space-y-6">
      {/* Page Title & Context */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-100">{L('دليل الموردين وكشف الحساب', 'Supplier directory & account statement')}</h1>
          <p className="text-xs text-slate-400 mt-1">{L('إدارة بيانات الموردين وأوامر التوريد وملخص الالتزامات والمدفوعات لكل مورد.', 'Manage supplier records, purchase orders, commitments, and payments per supplier.')}</p>
        </div>
      </div>

      {/* When a supplier IS selected: Place the Statement & Dossier at the top for maximum ergonomics */}
      {selected && (
        <div className="glass-panel p-6 rounded-3xl border border-blue-500/40 bg-slate-900/90 shadow-xl shadow-blue-950/20 space-y-5 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-base">
                {selected.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-lg text-slate-100">
                    {L(`كشف حساب: ${selected.name}`, `Statement: ${selected.name}`)}
                  </h2>
                  <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md">
                    {selected.code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                  {selected.contactPerson && <span>{L('المسؤول', 'Contact')}: <strong className="text-slate-200">{selected.contactPerson}</strong></span>}
                  {selected.phone && <span dir="ltr">📞 {selected.phone}</span>}
                  {selected.taxNumber && <span>{L('الرقم الضريبي', 'Tax')}: <strong className="text-slate-300 font-mono">{selected.taxNumber}</strong></span>}
                </div>
              </div>
            </div>
            <Link
              href="/admin/purchasing/suppliers"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <span>✕</span>
              <span>{L('إغلاق الكشف', 'Close statement')}</span>
            </Link>
          </div>

          {/* Statement Financial Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-[11px] font-bold text-slate-400">{L('إجمالي المستحق (أوامر مفتوحة)', 'Total committed (open orders)')}</div>
              <div className="mt-1 text-2xl font-black text-slate-100">{committed.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currencyLabel}</span></div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-[11px] font-bold text-slate-400">{L('المسدد لأوامر التوريد', 'Paid against orders')}</div>
              <div className="mt-1 text-2xl font-black text-emerald-300">{paid.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currencyLabel}</span></div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-[11px] font-bold text-slate-400">{L('الرصيد', 'Balance')}</div>
              <div className={`mt-1 text-2xl font-black ${balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{balance.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currencyLabel}</span></div>
            </div>
          </div>

          {unattributedTotal > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-medium">
              <span>⚠️</span>
              <span>
                {L(
                  `تشمل الدفعات ${unattributedTotal.toLocaleString()} ${currencyLabel} غير مخصصة لأمر محدد (دفعة مقدمة)، فلا تُخصم من أي فاتورة.`,
                  `Payments include ${unattributedTotal.toLocaleString()} ${currencyLabel} not tied to a specific order (an advance), so it is not deducted from any invoice.`,
                )}
              </span>
            </div>
          )}

          {openOrders.length >= SCAN_LIMIT && (
            <p role="alert" className="text-xs font-bold text-amber-300">
              {L(
                `عدد الأوامر المفتوحة أكبر من الحد(${SCAN_LIMIT})، فالأرقام أعلاه حد أدنى وليست كاملة.`,
                `This supplier has more than ${SCAN_LIMIT} open orders, so the totals above are a lower bound rather than complete.`,
              )}
            </p>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {L(
              'الملخص يغطي كل أوامر المورد المفتوحة، ويحتسب قيمة الأصناف المستلمة فعليًا؛ الجدول أدناه صفحة واحدة من السجل، استخدم التصفحات للوصول للأوامر الأقدم.',
              'The totals cover every open order for this supplier and value only goods actually received. The table below is one page of the history; use the pager to reach older orders.',
            )}
          </p>

          {/* Orders History Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">{L('سجل أوامر الشراء للمورد', 'Purchase orders history')}</h3>
            <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full min-w-[680px] text-xs text-start">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 text-start">PO</th>
                    <th className="p-3.5 text-start">{L('الفرع', 'Branch')}</th>
                    <th className="p-3.5 text-start">{L('الحالة', 'Status')}</th>
                    <th className="p-3.5 text-start">{L('التاريخ', 'Date')}</th>
                    <th className="p-3.5 text-start">{L('الإجمالي', 'Total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {L('لا توجد أوامر توريد مسجلة لهذا المورد', 'No purchase orders recorded for this supplier')}
                      </td>
                    </tr>
                  )}
                  {rows.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-amber-400">{po.poNumber}</td>
                      <td className="p-3.5">{isAr ? po.branch?.name || '—' : po.branch?.nameEn || '—'}</td>
                      <td className="p-3.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                          {po.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">{po.createdAt.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB')}</td>
                      <td className="p-3.5 font-bold text-slate-100">{num(po.totalAmount).toLocaleString()} {currencyLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* The range is shown even on a single page, so the user can tell a
                short list from a paginated one. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400">
                {orderTotal === 0
                  ? L('لا توجد صفوف', 'No rows')
                  : L(
                      `عرض ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, orderTotal)} من ${orderTotal}`,
                      `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, orderTotal)} of ${orderTotal}`
                    )}
              </span>
              <ServerPagination page={safePage} totalPages={totalPages} hrefFor={pageHref} />
            </div>

          </div>

          {/* Supplier Specific Payments */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-black text-slate-200 uppercase tracking-wider">{L(`مدفوعات ${selected.name}`, `${selected.name} payments`)}</h3>
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
        </div>
      )}

      {/* Main Supplier Directory */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h2 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
            <span>📋</span>
            <span>{L('بيانات وسجل الموردين', 'Supplier records')}</span>
          </h2>
          {selected && (
            <span className="text-xs text-blue-400 font-bold">
              {L(`المورد المحدد: ${selected.name}`, `Selected: ${selected.name}`)}
            </span>
          )}
        </div>
        <SuppliersManager suppliers={suppliers} selectedId={selectedId} />
      </div>

      {/* Empty State Callout when no supplier is selected */}
      {!selected && (
        <div className="rounded-2xl border border-dashed border-slate-700/80 p-8 text-center text-sm text-slate-400 bg-slate-950/20 space-y-1">
          <div className="text-lg">📁</div>
          <p className="font-medium text-slate-300">
            {L('اختر موردًا من القائمة لعرض كشف حسابه وأوامره ومدفوعاته.', 'Select a supplier to view their statement, orders, and payments.')}
          </p>
        </div>
      )}

      {/* Global Payments Section when no specific supplier is chosen */}
      {!selected && payments.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3 flex items-center gap-2">
            <span>💳</span>
            <span>{L('سجل أحدث المدفوعات للموردين', 'Recent Supplier Payments')}</span>
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
      )}
    </div>
  );
}
