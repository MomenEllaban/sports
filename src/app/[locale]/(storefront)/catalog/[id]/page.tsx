import React from 'react';
import ProductDetailsClient from './ProductDetailsClient';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { getSetting } from '@/lib/settings';
import { Link } from '@/i18n/routing';
import { MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isAr = locale === 'ar';

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      inventories: { include: { branch: true } },
    },
  });

  if (!product || !product.isActive) notFound();

  // T07: siblings in the same display family + category size chart.
  const siblings = product.groupSlug
    ? await prisma.product.findMany({
        where: { groupSlug: product.groupSlug, isActive: true },
        select: { id: true, size: true, color: true, price: true, inventories: { select: { stockQuantity: true } } },
      })
    : [];
  const charts = await getSetting<Array<{ category: string; titleAr: string; titleEn: string; columns: string[]; rows: string[][] }>>('sizecharts', []).catch(() => []);
  const variants = siblings.map((s) => ({
    id: s.id,
    size: s.size,
    color: s.color,
    price: num(s.price),
    stock: s.inventories.reduce((t, i) => t + i.stockQuantity, 0),
  }));
  const chartRow = (Array.isArray(charts) ? charts : []).find((c) => c.category === product.category.slug);
  const sizeChart = chartRow && Array.isArray(chartRow.rows) && chartRow.rows.length > 0 ? chartRow : null;

  const price = num(product.price);
  const totalStock = product.inventories.reduce((s, i) => s + i.stockQuantity, 0);
  const name = isAr ? product.nameAr : product.nameEn;
  const desc = isAr ? product.descriptionAr : product.descriptionEn;

  return (
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 space-y-8 w-full">
        <nav className="text-xs text-slate-400 flex items-center gap-2" aria-label="breadcrumb">
          <Link href="/" className="hover:text-slate-200">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-slate-200">
            {isAr ? 'الكتالوج' : 'Catalog'}
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-bold truncate max-w-60">{name}</span>
        </nav>

        <div className="space-y-2">
          <p className="text-xs font-bold text-blue-400">
            {isAr ? product.category.nameAr : product.category.nameEn}
            {product.brand ? ` • ${isAr ? product.brand.nameAr : product.brand.nameEn}` : ''}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black">{name}</h1>
          <p className="text-xs text-slate-500">
            SKU: <span className="font-mono font-bold text-slate-300">{product.sku}</span>
            {product.barcode ? ` • Barcode: ${product.barcode}` : ''}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">{price.toLocaleString()}</span>
            <span className="text-xs font-bold text-amber-400">ج.م</span>
            <span className="text-[11px] text-slate-500">شامل ضريبة 14%</span>
          </div>
        </div>

        <ProductDetailsClient
          product={{
            id: product.id,
            sku: product.sku,
            nameAr: product.nameAr,
            nameEn: product.nameEn,
            price,
            images: product.images,
            size: product.size,
            color: product.color,
          }}
          totalStock={totalStock}
          variants={variants}
          sizeChart={sizeChart}
        />

        {(product.size || product.color || desc) && (
          <section className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-3">
            <h2 className="font-black text-lg">{isAr ? 'الوصف والمواصفات' : 'Description'}</h2>
            {(product.size || product.color) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {product.size && (
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-bold">
                    {isAr ? 'المقاس' : 'Size'}: {product.size}
                  </span>
                )}
                {product.color && (
                  <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-bold">
                    {isAr ? 'اللون' : 'Color'}: {product.color}
                  </span>
                )}
              </div>
            )}
            {desc && <p className="text-sm text-slate-300 leading-relaxed">{desc}</p>}
          </section>
        )}

        <section className="glass-panel rounded-2xl border border-slate-800 p-6 space-y-3">
          <h2 className="font-black text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            {isAr ? 'التوفر في الفروع' : 'Branch availability'}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {product.inventories.map((inv) => (
              <div
                key={inv.branchId}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm"
              >
                <span className="font-bold">{isAr ? inv.branch.name : inv.branch.nameEn}</span>
                {inv.stockQuantity > 0 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    متوفر ({inv.stockQuantity} قطعة)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1 text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    غير متوفر
                  </span>
                )}
              </div>
            ))}
          </div>
          {product.inventories.length === 0 && (
            <p className="text-xs text-slate-500">لا توجد بيانات مخزون لهذا الصنف.</p>
          )}
        </section>
      </main>
  );
}
