import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import OrdersManager from '@/components/admin/OrdersManager';
import { prisma } from '@/lib/db';

export const revalidate = 10;

export default async function AdminOrdersPage() {
  const [orders, products, branches] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true, price: true } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-slate-100">إدارة الطلبات والشحنات</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                جدول الطلبات الموحد (Online / POS / WhatsApp) ومتابعة شركات الشحن (بوسطة/مايلرز)
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden animate-fade-up">
            <OrdersManager
              orders={orders.map((o) => ({
                ...o,
                createdAt: o.createdAt.toISOString(),
                updatedAt: o.updatedAt.toISOString(),
              }))}
              products={products}
              branches={branches}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
