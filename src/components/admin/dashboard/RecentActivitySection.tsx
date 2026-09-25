import React from 'react';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { StatusBadge } from '@/components/admin/ui';
import { AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default async function RecentActivitySection() {
  const [recentOrders, lowStockItems] = await Promise.all([
    prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
    prisma.branchInventory.findMany({
      where: { stockQuantity: { lte: 5 } },
      include: { product: { select: { nameAr: true } }, branch: { select: { name: true } } },
      take: 5,
    }),
  ]);

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-sm text-slate-100">أحدث الطلبات الواردة</h3>
          <Link href="/admin/orders" className="min-h-[44px] flex items-center text-xs font-bold text-blue-400 hover:underline">
            عرض جميع الطلبات
          </Link>
        </div>

        <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs text-start">
            <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="pb-2">رقم الطلب</th>
                <th className="pb-2">العميل</th>
                <th className="pb-2">طريقة الدفع</th>
                <th className="pb-2">المبلغ الكلي</th>
                <th className="pb-2">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-900/50">
                  <td className="py-3 font-bold text-amber-400">{ord.orderNumber}</td>
                  <td className="py-3 font-medium text-slate-200">{ord.guestName || ord.guestPhone}</td>
                  <td className="py-3 text-slate-300">{ord.paymentMethod}</td>
                  <td className="py-3 font-bold text-slate-100">{num(ord.totalAmount).toLocaleString()} ج.م</td>
                  <td className="py-3"><StatusBadge value={ord.orderStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentOrders.length === 0 && <div className="text-center text-xs text-slate-500 py-8">لا توجد طلبات بعد.</div>}
        </div>
      </div>

      <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>تنبيهات نواقص المخزون</span>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/inventory" className="min-h-[44px] flex items-center text-[11px] font-bold text-blue-400 hover:underline">المخزون</Link>
            <Link href="/admin/purchasing" className="min-h-[44px] flex items-center text-[11px] font-bold text-emerald-400 hover:underline">أمر توريد</Link>
          </div>
        </div>

        <div className="space-y-3">
          {lowStockItems.length === 0 && <div className="text-xs text-slate-500 text-center py-6">لا توجد نواقص حالياً.</div>}
          {lowStockItems.map((item) => (
            <div key={item.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
              <div className="font-bold text-slate-200 line-clamp-1">{item.product.nameAr}</div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>الفرع: {item.branch.name}</span>
                <span className="text-rose-400 font-bold">متبقي: {item.stockQuantity} قطعة</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
