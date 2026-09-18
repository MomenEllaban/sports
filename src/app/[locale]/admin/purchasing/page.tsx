import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { Truck, Plus, FileText, Phone, Mail } from 'lucide-react';

export const revalidate = 10;

export default async function AdminPurchasingPage() {
  const suppliers = await prisma.supplier.findMany();
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: { supplier: true, branch: true },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-slate-100">المشتريات والموردون</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                سجل الموردين المعتمَدين وأوامر توريد البضائع والمستلزمات الرياضية
              </p>
            </div>

            <button className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25">
              <Plus className="w-4 h-4" />
              أمر توريد جديد (PO)
            </button>
          </div>

          {/* Suppliers Grid */}
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

            {/* Purchase Orders List */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
                أوامر الشراء والتوريد (Purchase Orders)
              </h3>
              {purchaseOrders.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-12">
                  لا توجد أوامر توريد مسجلة حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between font-bold">
                        <span className="text-amber-400">{po.poNumber}</span>
                        <span className="text-emerald-400">{po.status}</span>
                      </div>
                      <div className="text-slate-300">المورد: {po.supplier.name}</div>
                      <div className="text-slate-400">موجّه لفرع: {po.branch.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
