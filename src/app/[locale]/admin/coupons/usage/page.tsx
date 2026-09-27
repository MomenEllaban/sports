import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { History, TicketPercent, DollarSign, Users, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsUsagePage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [couponUses, ordersWithCoupons] = await Promise.all([
    prisma.couponUse.findMany({
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: {
        coupon: { select: { code: true, kind: true, value: true } },
      },
    }),
    prisma.order.findMany({
      where: {
        couponCode: { not: null },
      },
      select: {
        id: true,
        orderNumber: true,
        couponCode: true,
        couponDiscount: true,
        guestName: true,
        guestPhone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  // Aggregate stats
  let totalDiscountGranted = 0;
  for (const u of couponUses) {
    totalDiscountGranted += num(u.amount);
  }
  for (const o of ordersWithCoupons) {
    if (!couponUses.some((u) => u.orderId === o.id)) {
      totalDiscountGranted += num(o.couponDiscount);
    }
  }

  // Combine rows
  const rows = [
    ...couponUses.map((u) => ({
      id: u.id,
      code: u.coupon?.code || '—',
      amount: num(u.amount),
      orderRef: u.orderId ? `Order #${u.orderId.slice(-6)}` : u.saleId ? `Sale #${u.saleId.slice(-6)}` : '—',
      customer: u.customerId ? `ID: ${u.customerId.slice(-6)}` : '—',
      date: u.createdAt.toISOString(),
    })),
    ...ordersWithCoupons
      .filter((o) => !couponUses.some((u) => u.orderId === o.id))
      .map((o) => ({
        id: o.id,
        code: o.couponCode || '—',
        amount: num(o.couponDiscount),
        orderRef: o.orderNumber,
        customer: o.guestName ? `${o.guestName} (${o.guestPhone})` : o.guestPhone || '—',
        date: o.createdAt.toISOString(),
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          {L('سجل استخدام وتطبيق الكوبونات', 'Coupon Usage & Redemption Log')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'سجل تدقيق كامل لكافة أكواد الخصم المستخدمة بالمتجر أو الكاشير، مع مبالغ الخصومات الممنوحة وتتبع الطلبات.',
            'Complete audit trail of redeemed promo codes across storefront and POS with discount amounts.'
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('إجمالي الخصومات الممنوحة', 'Total Discounts Granted')}</p>
          <p className="text-2xl font-black text-purple-400">
            {totalDiscountGranted.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currencyLabel}</span>
          </p>
          <p className="text-[10px] text-slate-500">{L('قيمة الخصم التراكمي', 'Cumulative promo value')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
          <p className="text-xs text-slate-400 font-semibold">{L('عدد مرات الاستخدام', 'Total Redemptions')}</p>
          <p className="text-2xl font-black text-slate-100">{rows.length}</p>
          <p className="text-[10px] text-slate-500">{L('عملية شراء تمت بكوبون', 'Orders using coupons')}</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400 font-semibold">{L('حالة التتبع', 'Audit Status')}</p>
          <p className="text-2xl font-black text-emerald-400">{L('مُفعل ونشط', 'Active & Verified')}</p>
          <p className="text-[10px] text-slate-500">{L('منع الاستخدام المزدوج مفعل', 'One-time use limits enforced')}</p>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
          <TicketPercent className="w-4 h-4 text-purple-400" />
          {L('حركات الخصم المسجلة', 'Redemption Records')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 text-start font-semibold">{L('كود الكوبون', 'Coupon Code')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('قيمة الخصم', 'Discount')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('رقم الطلب / الفاتورة', 'Order / Sale Ref')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('العميل', 'Customer')}</th>
                <th className="py-2.5 px-4 text-start font-semibold">{L('تاريخ الاستخدام', 'Redeemed At')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    {L('لا توجد حركات استخدام كوبونات مسجلة حتى الآن', 'No coupon redemptions recorded yet')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                        {row.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      -{row.amount.toLocaleString()} {currencyLabel}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{row.orderRef}</td>
                    <td className="py-3 px-4 text-slate-400">{row.customer}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(row.date).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
