import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { Users, Phone, Award, ShoppingBag } from 'lucide-react';

export const revalidate = 10;

export default async function AdminCustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      orders: true,
      addresses: true,
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
              <h1 className="text-2xl font-black text-slate-100">دليل العملاء ونقاط الولاء</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                سجل العملاء التراكمي (الهوية برقم الموبايل) وسجل الطلبات
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">اسم العميل</th>
                    <th className="p-3">رقم الموبايل</th>
                    <th className="p-3">نقاط الولاء</th>
                    <th className="p-3">العنوان الرئيسي</th>
                    <th className="p-3">عدد الطلبات</th>
                    <th className="p-3">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-slate-100">{c.name || 'عميل كريم'}</td>
                      <td className="p-3 font-bold text-amber-400" dir="ltr">{c.phone}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/30 flex items-center gap-1 w-fit">
                          <Award className="w-3.5 h-3.5" />
                          {c.loyaltyPoints} نقطة
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{c.addresses[0]?.street || 'غير محدد'}</td>
                      <td className="p-3 font-bold text-blue-400">{c.orders.length} طلبات</td>
                      <td className="p-3 text-slate-400">{c.createdAt.toLocaleDateString('ar-EG')}</td>
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
