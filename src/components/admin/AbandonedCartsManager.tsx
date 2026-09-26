'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  ShoppingCart,
  MessageCircle,
  TrendingDown,
  Sparkles,
  Search,
  Clock,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

export interface AbandonedCartItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  totalAmount: number;
  itemsCount: number;
  itemsSummary: string;
  createdAt: string;
  paymentMethod: string;
}

export default function AbandonedCartsManager({
  carts,
}: {
  carts: AbandonedCartItem[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');
  const { toast } = useToast();

  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    let totalAbandonedValue = 0;
    carts.forEach((c) => {
      totalAbandonedValue += c.totalAmount;
    });

    return {
      count: carts.length,
      totalValue: totalAbandonedValue,
      potentialRecovery: Math.round(totalAbandonedValue * 0.35), // typical 35% recovery rate with discount
    };
  }, [carts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return carts;
    return carts.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.orderNumber.toLowerCase().includes(q)
    );
  }, [carts, search]);

  const handleSendRecoveryWhatsApp = (c: AbandonedCartItem) => {
    const cleanPhone = c.customerPhone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const total = c.totalAmount.toLocaleString();

    const msg = isAr
      ? `أهلاً ${c.customerName} 👋 لاحظنا أنك تركت سلة مشترياتك في متجر سبورتس بقيمة ${total} ${currencyLabel} دون إكمال الطلب.\n\nيسرنا أن نقدم لك كود خصم خاص (RECOVER10) يمنحك خصم 10% إضافي وشحن سريع لطلبك! هل ترغب في مساعدتك لإتمام الطلب الآن؟`
      : `Hi ${c.customerName} 👋 We noticed you left items in your cart at Sports valued at ${total} ${currencyLabel}.\n\nUse voucher (RECOVER10) for an extra 10% off and fast shipping! Would you like us to assist you in completing your order?`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
    toast(L('تم فتح تطبيق واتساب لإرسال رسالة الاستعادة', 'WhatsApp opened with recovery message'), 'success');
  };

  const getTimeElapsed = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
    if (diff < 1) return L('منذ أقل من ساعة', '< 1 hour ago');
    if (diff < 24) return `${Math.floor(diff)} ${L('ساعة مضت', 'hours ago')}`;
    const days = Math.floor(diff / 24);
    return `${days} ${L('أيام مضت', 'days ago')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي السلات المتروكة', 'Abandoned Carts')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{stats.count}</span>
            <span className="text-xs text-slate-400 ms-2">{L('سلة غير مكتملة', 'carts')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('طلبات لم يتم سدادها في المتجر', 'Unpaid online checkout sessions')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('القيمة المالية المفقودة', 'Lost Cart Value')}</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">{stats.totalValue.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-rose-400/80 mt-1">{L('قيمة المنتجات المتروكة بالسلات', 'Total value of abandoned checkouts')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('المبيعات المتوقع استردادها', 'Recoverable Potential')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{stats.potentialRecovery.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('بإرسال حافز خصم وتذكير واتساب', 'With WhatsApp incentive follow-up')}</p>
        </div>
      </div>

      {/* Recovery Promotion Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900/80 to-blue-950/30 border border-amber-500/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              {L('استراتيجية استرجاع السلات الذكية عبر واتساب', 'Smart Cart Recovery Funnel')}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {L(
                'تواصل مباشرة مع العميل وقدم كود خصم RECOVER10 لإتمام عملية الشراء فوراً.',
                'Contact abandoned buyers via WhatsApp with incentive code RECOVER10.'
              )}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Voucher: RECOVER10 (10% OFF)
        </span>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث باسم العميل أو رقم الهاتف...', 'Search customer or phone...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Abandoned Carts Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('العميل وبيانات الاتصال', 'Customer & Contact')}</th>
              <th className="p-3.5 text-start">{L('محتويات السلة', 'Cart Items')}</th>
              <th className="p-3.5 text-center">{L('قيمة السلة', 'Cart Value')}</th>
              <th className="p-3.5 text-center">{L('طريقة الدفع المختارة', 'Payment Method')}</th>
              <th className="p-3.5 text-center">{L('وقت الترك', 'Abandoned')}</th>
              <th className="p-3.5 text-end">{L('إجراء الاسترجاع', 'Recovery Action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  {L('لا توجد سلات متروكة حالياً — كل الطلبات مكتملة بنجاح!', 'No abandoned carts found — all orders are active!')}
                </td>
              </tr>
            ) : (
              filtered.map((cart) => (
                <tr key={cart.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-100">{cart.customerName}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                      {cart.customerPhone}
                    </div>
                    {cart.deliveryAddress && (
                      <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                        {cart.deliveryAddress}
                      </div>
                    )}
                  </td>

                  <td className="p-3.5">
                    <div className="font-medium text-slate-200 line-clamp-1">{cart.itemsSummary}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {cart.itemsCount} {L('قطع رياضية', 'items')}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="font-black text-rose-400 text-sm">
                      {cart.totalAmount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500 ms-1">{currencyLabel}</span>
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {cart.paymentMethod}
                    </span>
                  </td>

                  <td className="p-3.5 text-center text-slate-400 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      {getTimeElapsed(cart.createdAt)}
                    </span>
                  </td>

                  <td className="p-3.5 text-end">
                    <button
                      onClick={() => handleSendRecoveryWhatsApp(cart)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {L('استعادة عبر واتساب', 'Recover on WhatsApp')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
