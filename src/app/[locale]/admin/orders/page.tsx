import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { ShoppingBag, Truck, CheckCircle, Clock, Filter, Eye } from 'lucide-react';

export const revalidate = 10;

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      branch: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
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

          {/* Unified Orders Table */}
          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-200">إجمالي الطلبات: {orders.length} طلب</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">تصفية حسب المصدر:</span>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300">الكل</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">رقم الطلب</th>
                    <th className="p-3">المصدر</th>
                    <th className="p-3">العميل والموبايل</th>
                    <th className="p-3">عنوان الشحن</th>
                    <th className="p-3">شركة الشحن / التتبع</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">المبلغ الكلي</th>
                    <th className="p-3">حالة الطلب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-amber-400">{ord.orderNumber}</td>
                      <td className="p-3 font-semibold text-slate-300">{ord.orderSource}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-100">{ord.guestName || 'عميل'}</div>
                        <div className="text-[10px] text-slate-400" dir="ltr">{ord.guestPhone}</div>
                      </td>
                      <td className="p-3 max-w-[180px] truncate text-slate-300">{ord.deliveryAddress}</td>
                      <td className="p-3">
                        <span className="font-bold text-blue-400 block">{ord.shippingProvider}</span>
                        <span className="text-[10px] text-slate-400">{ord.trackingNumber || 'بدون'}</span>
                      </td>
                      <td className="p-3 text-slate-300">{ord.paymentMethod}</td>
                      <td className="p-3 font-black text-slate-100">{ord.totalAmount.toLocaleString()} ج.م</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                          {ord.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
