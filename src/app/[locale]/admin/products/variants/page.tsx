import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { Layers, Palette, Ruler, Package, Search } from 'lucide-react';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function AdminProductVariantsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      size: true,
      color: true,
      groupSlug: true,
      price: true,
      costPrice: true,
      category: { select: { nameAr: true, nameEn: true } },
      brand: { select: { nameAr: true, nameEn: true } },
      inventories: { select: { stockQuantity: true } },
    },
    orderBy: { groupSlug: 'asc' },
  });

  // Group products by groupSlug or parent name
  const families: Record<
    string,
    {
      groupSlug: string;
      displayName: string;
      category: string;
      brand: string;
      items: typeof products;
      totalStock: number;
    }
  > = {};

  for (const p of products) {
    const groupKey = p.groupSlug || p.nameAr;
    const stock = p.inventories.reduce((acc, inv) => acc + inv.stockQuantity, 0);

    if (!families[groupKey]) {
      families[groupKey] = {
        groupSlug: groupKey,
        displayName: isAr ? p.nameAr : p.nameEn,
        category: p.category ? (isAr ? p.category.nameAr : p.category.nameEn) : '—',
        brand: p.brand ? (isAr ? p.brand.nameAr : (p.brand.nameEn || p.brand.nameAr)) : '—',
        items: [],
        totalStock: 0,
      };
    }
    families[groupKey].items.push(p);
    families[groupKey].totalStock += stock;
  }

  const familyList = Object.values(families);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-400" />
          {L('المتغيرات والمقاسات والألوان (Product Variants)', 'Product Variants & Sizes Matrix')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'عرض عائلات المنتجات وتجميعات المقاسات والألوان المشتركة، مع تتبع الأرصدة والـ SKU لكل متغير.',
            'Product variant families grouped by style, color, and size matrix with independent SKU inventory.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('عائلات المنتجات (Styles)', 'Product Families')}</p>
          <p className="text-2xl font-black text-slate-100">{familyList.length}</p>
          <p className="text-[10px] text-slate-500">{L('موديل أو تصميم رئيسي', 'distinct product styles')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي المتغيرات (SKUs)', 'Total Variant SKUs')}</p>
          <p className="text-2xl font-black text-blue-400">{products.length}</p>
          <p className="text-[10px] text-slate-500">{L('صنف ومقاس مستقل', 'independent size/color SKUs')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي القطع في المخزن', 'Total Units Tracked')}</p>
          <p className="text-2xl font-black text-emerald-400">
            {familyList.reduce((acc, f) => acc + f.totalStock, 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500">{L('قطعة في كافة الفروع', 'units across all branches')}</p>
        </div>
      </div>

      {/* Families Grid */}
      <div className="space-y-4">
        {familyList.map((family) => (
          <div key={family.groupSlug} className="glass-panel rounded-3xl border border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-100">{family.displayName}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {family.brand} · {family.category} · {family.items.length} {L('متغيرات مسجلة', 'variants')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                  {family.totalStock} {L('قطعة بالمخزن', 'in stock')}
                </span>
              </div>
            </div>

            {/* Variants table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3 text-start font-semibold">SKU</th>
                    <th className="py-2 px-3 text-center font-semibold">{L('المقاس', 'Size')}</th>
                    <th className="py-2 px-3 text-center font-semibold">{L('اللون', 'Color')}</th>
                    <th className="py-2 px-3 text-end font-semibold">{L('السعر', 'Price')}</th>
                    <th className="py-2 px-3 text-center font-semibold">{L('الرصيد', 'Stock')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {family.items.map((item) => {
                    const itemStock = item.inventories.reduce((acc, inv) => acc + inv.stockQuantity, 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-mono text-slate-400">{item.sku}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-800 font-mono font-bold text-slate-200 text-[11px]">
                            {item.size || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-slate-300">{item.color || '—'}</td>
                        <td className="py-2 px-3 text-end font-mono text-emerald-400 font-bold">
                          {num(item.price).toLocaleString()} {currencyLabel}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              itemStock === 0
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : itemStock <= 5
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {itemStock} {L('قطعة', 'units')}
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
    </>
  );
}
