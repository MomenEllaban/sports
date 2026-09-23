import React from 'react';
import { StatusBadge } from '@/components/admin/ui';
import { PageHeader } from '@/components/ui/foundation';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { DollarSign, ShoppingBag, Layers, MapPin, TrendingUp, AlertTriangle, Clock3, Inbox, Wallet, RotateCcw } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

/**
 * KPI dashboard (T11): DB-aggregated cards (no full scans), 7-day revenue
 * chart, and actionable queues (pending payments, receipts to review,
 * open shifts). Tablet-first responsive.
 */
export default async function AdminDashboardPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 6 * DAY);
  weekAgo.setHours(0, 0, 0, 0);

  const [
    todayOrdersAgg, todaySalesAgg, todayOrdersCount, todaySalesCount,
    totalOrdersCount, totalSalesCount, branchesCount, productsCount,
    pendingPay, receiptsToReview, openShifts, pendingReturns, weekOrders, weekSales,
    recentOrders, lowStockItems,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true, taxAmount: true } }),
    prisma.sale.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true, taxAmount: true } }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.sale.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.count(),
    prisma.sale.count(),
    prisma.branch.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.aggregate({
      where: { paymentStatus: 'PENDING', orderStatus: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { totalAmount: true }, _count: true,
    }),
    prisma.order.count({ where: { receiptImage: { not: null }, paymentStatus: 'PENDING' } }),
    prisma.shift.count({ where: { status: 'OPEN' } }),
    prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'RECEIVED', 'REFUND_PENDING'] } } }),
    prisma.order.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true } }),
    prisma.sale.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true } }),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
    prisma.branchInventory.findMany({
      where: { stockQuantity: { lte: 5 } },
      include: { product: { select: { nameAr: true } }, branch: { select: { name: true } } },
      take: 5,
    }),
  ]);

  const todayRevenue = num(todayOrdersAgg._sum.totalAmount) + num(todaySalesAgg._sum.totalAmount);
  const todayVat = num(todayOrdersAgg._sum.taxAmount) + num(todaySalesAgg._sum.taxAmount);
  const pendingAmount = num(pendingPay._sum.totalAmount);

  // 7-day revenue buckets (server-side, demo-scale).
  const days: Array<{ label: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toLocaleDateString('ar-EG', { weekday: 'short' });
    const sameDay = (t: Date) => t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate();
    const total = [...weekOrders, ...weekSales].filter((r) => sameDay(r.createdAt)).reduce((s, r) => s + num(r.totalAmount), 0);
    days.push({ label: key, total });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  return (
    <>
      <PageHeader
        title="لوحة التحكم والملخص العام"
        description={`إيراد اليوم ${todayRevenue.toLocaleString()} ج.م (منها ضريبة ${todayVat.toLocaleString()})`}
        actions={
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
            محدث مباشرة
          </span>
        }
      />

      {/* Action queues */}
      {(pendingPay._count > 0 || receiptsToReview > 0 || openShifts > 0 || pendingReturns > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pendingPay._count > 0 && (
            <Link href="/admin/orders" className="min-h-[44px] p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20">
              <Wallet className="w-4 h-4" />
              {pendingPay._count} طلب معلق الدفع ({pendingAmount.toLocaleString()} ج.م)
            </Link>
          )}
          {receiptsToReview > 0 && (
            <Link href="/admin/orders" className="min-h-[44px] p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20">
              <Inbox className="w-4 h-4" />
              {receiptsToReview} إيصال تحويل بانتظار المراجعة
            </Link>
          )}
          {openShifts > 0 && (
            <Link href="/admin/shifts" className="min-h-[44px] p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20">
              <Clock3 className="w-4 h-4" />
              {openShifts} وردية مفتوحة الآن
            </Link>
          )}
          {pendingReturns > 0 && (
            <Link href="/admin/returns" className="min-h-[44px] p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-2 text-xs font-bold text-orange-300 hover:bg-orange-500/20">
              <RotateCcw className="w-4 h-4" />
              {pendingReturns} مرتجع بانتظار إجراء (استلام / استرداد)
            </Link>
          )}
        </div>
      )}

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/orders" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-blue-500/40 transition-all animate-fade-up">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>إجمالي الطلبات الإلكترونية</span>
            <ShoppingBag className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-slate-100">{totalOrdersCount}</div>
          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> {todayOrdersCount} طلب اليوم
          </div>
        </Link>

        <Link href="/admin/accounting" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-emerald-500/40 transition-all animate-fade-up">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>إيراد اليوم (Online + POS)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-slate-100">{todayRevenue.toLocaleString()} <span className="text-sm text-slate-400">ج.م</span></div>
          <div className="text-[11px] text-slate-400">{todaySalesCount} عملية كاشير اليوم • {totalSalesCount} إجمالاً</div>
        </Link>

        <Link href="/admin/products" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-purple-500/40 transition-all animate-fade-up">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>الأصناف في الكتالوج</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-slate-100">{productsCount}</div>
          <div className="text-[11px] text-slate-400">منتجات رياضية نشطة</div>
        </Link>

        <Link href="/admin/settings" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-amber-500/40 transition-all animate-fade-up">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>الفروع النشطة</span>
            <MapPin className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-slate-100">{branchesCount}</div>
          <div className="text-[11px] text-amber-400 font-bold">فرع الإبراهيمية + سموحة</div>
        </Link>
      </div>

      {/* 7-day revenue chart (CSS bars, no deps) */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
        <h3 className="font-extrabold text-sm text-slate-100">إيراد آخر 7 أيام</h3>
        <div className="flex items-end gap-2 h-32" role="img" aria-label="7-day revenue chart">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-300 tabular-nums">{d.total >= 1000 ? `${Math.round(d.total / 1000)}k` : d.total}</span>
              <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-400 min-h-[4px]" style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }} />
              <span className="text-[10px] text-slate-500">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Low Stock Alerts & Recent Orders */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-slate-100">أحدث الطلبات الواردة</h3>
            <Link href="/admin/orders" className="min-h-[44px] flex items-center text-xs font-bold text-blue-400 hover:underline">
              عرض جميع الطلبات
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
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
    </>
  );
}
