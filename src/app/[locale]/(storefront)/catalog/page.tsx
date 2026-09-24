import React from 'react';
import ProductCard from '@/components/storefront/ProductCard';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/routing';
import CatalogSortSelect from '@/components/storefront/CatalogSortSelect';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
type SearchParams = Promise<{ category?: string; brand?: string; query?: string; sort?: string; page?: string }>;

export default async function CatalogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: SearchParams }) {
  const { locale } = await params;
  const sp = await searchParams;
  const isAr = locale === 'ar';
  const pageSize = 24;
  const requestedPage = Math.max(1, Number(sp.page || 1) || 1);
  const sort = ['newest', 'price_asc', 'price_desc', 'name_asc'].includes(sp.sort || '') ? sp.sort! : 'newest';
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ where: { products: { some: { isActive: true } } }, select: { id: true, slug: true, nameAr: true, nameEn: true }, orderBy: { nameAr: 'asc' } }),
    prisma.brand.findMany({ where: { products: { some: { isActive: true } } }, select: { id: true, slug: true, nameAr: true, nameEn: true }, orderBy: { nameAr: 'asc' } }),
  ]);
  const selectedCategory = categories.find((item) => item.slug === sp.category);
  const selectedBrand = brands.find((item) => item.slug === sp.brand);
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(selectedCategory ? { categoryId: selectedCategory.id } : {}),
    ...(selectedBrand ? { brandId: selectedBrand.id } : {}),
    ...(sp.query?.trim() ? { OR: [
      { nameAr: { contains: sp.query.trim(), mode: 'insensitive' } },
      { nameEn: { contains: sp.query.trim(), mode: 'insensitive' } },
      { sku: { contains: sp.query.trim(), mode: 'insensitive' } },
      { barcode: { contains: sp.query.trim(), mode: 'insensitive' } },
      { brand: { is: { nameAr: { contains: sp.query.trim(), mode: 'insensitive' } } } },
    ] } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sort === 'price_asc' ? [{ price: 'asc' }, { id: 'asc' }] : sort === 'price_desc' ? [{ price: 'desc' }, { id: 'asc' }] : sort === 'name_asc' ? [{ nameAr: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }];
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy, skip: (requestedPage - 1) * pageSize, take: pageSize, select: { id: true, sku: true, barcode: true, nameAr: true, nameEn: true, descriptionAr: true, descriptionEn: true, price: true, isFeatured: true, images: true, category: { select: { nameAr: true, nameEn: true } }, inventories: { select: { stockQuantity: true, branch: { select: { name: true, nameEn: true } } } } } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const href = (next: Record<string, string | undefined>) => { const params = new URLSearchParams(); const values = { category: sp.category, brand: sp.brand, query: sp.query, sort: sp.sort === 'newest' ? undefined : sp.sort, page: next.page, ...next }; Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); }); return `/catalog?${params.toString()}`; };
  return <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6"><div><h1 className="text-3xl font-black text-slate-100">كتالوج الأجهزة والمعدات الرياضية</h1><p className="text-xs text-slate-400 mt-1">تصفح التشكيلة الكاملة ({total.toLocaleString()} صنف)</p></div><form method="GET" className="relative w-full md:w-80" role="search"><label htmlFor="catalog-search" className="sr-only">بحث في الكتالوج</label><input id="catalog-search" type="search" name="query" defaultValue={sp.query || ''} placeholder="بحث بالاسم أو SKU أو الباركود" className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200" /><input type="hidden" name="category" value={sp.category || ''} /><input type="hidden" name="brand" value={sp.brand || ''} /><input type="hidden" name="sort" value={sort} /><button type="submit" aria-label="بحث" className="absolute right-3 top-2.5 text-slate-400"><Search className="w-4 h-4" /></button></form></div>
    <div className="flex flex-wrap items-center gap-2"><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"><Link href={href({ category: undefined, page: undefined })} className={`min-h-[44px] inline-flex items-center px-4 rounded-xl text-xs font-bold ${!sp.category ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>{isAr ? 'كل التصنيفات' : 'All categories'}</Link>{categories.map((cat) => <Link key={cat.id} href={href({ category: cat.slug, page: undefined })} className={`min-h-[44px] inline-flex items-center px-4 rounded-xl text-xs font-bold whitespace-nowrap ${sp.category === cat.slug ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>{isAr ? cat.nameAr : cat.nameEn}</Link>)}</div><CatalogSortSelect value={sort} isAr={isAr} /></div>
    {brands.length > 0 && <div className="flex gap-2 overflow-x-auto pb-2"><Link href={href({ brand: undefined, page: undefined })} className={`min-h-[44px] inline-flex items-center rounded-full border px-3 text-xs ${!sp.brand ? 'status-info' : 'border-slate-700 text-slate-400'}`}>{isAr ? 'كل الماركات' : 'All brands'}</Link>{brands.map((brand) => <Link key={brand.id} href={href({ brand: brand.slug, page: undefined })} className={`min-h-[44px] inline-flex items-center rounded-full border px-3 text-xs ${sp.brand === brand.slug ? 'status-info' : 'border-slate-700 text-slate-400'}`}>{isAr ? brand.nameAr : brand.nameEn}</Link>)}</div>}
    {products.length === 0 ? <div className="p-12 text-center glass-panel rounded-3xl"><p className="text-slate-400 text-sm">{isAr ? 'لم نجد منتجات.' : 'No products found.'}</p><Link href="/catalog" className="text-xs font-bold text-blue-300">{isAr ? 'عرض الكل' : 'View all'}</Link></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">{products.map((product) => <ProductCard key={product.id} product={{ ...product, price: num(product.price) }} />)}</div>}
    <div className="flex items-center justify-center gap-2"><Link aria-disabled={page <= 1} href={href({ page: String(Math.max(1, page - 1)) })} className={`min-h-[44px] inline-flex items-center rounded-xl border border-slate-700 px-4 text-xs ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>{isAr ? 'السابق' : 'Previous'}</Link><span className="text-xs text-slate-400">{page} / {totalPages}</span><Link aria-disabled={page >= totalPages} href={href({ page: String(Math.min(totalPages, page + 1)) })} className={`min-h-[44px] inline-flex items-center rounded-xl border border-slate-700 px-4 text-xs ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>{isAr ? 'التالي' : 'Next'}</Link></div>
  </main>;
}
