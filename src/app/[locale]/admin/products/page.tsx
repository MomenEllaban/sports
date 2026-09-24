import React from 'react';
import ProductsManager from '@/components/admin/ProductsManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
type SearchParams = Promise<{ query?: string; categoryId?: string; brandId?: string; status?: string; page?: string }>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const sp = await searchParams; const pageSize = 8; const page = Math.max(1, Number(sp.page || 1) || 1);
  const where: Prisma.ProductWhereInput = { ...(sp.query ? { OR: [{ nameAr: { contains: sp.query, mode: 'insensitive' } }, { nameEn: { contains: sp.query, mode: 'insensitive' } }, { sku: { contains: sp.query, mode: 'insensitive' } }, { barcode: { contains: sp.query, mode: 'insensitive' } }] } : {}), ...(sp.categoryId ? { categoryId: sp.categoryId } : {}), ...(sp.brandId ? { brandId: sp.brandId } : {}), ...(sp.status === 'active' ? { isActive: true } : sp.status === 'inactive' ? { isActive: false } : {}) };
  const [products, total, categories, brands] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { category: true, brand: true, inventories: { include: { branch: true } } } }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { nameAr: 'asc' } }),
    prisma.brand.findMany({ orderBy: { nameAr: 'asc' } }),
  ]);
  return <><div><h1 className="text-2xl font-black text-slate-100">كتالوج المنتجات والمعدات</h1><p className="text-xs text-slate-400 mt-0.5">إدارة الأصناف والأسعار مع pagination وفلاتر URL.</p></div><div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up"><ProductsManager products={products.map((p) => ({ ...p, price: num(p.price), costPrice: num(p.costPrice) }))} categories={categories} brands={brands} serverSide totalCount={total} initialPage={page} initialSearch={sp.query || ''} /></div></>;
}
