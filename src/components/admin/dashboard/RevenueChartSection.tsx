import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';

const DAY = 86_400_000;

export default async function RevenueChartSection() {
  const locale = await getLocale();
  const isAr = locale === 'ar';
  const weekAgo = new Date(Date.now() - 6 * DAY);
  weekAgo.setHours(0, 0, 0, 0);

  const [weekOrders, weekSales] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true } }),
    prisma.sale.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, totalAmount: true } }),
  ]);

  const days: Array<{ label: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', { weekday: 'short' });
    const sameDay = (t: Date) =>
      t.getFullYear() === d.getFullYear() &&
      t.getMonth() === d.getMonth() &&
      t.getDate() === d.getDate();
    const total = [...weekOrders, ...weekSales]
      .filter((r) => sameDay(r.createdAt))
      .reduce((s, r) => s + num(r.totalAmount), 0);
    days.push({ label: key, total });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
      <h3 className="font-extrabold text-sm text-slate-100">{isAr ? 'إيراد آخر 7 أيام' : 'Revenue over the last 7 days'}</h3>
      <div className="flex items-end gap-2 h-32" role="img" aria-label={isAr ? 'رسم بياني لإيرادات 7 أيام' : '7-day revenue chart'}>
        {days.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] font-bold text-slate-300 tabular-nums">
              {d.total >= 1000 ? `${Math.round(d.total / 1000)}k` : d.total}
            </span>
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-400 min-h-[4px]"
              style={{ height: `${Math.max(4, (d.total / maxDay) * 100)}%` }}
            />
            <span className="text-[10px] text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
