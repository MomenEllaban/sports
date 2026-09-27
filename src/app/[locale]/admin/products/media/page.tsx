import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { Image as ImageIcon, AlertCircle, CheckCircle2, Package, Sparkles } from 'lucide-react';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

export default async function AdminProductMediaPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      images: true,
      category: { select: { nameAr: true, nameEn: true } },
      brand: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const withImages = products.filter((p) => p.images && p.images.length > 0);
  const withoutImages = products.filter((p) => !p.images || p.images.length === 0);

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-emerald-400" />
          {L('مكتبة صور ووسائط المنتجات (Product Media Gallery)', 'Product Media & Image Gallery')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'مراجعة صور الكتالوج والمتجر، تتبع المنتجات التي تنقصها صور احترافية، وإدارة ألبوم الوسائط.',
            'Review storefront catalog photos, identify items missing media, and inspect resolution assets.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي المنتجات', 'Total Catalog Products')}</p>
          <p className="text-2xl font-black text-slate-100">{products.length}</p>
          <p className="text-[10px] text-slate-500">{L('صنف مسجل بالكتالوج', 'registered products')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('منتجات بصور مكتملة', 'With Photos')}</p>
          <p className="text-2xl font-black text-emerald-400">{withImages.length}</p>
          <p className="text-[10px] text-slate-500">
            {products.length > 0 ? ((withImages.length / products.length) * 100).toFixed(0) : 0}% {L('نسبة التغطية', 'coverage')}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold flex items-center justify-between">
            <span>{L('تنبيه: منتجات بدون صور', 'Missing Images Alert')}</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </p>
          <p className="text-2xl font-black text-amber-400">{withoutImages.length}</p>
          <p className="text-[10px] text-slate-500">{L('تحتاج رفع صور لظهورها بالمتجر', 'needs photography for store')}</p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Package className="w-4 h-4 text-blue-400" />
          {L('معاينة صور المنتجات', 'Product Image Previews')}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {products.map((prod) => {
            const hasImg = prod.images && prod.images.length > 0;
            const mainImg = hasImg ? prod.images[0] : null;

            return (
              <div
                key={prod.id}
                className="group relative rounded-2xl bg-slate-950 border border-slate-800/80 overflow-hidden p-2 flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div className="relative aspect-square w-full rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center">
                  {mainImg ? (
                    <Image
                      src={mainImg}
                      alt={prod.nameAr}
                      fill
                      sizes="160px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-600">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <span className="text-[9px] font-bold block">{L('بدون صورة', 'No Image')}</span>
                    </div>
                  )}

                  {hasImg && (
                    <span className="absolute bottom-1 end-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-300">
                      {prod.images.length} {L('صور', 'imgs')}
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-200 truncate" title={prod.nameAr}>
                    {isAr ? prod.nameAr : prod.nameEn}
                  </p>
                  <p className="text-[9px] font-mono text-slate-500 truncate">{prod.sku}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
