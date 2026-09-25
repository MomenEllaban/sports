import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { DollarSign, ShoppingBag, Layers, MapPin, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default async function KpiCardsSection() {
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    todayOrdersAgg,
    todaySalesAgg,
    todayOrdersCount,
    todaySalesCount,
    totalOrdersCount,
    totalSalesCount,
    branchesCount,
    productsCount,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true, taxAmount: true } }),
    prisma.sale.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true, taxAmount: true } }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.sale.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.count(),
    prisma.sale.count(),
    prisma.branch.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  const todayRevenue = num(todayOrdersAgg._sum.totalAmount) + num(todaySalesAgg._sum.totalAmount);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Link href="/admin/orders" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-blue-500/40 transition-all animate-fade-up">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>{L('إجمالي الطلبات الإلكترونية', 'Total online orders')}</span>
          <ShoppingBag className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-3xl font-black text-slate-100">{totalOrdersCount}</div>
        <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" /> {todayOrdersCount} {L('طلب اليوم', 'orders today')}
        </div>
      </Link>

      <Link href="/admin/accounting" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-emerald-500/40 transition-all animate-fade-up">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>{L('إيراد اليوم (Online + POS)', "Today's revenue (Online + POS)")}</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-3xl font-black text-slate-100">{todayRevenue.toLocaleString()} <span className="text-sm text-slate-400">{L('ج.م', 'EGP')}</span></div>
        <div className="text-[11px] text-slate-400">{todaySalesCount} {L('عملية كاشير اليوم', 'POS sales today')} • {totalSalesCount} {L('إجمالاً', 'total')}</div>
      </Link>

      <Link href="/admin/products" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-purple-500/40 transition-all animate-fade-up">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>{L('الأصناف في الكتالوج', 'Catalog items')}</span>
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-3xl font-black text-slate-100">{productsCount}</div>
        <div className="text-[11px] text-slate-400">{L('منتجات رياضية نشطة', 'active sports products')}</div>
      </Link>

      <Link href="/admin/settings" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-amber-500/40 transition-all animate-fade-up">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>{L('الفروع النشطة', 'Active branches')}</span>
          <MapPin className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-3xl font-black text-slate-100">{branchesCount}</div>
        <div className="text-[11px] text-amber-400 font-bold">{L('فرع الإبراهيمية + سموحة', 'Ibrahimeyah + Smouha branches')}</div>
      </Link>
    </div>
  );
}
