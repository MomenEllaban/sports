import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import PurchasingManager from '@/components/admin/PurchasingManager';
import { prisma } from '@/lib/db';
import { Phone } from 'lucide-react';

export const revalidate = 10;

export default async function AdminPurchasingPage() {
  const [suppliers, branches, products, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany(),
    prisma.branch.findMany({ select: { id: true, name: true, nameEn: true } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, nameAr: true, nameEn: true } }),
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, branch: true, items: { include: { product: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-100">المشتريات والموردون</h1>
            <p className="text-xs text-slate-400 mt-0.5">سجل الموردين المعتمَدين وأوامر توريد البضائع والمستلزمات الرياضية</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
                دليل الموردين والشركات ({suppliers.length})
              </h3>
              <div className="space-y-3">
                {suppliers.map((sup) => (
                  <div key={sup.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-slate-100">{sup.name}</span>
                      <span className="text-amber-400 font-bold">{sup.code}</span>
                    </div>
                    <div className="text-slate-400 space-y-1">
                      <div>مسئول الاتصال: {sup.contactPerson || 'غير محدد'}</div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        <span dir="ltr">{sup.phone}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">الملف الضريبي: {sup.taxNumber || 'غير مدخل'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
              <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
                أوامر الشراء والتوريد (Purchase Orders)
              </h3>
              <PurchasingManager
                suppliers={suppliers}
                branches={branches}
                products={products}
                purchaseOrders={purchaseOrders}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
