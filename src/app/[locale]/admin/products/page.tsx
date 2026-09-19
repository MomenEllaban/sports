import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import ProductsManager from '@/components/admin/ProductsManager';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { category: true, brand: true, inventories: { include: { branch: true } } },
    }),
    prisma.category.findMany(),
    prisma.brand.findMany(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-100">كتالوج المنتجات والمعدات</h1>
            <p className="text-xs text-slate-400 mt-0.5">إدارة الأصناف، الأسعار، البار كود، واستيراد وتصدير CSV</p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <ProductsManager products={products} categories={categories} brands={brands} />
          </div>
        </main>
      </div>
    </div>
  );
}
