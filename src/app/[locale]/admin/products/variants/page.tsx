import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { Link } from '@/i18n/routing';
import { Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ query?: string; page?: string }>;

const PAGE_SIZE = 20;

/**
 * Variant families. This page groups SKUs into style families so the size/colour
 * matrix is readable; it is not a stock report. Balances are summed over the
 * branches the signed-in manager is actually assigned to, and "low" is decided
 * by each inventory row's own `reorderPoint` rather than a hard-coded number.
 * The authoritative per-branch ledger lives in /admin/inventory.
 */
export default async function AdminProductVariantsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const sp = await searchParams;
  const query = (sp.query || '').trim();
  const page = Math.max(1, Number(sp.page || 1) || 1);
  const allowed = scopedBranchIds(session);
  const branchScope = allowed === null ? {} : { branchId: { in: allowed } };

  // Only the product fields this table renders, and only the assigned branches.
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(query
        ? {
            OR: [
              { nameAr: { contains: query, mode: 'insensitive' as const } },
              { nameEn: { contains: query, mode: 'insensitive' as const } },
              { sku: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      size: true,
      color: true,
      groupSlug: true,
      price: true,
      category: { select: { nameAr: true, nameEn: true } },
      brand: { select: { nameAr: true, nameEn: true } },
      inventories: { where: branchScope, select: { stockQuantity: true, reorderPoint: true } },
    },
    orderBy: [{ groupSlug: 'asc' }, { sku: 'asc' }],
    take: 4000,
  });

  interface Family {
    key: string;
    displayName: string;
    category: string;
    brand: string;
    items: typeof products;
    totalStock: number;
    lowCount: number;
    outCount: number;
  }

  const families: Record<string, Family> = {};
  for (const p of products) {
    const stock = p.inventories.reduce((acc, inv) => acc + inv.stockQuantity, 0);
    // "Low" follows the row's own reorder point, so a branch manager and a
    // super admin agree on the same SKU.
    const low = p.inventories.filter((inv) => inv.stockQuantity > 0 && inv.stockQuantity <= inv.reorderPoint).length;
    const out = p.inventories.filter((inv) => inv.stockQuantity === 0).length;
    const key = p.groupSlug || p.nameAr;
    if (!families[key]) {
      families[key] = {
        key,
        displayName: isAr ? p.nameAr : p.nameEn,
        category: p.category ? (isAr ? p.category.nameAr : p.category.nameEn) : '—',
        brand: p.brand ? (isAr ? p.brand.nameAr : p.brand.nameEn || p.brand.nameAr) : '—',
        items: [],
        totalStock: 0,
        lowCount: 0,
        outCount: 0,
      };
    }
    families[key].items.push(p);
    families[key].totalStock += stock;
    families[key].lowCount += low;
    families[key].outCount += out;
  }

  const all = Object.values(families);
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const familyList = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const variantCount = all.reduce((acc, f) => acc + f.items.length, 0);
  const lowVariants = all.reduce((acc, f) => acc + f.lowCount, 0);
  const outVariants = all.reduce((acc, f) => acc + f.outCount, 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-400" />
            {L('المتغيرات والمقاسات والألوان', 'Variants, sizes & colours')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L(
              'عائلات المنتجات مجمّعة حسب الموديل، مع SKU مستقل لكل مقاس ولون. الأرصدة محسوبة لفروعك فقط.',
              'Product families grouped by style, one independent SKU per size and colour. Balances cover only your branches.'
            )}
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label htmlFor="v-search" className="sr-only">{L('بحث', 'Search')}</label>
          <input
            id="v-search"
            name="query"
            type="search"
            defaultValue={query}
            placeholder={L('ابحث بالاسم أو الكود', 'Search name or SKU')}
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 transition-colors focus:ring-2 focus:ring-blue-500 sm:w-64"
          />
          <button type="submit" className="min-h-[44px] rounded-xl bg-slate-800 px-4 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700">
            {L('بحث', 'Search')}
          </button>
          {query && (
            <Link
              href="/admin/products/variants"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 px-4 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800"
            >
              {L('مسح', 'Clear')}
            </Link>
          )}
        </form>
      </div>

      {/* KPIs specific to this page: families, SKUs, and variants that need
          attention. Total units is intentionally omitted — /admin/inventory
          already owns that number. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-panel space-y-1 rounded-2xl border border-slate-800 p-4">
          <p className="text-xs font-semibold text-slate-400">{L('عائلات المنتجات', 'Product families')}</p>
          <p className="text-2xl font-black text-slate-100">{all.length}</p>
          <p className="text-[10px] text-slate-500">{L('موديل أو تصميم رئيسي', 'distinct styles')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-slate-800 p-4">
          <p className="text-xs font-semibold text-slate-400">{L('إجمالي المتغيرات', 'Variant SKUs')}</p>
          <p className="text-2xl font-black text-blue-400">{variantCount}</p>
          <p className="text-[10px] text-slate-500">{L('مقاس ولون مستقل', 'independent size/colour')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400">{L('متغيرات تحت حد الطلب', 'Variants below reorder')}</p>
          <p className="text-2xl font-black text-amber-300">{lowVariants}</p>
          <p className="text-[10px] text-amber-500/70">{L('حسب حد كل فرع', 'per branch reorder point')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-xs font-semibold text-rose-400">{L('متغيرات نفدت', 'Variants out of stock')}</p>
          <p className="text-2xl font-black text-rose-300">{outVariants}</p>
          <p className="text-[10px] text-rose-500/70">{L('رصيد صفر في فرع من فروعك', 'zero balance in one of your branches')}</p>
        </div>
      </div>

      {familyList.length === 0 ? (
        <div className="glass-panel rounded-3xl border border-slate-800 p-12 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="font-semibold text-slate-400">
            {query ? L(`لا توجد نتائج لـ "${query}"`, `No results for "${query}"`) : L('لا توجد منتجات نشطة', 'No active products')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {familyList.map((family) => (
            <div key={family.key} className="glass-panel space-y-4 rounded-3xl border border-slate-800 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-100">{family.displayName}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {family.brand} · {family.category} · {family.items.length} {L('متغير', 'variants')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {family.outCount > 0 && (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400">
                      {family.outCount} {L('نفد', 'out')}
                    </span>
                  )}
                  {family.lowCount > 0 && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400">
                      {family.lowCount} {L('تحت الحد', 'low')}
                    </span>
                  )}
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                    {family.totalStock} {L('قطعة', 'units')}
                  </span>
                </div>
              </div>

              <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3 text-start font-semibold">SKU</th>
                      <th className="py-2 px-3 text-center font-semibold">{L('المقاس', 'Size')}</th>
                      <th className="py-2 px-3 text-center font-semibold">{L('اللون', 'Colour')}</th>
                      <th className="py-2 px-3 text-end font-semibold">{L('السعر', 'Price')}</th>
                      <th className="py-2 px-3 text-center font-semibold">{L('رصيدك', 'Your stock')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {family.items.map((item) => {
                      const itemStock = item.inventories.reduce((acc, inv) => acc + inv.stockQuantity, 0);
                      const isLow = item.inventories.some(
                        (inv) => inv.stockQuantity > 0 && inv.stockQuantity <= inv.reorderPoint,
                      );
                      const isOut = itemStock === 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-mono text-slate-400">{item.sku}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-block rounded-lg bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                              {item.size || '—'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-medium text-slate-300">{item.color || '—'}</td>
                          <td className="py-2 px-3 text-end font-mono font-bold text-emerald-400">
                            {num(item.price).toLocaleString()} {currencyLabel}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                isOut
                                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                                  : isLow
                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {itemStock}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label={L('التنقل بين الصفحات', 'Pagination')}>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
            const pageQuery: Record<string, string> = {};
            if (query) pageQuery.query = query;
            if (n > 1) pageQuery.page = String(n);
            const active = n === page;
            return (
              <Link
                key={n}
                href={{ pathname: '/admin/products/variants', query: pageQuery }}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-3 text-xs font-bold transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {n}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
