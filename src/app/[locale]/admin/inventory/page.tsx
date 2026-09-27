import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { Link } from '@/i18n/routing';
import { AlertTriangle, ArrowRightLeft, Package, TrendingDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminInventoryPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const allowed = scopedBranchIds(session);
  const branchScope = allowed === null ? {} : { id: { in: allowed } };

  const branches = await prisma.branch.findMany({
    where: { ...branchScope, isActive: true },
    include: {
      inventories: {
        include: { product: { select: { id: true, nameAr: true, nameEn: true, sku: true } } },
        orderBy: { stockQuantity: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Aggregate stats
  let totalSkus = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalUnits = 0;

  for (const branch of branches) {
    for (const inv of branch.inventories) {
      totalSkus++;
      totalUnits += inv.stockQuantity;
      if (inv.stockQuantity === 0) outOfStockCount++;
      else if (inv.stockQuantity <= inv.reorderPoint) lowStockCount++;
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-400" />
            {L('أرصدة المخزون', 'Stock Balances')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L('رصيد كل صنف في كل فرع بشكل منفصل — للتحويلات والحركات اضغط على التبويبات أعلاه', 'Per-branch stock levels — use the tabs above for movements & transfers')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/inventory/transfers"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {L('التحويلات بين الفروع', 'Inter-branch transfers')}
          </Link>
          <Link
            href="/admin/inventory/alerts"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {L('تنبيهات النقص', 'Reorder alerts')}
            {(lowStockCount + outOfStockCount) > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-amber-950">
                {lowStockCount + outOfStockCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel rounded-2xl border border-slate-800 p-4 space-y-1">
          <p className="text-[11px] font-semibold text-slate-400">{L('إجمالي الأصناف المُسجَّلة', 'Total SKUs tracked')}</p>
          <p className="text-xl font-black text-slate-100">{totalSkus.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500">{L('عبر جميع الفروع', 'across all branches')}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-slate-800 p-4 space-y-1">
          <p className="text-[11px] font-semibold text-slate-400">{L('إجمالي الوحدات في المخزون', 'Total units in stock')}</p>
          <p className="text-xl font-black text-emerald-400">{totalUnits.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500">{L('قطعة', 'units')}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1">
          <p className="text-[11px] font-semibold text-amber-400">{L('تحت حد إعادة الطلب', 'Below reorder point')}</p>
          <p className="text-xl font-black text-amber-300">{lowStockCount.toLocaleString()}</p>
          <p className="text-[10px] text-amber-500/70">{L('تحتاج تعبئة قريباً', 'need replenishment soon')}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1">
          <p className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            {L('نفدت الكمية', 'Out of stock')}
          </p>
          <p className="text-xl font-black text-rose-300">{outOfStockCount.toLocaleString()}</p>
          <p className="text-[10px] text-rose-500/70">{L('رصيد صفر', 'zero balance')}</p>
        </div>
      </div>

      {/* Per-branch inventory tables */}
      {branches.map((branch) => {
        const branchLow = branch.inventories.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= i.reorderPoint).length;
        const branchOut = branch.inventories.filter((i) => i.stockQuantity === 0).length;
        return (
          <div key={branch.id} className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
            {/* Branch header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-100">
                  {isAr ? branch.name : branch.nameEn}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isAr ? (branch.address || '') : (branch.addressEn || '')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {branchOut > 0 && (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400">
                    {branchOut} {L('نفدت', 'out of stock')}
                  </span>
                )}
                {branchLow > 0 && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400">
                    {branchLow} {L('تحت الحد', 'low stock')}
                  </span>
                )}
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                  {branch.inventories.length} {L('صنف', 'SKUs')}
                </span>
              </div>
            </div>

            {/* Inventory rows */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{L('المنتج', 'Product')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">SKU</th>
                    <th className="px-4 py-2.5 text-center font-semibold">{L('الرصيد', 'Qty')}</th>
                    <th className="px-4 py-2.5 text-center font-semibold">{L('حد الطلب', 'Reorder at')}</th>
                    <th className="px-4 py-2.5 text-center font-semibold">{L('الحالة', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {branch.inventories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        {L('لا توجد أصناف مسجلة في هذا الفرع', 'No items registered for this branch')}
                      </td>
                    </tr>
                  ) : branch.inventories.map((inv) => {
                    const isOut = inv.stockQuantity === 0;
                    const isLow = !isOut && inv.stockQuantity <= inv.reorderPoint;
                    return (
                      <tr key={inv.id} className={`hover:bg-slate-900/40 transition-colors ${isOut ? 'bg-rose-950/10' : isLow ? 'bg-amber-950/10' : ''}`}>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-200">
                            {isAr ? inv.product.nameAr : inv.product.nameEn}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{inv.product.sku || '—'}</td>
                        <td className={`px-4 py-3 text-center font-black text-base ${isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {inv.stockQuantity}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">{inv.reorderPoint}</td>
                        <td className="px-4 py-3 text-center">
                          {isOut ? (
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                              {L('نفدت', 'Out')}
                            </span>
                          ) : isLow ? (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              {L('تحت الحد', 'Low')}
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                              {L('كافٍ', 'OK')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {branches.length === 0 && (
        <div className="glass-panel rounded-3xl border border-slate-800 p-12 text-center">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">{L('لا توجد فروع مفعّلة', 'No active branches found')}</p>
        </div>
      )}
    </>
  );
}
