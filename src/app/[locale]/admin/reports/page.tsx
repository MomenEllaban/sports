import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { BarChart3, TrendingUp, Award, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const [orderItems, saleItems, inventories] = await Promise.all([
    prisma.orderItem.findMany({ include: { product: true } }),
    prisma.saleItem.findMany({ include: { product: true } }),
    prisma.branchInventory.findMany({ include: { product: true, branch: true } }),
  ]);

  // Best sellers by actual sold quantity (orders + POS)
  const qtyByProduct = new Map<string, { nameAr: string; nameEn: string; qty: number; revenue: number }>();
  for (const it of [...orderItems, ...saleItems]) {
    const cur = qtyByProduct.get(it.productId) || { nameAr: it.product.nameAr, nameEn: it.product.nameEn, qty: 0, revenue: 0 };
    cur.qty += it.quantity;
    cur.revenue += it.totalPrice;
    qtyByProduct.set(it.productId, cur);
  }
  const bestSellers = [...qtyByProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Real inventory valuation
  let sellValue = 0;
  let costValue = 0;
  const productCache = new Map<string, { price: number; costPrice: number }>();
  const allProducts = await prisma.product.findMany({ select: { id: true, price: true, costPrice: true } });
  for (const p of allProducts) productCache.set(p.id, p);
  for (const inv of inventories) {
    const p = productCache.get(inv.productId);
    if (!p) continue;
    sellValue += p.price * inv.stockQuantity;
    costValue += p.costPrice * inv.stockQuantity;
  }
  const margin = sellValue - costValue;
  const marginPct = sellValue > 0 ? Math.round((margin / sellValue) * 100) : 0;

  // Revenue by source
  const orderRevenue = orderItems.reduce((s, i) => s + i.totalPrice, 0);
  const posRevenue = saleItems.reduce((s, i) => s + i.totalPrice, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ± Ø§Ù„ØªØ­Ù„ÙŠÙ„ÙŠØ© ÙˆØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Ù…Ù‚Ø§Ø±Ù†Ø© Ø£Ø¯Ø§Ø¡ Ø§Ù„ÙØ±ÙˆØ¹ØŒ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± Ù…Ø¨ÙŠØ¹Ø§Ù‹ØŒ ÙˆØ­Ø¬Ù… Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ù…Ø§Ù„ÙŠ</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1 animate-fade-up">
              <div className="flex items-center gap-2 text-xs text-slate-400"><TrendingUp className="w-4 h-4 text-blue-400" /> Ø¥ÙŠØ±Ø§Ø¯ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø£ÙˆÙ†Ù„Ø§ÙŠÙ† (Ø¨Ø¯ÙˆÙ† Ø¶Ø±ÙŠØ¨Ø©)</div>
              <div className="text-2xl font-black text-blue-400">{orderRevenue.toLocaleString()} Ø¬.Ù…</div>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1 animate-fade-up">
              <div className="flex items-center gap-2 text-xs text-slate-400"><TrendingUp className="w-4 h-4 text-emerald-400" /> Ø¥ÙŠØ±Ø§Ø¯ Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„ÙƒØ§Ø´ÙŠØ± (Ø¨Ø¯ÙˆÙ† Ø¶Ø±ÙŠØ¨Ø©)</div>
              <div className="text-2xl font-black text-emerald-400">{posRevenue.toLocaleString()} Ø¬.Ù…</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Ø§Ù„Ø£ÙƒØ«Ø± Ù…Ø¨ÙŠØ¹Ø§Ù‹ Ø¨Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© (Best Sellers)
              </h3>
              <div className="space-y-3 text-xs">
                {bestSellers.length === 0 && <div className="text-slate-500 text-center py-6">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø¨ÙŠØ¹Ø§Øª Ù…Ø³Ø¬Ù„Ø© Ø¨Ø¹Ø¯.</div>}
                {bestSellers.map((p, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-900 flex justify-between items-center">
                    <span className="font-bold text-slate-200">{i + 1}. {p.nameAr} <span className="text-slate-500">({p.qty} Ù‚Ø·Ø¹Ø©)</span></span>
                    <span className="font-black text-amber-400">{p.revenue.toLocaleString()} Ø¬.Ù…</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
              <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                ØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ Ù„ÙƒÙ„ Ø§Ù„ÙØ±ÙˆØ¹
              </h3>
              <div className="p-4 rounded-2xl bg-slate-900 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø¨ÙŠØ¹ÙŠØ© Ù„Ù„Ù…Ø®Ø²ÙˆÙ†:</span>
                  <span className="font-bold text-slate-100">{sellValue.toLocaleString()} Ø¬.Ù…</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ ØªÙƒÙ„ÙØ© Ø§Ù„Ø´Ø±Ø§Ø¡:</span>
                  <span className="font-bold text-slate-100">{costValue.toLocaleString()} Ø¬.Ù…</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold pt-2 border-t border-slate-800">
                  <span>Ù‡Ø§Ù…Ø´ Ø§Ù„Ø±Ø¨Ø­ Ø§Ù„Ù…ØªÙˆÙ‚Ø¹:</span>
                  <span>{margin.toLocaleString()} Ø¬.Ù… ({marginPct}%)</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
