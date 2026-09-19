import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { StatusBadge, PayLabel } from '@/components/admin/ui';
import { prisma } from '@/lib/db';
import { DollarSign, ShoppingBag, Layers, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalOrdersCount, totalSalesCount, branchesCount, productsCount, orders, lowStockItems, todayOrders, todaySales] = await Promise.all([
    prisma.order.count(),
    prisma.sale.count(),
    prisma.branch.count(),
    prisma.product.count(),
    prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
    prisma.branchInventory.findMany({
      where: { stockQuantity: { lte: 5 } },
      include: { product: true, branch: true },
      take: 5,
    }),
    prisma.order.findMany({ where: { createdAt: { gte: startOfToday } } }),
    prisma.sale.findMany({ where: { createdAt: { gte: startOfToday } } }),
  ]);

  const todayRevenue =
    todayOrders.reduce((s, o) => s + o.totalAmount, 0) + todaySales.reduce((s, x) => s + x.totalAmount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-slate-100">Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ… ÙˆØ§Ù„Ù…Ù„Ø®Øµ Ø§Ù„Ø¹Ø§Ù…</h1>
              <p className="text-xs text-slate-400 mt-0.5">Ù…ØªØ§Ø¨Ø¹Ø© Ù…Ø¨ÙŠØ¹Ø§Øª ÙØ±Ø¹ Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙˆØ§Ù„ÙØ±ÙˆØ¹ ÙˆÙ…Ø³ØªÙˆÙŠØ§Øª Ø§Ù„ØªÙˆØ±ÙŠØ¯</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
              Ù…Ø­Ø¯Ø« Ù…Ø¨Ø§Ø´Ø±Ø©
            </span>
          </div>

          {/* KPI Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/orders" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-blue-500/40 transition-all animate-fade-up">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ©</span>
                <ShoppingBag className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-3xl font-black text-slate-100">{totalOrdersCount}</div>
              <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> {todayOrders.length} Ø·Ù„Ø¨ Ø§Ù„ÙŠÙˆÙ…
              </div>
            </Link>

            <Link href="/admin/accounting" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-emerald-500/40 transition-all animate-fade-up">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Ø¥ÙŠØ±Ø§Ø¯ Ø§Ù„ÙŠÙˆÙ… (Online + POS)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-slate-100">{todayRevenue.toLocaleString()} <span className="text-sm text-slate-400">Ø¬.Ù…</span></div>
              <div className="text-[11px] text-slate-400">{totalSalesCount} Ø¹Ù…Ù„ÙŠØ© ÙƒØ§Ø´ÙŠØ± Ø¥Ø¬Ù…Ø§Ù„Ø§Ù‹</div>
            </Link>

            <Link href="/admin/products" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-purple-500/40 transition-all animate-fade-up">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Ø§Ù„Ø£ØµÙ†Ø§Ù ÙÙŠ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-black text-slate-100">{productsCount}</div>
              <div className="text-[11px] text-slate-400">Ù…Ù†ØªØ¬Ø§Øª Ø±ÙŠØ§Ø¶ÙŠØ© Ù†Ø´Ø·Ø©</div>
            </Link>

            <Link href="/admin/settings" className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-amber-500/40 transition-all animate-fade-up">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Ø§Ù„ÙØ±ÙˆØ¹ Ø§Ù„Ù†Ø´Ø·Ø©</span>
                <MapPin className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black text-slate-100">{branchesCount}</div>
              <div className="text-[11px] text-amber-400 font-bold">ÙØ±Ø¹ Ø§Ù„Ø¥Ø¨Ø±Ø§Ù‡ÙŠÙ…ÙŠØ© + Ø³Ù…ÙˆØ­Ø©</div>
            </Link>
          </div>

          {/* Low Stock Alerts & Recent Orders */}
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-sm text-slate-100">Ø£Ø­Ø¯Ø« Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ÙˆØ§Ø±Ø¯Ø©</h3>
                <Link href="/admin/orders" className="text-xs font-bold text-blue-400 hover:underline">
                  Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø·Ù„Ø¨Ø§Øª
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="pb-2">Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨</th>
                      <th className="pb-2">Ø§Ù„Ø¹Ù…ÙŠÙ„</th>
                      <th className="pb-2">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹</th>
                      <th className="pb-2">Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„ÙƒÙ„ÙŠ</th>
                      <th className="pb-2">Ø§Ù„Ø­Ø§Ù„Ø©</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-900/50">
                        <td className="py-3 font-bold text-amber-400">{ord.orderNumber}</td>
                        <td className="py-3 font-medium text-slate-200">{ord.guestName || ord.guestPhone}</td>
                        <td className="py-3 text-slate-300"><PayLabel value={ord.paymentMethod} /></td>
                        <td className="py-3 font-bold text-slate-100">{ord.totalAmount.toLocaleString()} Ø¬.Ù…</td>
                        <td className="py-3"><StatusBadge value={ord.orderStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length === 0 && <div className="text-center text-xs text-slate-500 py-8">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø·Ù„Ø¨Ø§Øª Ø¨Ø¹Ø¯.</div>}
              </div>
            </div>

            <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ù†ÙˆØ§Ù‚Øµ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†</span>
                </div>
                <div className="flex gap-2">
                  <Link href="/admin/inventory" className="text-[11px] font-bold text-blue-400 hover:underline">Ø§Ù„Ù…Ø®Ø²ÙˆÙ†</Link>
                  <Link href="/admin/purchasing" className="text-[11px] font-bold text-emerald-400 hover:underline">Ø£Ù…Ø± ØªÙˆØ±ÙŠØ¯</Link>
                </div>
              </div>

              <div className="space-y-3">
                {lowStockItems.length === 0 && <div className="text-xs text-slate-500 text-center py-6">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ÙˆØ§Ù‚Øµ Ø­Ø§Ù„ÙŠØ§Ù‹.</div>}
                {lowStockItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                    <div className="font-bold text-slate-200 line-clamp-1">{item.product.nameAr}</div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Ø§Ù„ÙØ±Ø¹: {item.branch.name}</span>
                      <span className="text-rose-400 font-bold">Ù…ØªØ¨Ù‚ÙŠ: {item.stockQuantity} Ù‚Ø·Ø¹Ø©</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
