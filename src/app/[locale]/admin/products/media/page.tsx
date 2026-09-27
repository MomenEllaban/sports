import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { Image as ImageIcon, AlertCircle, ImageOff } from 'lucide-react';
import Image from 'next/image';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ filter?: string; page?: string }>;

const PAGE_SIZE = 24;

/**
 * Media coverage audit. This page reports *which* products lack photography —
 * it is deliberately a read-only coverage report, because image editing
 * (upload, reorder, set primary, delete) belongs to the product form in
 * /admin/products. It links there rather than re-implementing the uploader.
 *
 * Both active and inactive products are counted: a deactivated product is
 * exactly the one whose missing photo would block a re-launch.
 */
export default async function AdminProductMediaPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const sp = await searchParams;
  const filter = sp.filter === 'missing' || sp.filter === 'inactive' ? sp.filter : 'all';
  const page = Math.max(1, Number(sp.page || 1) || 1);

  // `images` is a String[]; a non-empty array is what "has a photo" means.
  // Counting happens in SQL so the KPIs and the page can never disagree.
  const hasPhoto = { isEmpty: false };
  const noPhoto = { isEmpty: true };

  const [total, withImages, missing, inactive, activeOnly, pageRows] = await Promise.all([
    prisma.product.count({}),
    prisma.product.count({ where: { images: hasPhoto } }),
    prisma.product.count({ where: { isActive: true, images: noPhoto } }),
    prisma.product.count({ where: { isActive: false } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: {
        ...(filter === 'missing' ? { isActive: true, images: noPhoto } : {}),
        ...(filter === 'inactive' ? { isActive: false } : {}),
      },
      select: {
        id: true,
        sku: true,
        nameAr: true,
        nameEn: true,
        images: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const coverage = total > 0 ? Math.round((withImages / total) * 100) : 0;
  const filterCount = filter === 'missing' ? missing : filter === 'inactive' ? inactive : total;
  const pageCount = Math.max(1, Math.ceil(filterCount / PAGE_SIZE));

  const filters = [
    { key: 'all', labelAr: 'كل المنتجات', labelEn: 'All products', count: total },
    { key: 'missing', labelAr: 'بدون صور', labelEn: 'No photos', count: missing },
    { key: 'inactive', labelAr: 'موقوفة', labelEn: 'Inactive', count: inactive },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-emerald-400" />
            {L('تغطية صور المنتجات', 'Product image coverage')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L(
              'تقرير تغطية الصور فقط. إضافة وترتيب الصور وحذفها تتم من نموذج المنتج في صفحة المنتجات.',
              'A coverage report only. Add, reorder and remove images from the product form on the products page.'
            )}
          </p>
        </div>
        <Link
          href="/admin/products"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-800 px-4 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
        >
          {L('إدارة صور المنتجات', 'Manage product images')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-panel space-y-1 rounded-2xl border border-slate-800 p-4">
          <p className="text-[11px] font-semibold text-slate-400">{L('إجمالي المنتجات', 'Total products')}</p>
          <p className="text-xl font-black text-slate-100">{total}</p>
          <p className="text-[10px] text-slate-500">{L('بكل الحالات', 'active & inactive')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[11px] font-semibold text-emerald-400">{L('منتجات بصور', 'With photos')}</p>
          <p className="text-xl font-black text-emerald-300">{withImages}</p>
          <p className="text-[10px] text-emerald-500/70">{coverage}% {L('نسبة التغطية', 'coverage')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {L('نشطة بدون صور', 'Active without photos')}
          </p>
          <p className="text-xl font-black text-amber-300">{missing}</p>
          <p className="text-[10px] text-amber-500/70">{L('لا تظهر في المتجر', 'invisible in the storefront')}</p>
        </div>
        <div className="glass-panel space-y-1 rounded-2xl border border-slate-800 p-4">
          <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <ImageOff className="w-3.5 h-3.5" />
            {L('منتجات موقوفة', 'Inactive products')}
          </p>
          <p className="text-xl font-black text-slate-300">{inactive}</p>
          <p className="text-[10px] text-slate-500">
            {activeOnly} {L('نشط في الكتالوج', 'active in the catalogue')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/admin/products/media' : `/admin/products/media?filter=${f.key}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
                active ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {isAr ? f.labelAr : f.labelEn}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-blue-500' : 'bg-slate-700'}`}>{f.count}</span>
            </Link>
          );
        })}
      </div>

      {pageRows.length === 0 ? (
        <div className="glass-panel rounded-3xl border border-slate-800 p-12 text-center">
          <ImageIcon className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="font-semibold text-slate-400">
            {filter === 'missing' ? L('كل المنتجات النشطة لها صور', 'Every active product has a photo') : L('لا توجد منتجات', 'No products')}
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-3xl border border-slate-800 p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {pageRows.map((prod) => {
              const hasImg = prod.images.length > 0;
              return (
                <div key={prod.id} className="group overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 p-2 transition-all hover:border-slate-700">
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900">
                    {hasImg ? (
                      <Image
                        src={prod.images[0]}
                        alt={isAr ? prod.nameAr : prod.nameEn}
                        fill
                        sizes="160px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="p-2 text-center text-slate-600">
                        <ImageIcon className="mx-auto mb-1 h-6 w-6 opacity-50" />
                        <span className="block text-[9px] font-bold">{L('بدون صورة', 'No image')}</span>
                      </div>
                    )}
                    {!prod.isActive && (
                      <span className="absolute start-1 top-1 rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                        {L('موقوف', 'Inactive')}
                      </span>
                    )}
                    {hasImg && prod.images.length > 1 && (
                      <span className="absolute bottom-1 end-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-300">
                        +{prod.images.length - 1}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className="truncate text-[11px] font-bold text-slate-200" title={isAr ? prod.nameAr : prod.nameEn}>
                      {isAr ? prod.nameAr : prod.nameEn}
                    </p>
                    <p className="truncate font-mono text-[9px] text-slate-500">{prod.sku}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label={L('التنقل بين الصفحات', 'Pagination')}>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
            const active = n === page;
            const query: Record<string, string> = {};
            if (filter !== 'all') query.filter = filter;
            if (n > 1) query.page = String(n);
            return (
              <Link
                key={n}
                href={{ pathname: '/admin/products/media', query }}
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
