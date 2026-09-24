import React from 'react';
import PurchasingManager from '@/components/admin/PurchasingManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminPurchasingPage() {
  const session = await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const actor = session as unknown as { user?: { role?: string; branchIds?: string[] } };
  const [suppliers, branches, products, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, nameAr: true, nameEn: true, sku: true, barcode: true, costPrice: true },
    }),
    prisma.purchaseOrder.findMany({
      where: actor.user?.role === 'SUPER_ADMIN' ? undefined : { branch: { id: { in: actor.user?.branchIds || [] } } },
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, branch: true, items: { include: { product: true } } },
    }),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-black text-slate-100">أوامر التوريد والمشتريات</h1>
        <p className="text-xs text-slate-400 mt-0.5">إنشاء ومتابعة أوامر شراء البضائع والمستلزمات الرياضية</p>
      </div>
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
        <h2 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">أوامر الشراء والتوريد (Purchase Orders)</h2>
        <PurchasingManager
          suppliers={suppliers}
          branches={branches}
          products={products.map((p) => ({ ...p, costPrice: num(p.costPrice) }))}
          purchaseOrders={purchaseOrders.map((po) => ({
            ...po,
            totalAmount: num(po.totalAmount),
            items: po.items.map((i) => ({ ...i, unitCost: num(i.unitCost), product: { ...i.product, costPrice: num(i.product.costPrice) } })),
          }))}
        />
      </div>
    </>
  );
}
