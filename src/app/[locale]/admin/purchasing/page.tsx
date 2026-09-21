import React from 'react';
import PurchasingManager from '@/components/admin/PurchasingManager';
import SuppliersManager from '@/components/admin/SuppliersManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminPurchasingPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const [suppliers, branches, products, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ select: { id: true, name: true, nameEn: true } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, branch: true, items: { include: { product: true } } },
    }),
  ]);

  return (
    <>
          <div>
            <h1 className="text-2xl font-black text-slate-100">المشتريات والموردون</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              سجل الموردين المعتمَدين وأوامر توريد البضائع والمستلزمات الرياضية
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Suppliers Management */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
                دليل الموردين والشركات ({suppliers.length})
              </h3>
              <SuppliersManager suppliers={suppliers} />
            </div>

            {/* Purchase Orders Management */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
              <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
                أوامر الشراء والتوريد (Purchase Orders)
              </h3>
              <PurchasingManager
                suppliers={suppliers}
                branches={branches}
                products={products}
                purchaseOrders={purchaseOrders.map((po) => ({
                  ...po,
                  totalAmount: num(po.totalAmount),
                  items: po.items.map((i) => ({ ...i, unitCost: num(i.unitCost) })),
                }))}
              />
            </div>
          </div>
        </>
  );
}
