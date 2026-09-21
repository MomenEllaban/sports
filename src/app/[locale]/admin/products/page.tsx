import React from 'react';
import ProductsManager from '@/components/admin/ProductsManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { category: true, brand: true, inventories: { include: { branch: true } } },
    }),
    prisma.category.findMany(),
    prisma.brand.findMany(),
  ]);

  return (
    <>
          <div>
            <h1 className="text-2xl font-black text-slate-100">كتالوج المنتجات والمعدات</h1>
            <p className="text-xs text-slate-400 mt-0.5">إدارة الأصناف، الأسعار، البار كود، واستيراد وتصدير CSV</p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <ProductsManager
              products={products.map((p) => ({ ...p, price: num(p.price), costPrice: num(p.costPrice) }))}
              categories={categories}
              brands={brands}
            />
          </div>
        </>
  );
}
