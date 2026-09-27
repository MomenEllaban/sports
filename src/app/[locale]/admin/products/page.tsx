import React from 'react';
import { getLocale } from 'next-intl/server';
import ProductsManager from '@/components/admin/ProductsManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { productWhere, scopedInventoryWhere } from '@/lib/products/query';

export const dynamic = 'force-dynamic';
type SearchParams = Promise<{ query?: string; categoryId?: string; brandId?: string; status?: string; page?: string }>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const sp = await searchParams;
  const pageSize = 8;
  const page = Math.max(1, Number(sp.page || 1) || 1);

  // Shared with the CSV export endpoint so an export can never cover a
  // different set of rows than the table.
  const where = productWhere({
    query: sp.query,
    categoryId: sp.categoryId,
    brandId: sp.brandId,
    status: sp.status,
  });

  // A BRANCH_MANAGER must not be able to read stock numbers for branches they
  // were not assigned. `null` means "every branch" (SUPER_ADMIN / FINANCE).
  const inventoryWhere = scopedInventoryWhere(session);

  const [products, total, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        brand: true,
        inventories: { where: inventoryWhere, include: { branch: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { nameAr: 'asc' } }),
    prisma.brand.findMany({ orderBy: { nameAr: 'asc' } }),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'كتالوج المنتجات والمعدات' : 'Product & equipment catalog'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'إدارة الأصناف والأسعار. أرصدة الفروع تُدار من صفحة المخزون.'
            : 'Manage items and prices. Per-branch balances live in the inventory page.'}
        </p>
      </div>
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
        <ProductsManager
          products={products.map((p) => ({
            ...p,
            price: num(p.price),
            costPrice: num(p.costPrice),
          }))}
          categories={categories}
          brands={brands}
          serverSide
          totalCount={total}
          initialPage={page}
          initialSearch={sp.query || ''}
          initialCategoryId={sp.categoryId || ''}
          initialBrandId={sp.brandId || ''}
          initialStatus={sp.status || ''}
        />
      </div>
    </>
  );
}
