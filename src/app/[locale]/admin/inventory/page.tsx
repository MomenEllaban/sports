import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { getInventoryOverview } from '@/lib/inventory/queries';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { Link } from '@/i18n/routing';
import InventoryTable from '@/components/admin/InventoryTable';
import { AlertTriangle, ArrowRightLeft, ClipboardList, Package, Wallet } from 'lucide-react';

export const dynamic = 'force-dynamic';

const money = (value: number) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Stock balances. Every number here comes from the aggregated overview in
 * `lib/inventory/queries` (SQL, branch-scoped), and the rows come from the
 * shared server-paginated table — this page deliberately renders no stock
 * table of its own, because /admin/inventory/stock used to duplicate it and
 * /admin/inventory/movements owns the ledger.
 */
export default async function AdminInventoryPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const allowed = scopedBranchIds(session);
  const [overview, branchOptions] = await Promise.all([
    getInventoryOverview(session),
    prisma.branch.findMany({
      where: { isActive: true, ...(allowed === null ? {} : { id: { in: allowed } }) },
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  const { branches, totalSkus, totalQuantity, lowStockCount, outOfStockCount, stockValue, retailValue } = overview;
  const alertCount = lowStockCount + outOfStockCount;

  return (
    <>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-400" />
            {L('أرصدة المخزون', 'Stock balances')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L(
              'رصيد كل صنف في كل فرع من فروعك — ابحث أو صفِّ أو صفِّ حسب الحالة، وسجل الحركات في تبويب الحركة',
              'Per-branch balance for every item you own — search, filter or sort here; the ledger lives in the movements tab'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/inventory/transfers"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {L('تحويلات الفروع', 'Branch transfers')}
          </Link>
          <Link
            href="/admin/inventory/alerts"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {L('تنبيهات النقص', 'Reorder alerts')}
            {alertCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-amber-950">
                {alertCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Summary KPIs — all aggregated in SQL, branch-scoped to the session */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-panel space-y-1 rounded-2xl border border-slate-800 p-4">
          <p className="text-[11px] font-semibold text-slate-400">{L('إجمالي الوحدات', 'Units on hand')}</p>
          <p className="text-xl font-black text-slate-100">{totalQuantity.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500">
            {L('عبر', 'across')} {branches} {L('فرع', branches === 1 ? 'branch' : 'branches')} · {totalSkus} {L('صنف', 'SKUs')}
          </p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-slate-800 p-4">
          <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" />
            {L('قيمة المخزون بالتكلفة', 'Stock value at cost')}
          </p>
          <p className="text-xl font-black text-emerald-400">{money(stockValue)}</p>
          <p className="text-[10px] text-slate-500">
            {L('بسعر البيع', 'retail')} {money(retailValue)} {L('ج.م', 'EGP')}
          </p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[11px] font-semibold text-amber-400">{L('تحت حد إعادة الطلب', 'Below reorder point')}</p>
          <p className="text-xl font-black text-amber-300">{lowStockCount.toLocaleString()}</p>
          <p className="text-[10px] text-amber-500/70">{L('تحتاج تعبئة قريباً', 'need replenishment soon')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-[11px] font-semibold text-rose-400">{L('نفدت الكمية', 'Out of stock')}</p>
          <p className="text-xl font-black text-rose-300">{outOfStockCount.toLocaleString()}</p>
          <p className="text-[10px] text-rose-500/70">{L('رصيد صفر', 'zero balance')}</p>
        </div>
      </div>

      {/* Cross-section counters. Counts and links only — the tables themselves
          belong to the transfers and stocktake pages, so nothing is repeated. */}
      {(overview.pendingTransfers > 0 || overview.inTransitTransfers > 0 || overview.openStocktakes > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {overview.pendingTransfers > 0 && (
            <Link
              href="/admin/inventory/transfers"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {overview.pendingTransfers} {L('تحويل بانتظار الاعتماد', 'transfers awaiting approval')}
            </Link>
          )}
          {overview.inTransitTransfers > 0 && (
            <Link
              href="/admin/inventory/transfers"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 font-bold text-blue-300 transition-colors hover:bg-blue-500/20"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {overview.inTransitTransfers} {L('تحويل في الطريق', 'transfers in transit')}
            </Link>
          )}
          {overview.openStocktakes > 0 && (
            <Link
              href="/admin/inventory/count"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 font-bold text-slate-200 transition-colors hover:bg-slate-700"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              {overview.openStocktakes} {L('جلسة جرد مسودة', 'open stocktake drafts')}
            </Link>
          )}
        </div>
      )}

      {/* The one and only stock table of this section */}
      <div className="glass-panel animate-fade-up space-y-4 rounded-3xl border border-slate-800 p-6">
        <InventoryTable view="stock" branches={branchOptions} showAdjust />
      </div>
    </>
  );
}
