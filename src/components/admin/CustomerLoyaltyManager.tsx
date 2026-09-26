'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useLocale } from 'next-intl';
import {
  Award,
  Crown,
  Sparkles,
  TrendingUp,
  Search,
  PlusCircle,
  MinusCircle,
  MessageCircle,
  SlidersHorizontal,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface CustomerLoyaltyItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
}

export default function CustomerLoyaltyManager({
  customers: initialCustomers,
  earnRate = 10, // 1 point per 10 EGP
  pointValue = 0.5, // 1 point = 0.5 EGP
}: {
  customers: CustomerLoyaltyItem[];
  earnRate?: number;
  pointValue?: number;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);
  const currencyLabel = L('ج.م', 'EGP');
  const { toast } = useToast();

  const [customers, setCustomers] = useState<CustomerLoyaltyItem[]>(initialCustomers);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'>('ALL');

  // Modal state for point adjustment
  const [adjustingCustomer, setAdjustingCustomer] = useState<CustomerLoyaltyItem | null>(null);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getTier = useCallback((points: number): { key: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'; label: string; color: string; icon: typeof Crown } => {
    if (points >= 1000) {
      return { key: 'PLATINUM', label: L('بلاتيني', 'Platinum'), color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: Crown };
    }
    if (points >= 500) {
      return { key: 'GOLD', label: L('ذهبي', 'Gold'), color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Sparkles };
    }
    if (points >= 200) {
      return { key: 'SILVER', label: L('فضي', 'Silver'), color: 'text-slate-300 bg-slate-500/10 border-slate-500/30', icon: Award };
    }
    return { key: 'BRONZE', label: L('برونزي', 'Bronze'), color: 'text-amber-600 bg-amber-700/10 border-amber-700/30', icon: Award };
  }, [L]);

  const stats = useMemo(() => {
    let totalPoints = 0;
    let platinum = 0;
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    customers.forEach((c) => {
      totalPoints += c.loyaltyPoints;
      const tier = getTier(c.loyaltyPoints).key;
      if (tier === 'PLATINUM') platinum++;
      else if (tier === 'GOLD') gold++;
      else if (tier === 'SILVER') silver++;
      else bronze++;
    });

    const totalValue = totalPoints * pointValue;
    const avgPoints = customers.length > 0 ? Math.round(totalPoints / customers.length) : 0;

    return { totalPoints, totalValue, platinum, gold, silver, bronze, avgPoints };
  }, [customers, pointValue, getTier]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (tierFilter !== 'ALL') {
        const tier = getTier(c.loyaltyPoints).key;
        if (tier !== tierFilter) return false;
      }

      return true;
    });
  }, [customers, search, tierFilter, getTier]);

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingCustomer) return;
    if (adjustAmount <= 0) {
      toast(L('الرجاء إدخال عدد نقاط أكبر من الصفر', 'Please enter points greater than 0'), 'error');
      return;
    }

    const currentPts = adjustingCustomer.loyaltyPoints;
    const change = adjustType === 'ADD' ? adjustAmount : -adjustAmount;
    const newPoints = Math.max(0, currentPts + change);

    setIsSubmitting(true);
    try {
      await apiFetch(`/api/admin/customers/${adjustingCustomer.id}`, 'PATCH', {
        loyaltyPoints: newPoints,
      });

      setCustomers((prev) =>
        prev.map((c) => (c.id === adjustingCustomer.id ? { ...c, loyaltyPoints: newPoints } : c))
      );

      toast(
        L(
          `تم ${adjustType === 'ADD' ? 'إضافة' : 'خصم'} ${adjustAmount} نقطة للعميل بنجاح`,
          `Successfully ${adjustType === 'ADD' ? 'added' : 'deducted'} ${adjustAmount} points`
        ),
        'success'
      );
      setAdjustingCustomer(null);
      setAdjustReason('');
    } catch {
      toast(L('فشل تعديل النقاط، يرجى المحاولة لاحقاً', 'Failed to adjust points, try again'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsAppNotification = (c: CustomerLoyaltyItem) => {
    const cleanPhone = c.phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const tier = getTier(c.loyaltyPoints).label;
    const val = (c.loyaltyPoints * pointValue).toLocaleString();

    const msg = isAr
      ? `مرحباً ${c.name || 'عميلنا العزيز'}، رصيد نقاط الولاء الخاص بك في سبورتس هو ${c.loyaltyPoints} نقطة (الفئة: ${tier}) بقيمة ${val} جنيه مصري! يمكنك استخدامها في أي وقت للحصول على خصم مباشر على مشترياتك.`
      : `Hello ${c.name || 'valued customer'}, your loyalty balance at Sports is ${c.loyaltyPoints} points (${tier} tier) valued at ${val} EGP! Redeem anytime for direct discounts.`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('إجمالي النقاط المتداولة', 'Total Active Points')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-100">{stats.totalPoints.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-2">{L('نقطة', 'pts')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {L('متوسط', 'Avg')} {stats.avgPoints} {L('نقطة لكل عميل', 'pts/customer')}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('القيمة المالية التقديرية', 'Est. Financial Value')}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400">{stats.totalValue.toLocaleString()}</span>
            <span className="text-xs text-slate-400 ms-1">{currencyLabel}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {L('سعر النقطة: ', 'Rate: ')} {pointValue} {currencyLabel}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('أعضاء الفئة البلاتينية', 'Platinum Members')}</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Crown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-400">{stats.platinum}</span>
            <span className="text-xs text-slate-400 ms-2">{L('عميل', 'customers')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('رصيد 1000+ نقطة', '1,000+ points balance')}</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold">{L('أعضاء الفئة الذهبية', 'Gold Members')}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400">{stats.gold}</span>
            <span className="text-xs text-slate-400 ms-2">{L('عميل', 'customers')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{L('رصيد 500 - 999 نقطة', '500 - 999 points balance')}</p>
        </div>
      </div>

      {/* Loyalty Policy Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">
              {L('قواعد احتساب واستبدال النقاط التلقائية', 'Automated Points Earning & Redemption Policy')}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {L(
                `كل ${earnRate} جنيه مشتريات = 1 نقطة ولاء • كل 100 نقطة ولاء = ${100 * pointValue} جنيه خصم مباشر في نقاط البيع والكاشير.`,
                `Every ${earnRate} EGP spent = 1 point • Every 100 points = ${100 * pointValue} EGP direct discount at POS.`
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {L('بلاتيني: 1000+', 'Platinum: 1000+')}
          </span>
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {L('ذهبي: 500+', 'Gold: 500+')}
          </span>
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-700/50 text-slate-300 border border-slate-600/50">
            {L('فضي: 200+', 'Silver: 200+')}
          </span>
        </div>
      </div>

      {/* Controls: Search and Tier Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setTierFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('كل الفئات', 'All Tiers')} ({customers.length})
          </button>
          <button
            onClick={() => setTierFilter('PLATINUM')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'PLATINUM'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-purple-300'
            }`}
          >
            {L('بلاتيني', 'Platinum')} ({stats.platinum})
          </button>
          <button
            onClick={() => setTierFilter('GOLD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'GOLD'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-amber-300'
            }`}
          >
            {L('ذهبي', 'Gold')} ({stats.gold})
          </button>
          <button
            onClick={() => setTierFilter('SILVER')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'SILVER'
                ? 'bg-slate-600 text-white shadow-lg shadow-slate-500/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {L('فضي', 'Silver')} ({stats.silver})
          </button>
          <button
            onClick={() => setTierFilter('BRONZE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tierFilter === 'BRONZE'
                ? 'bg-amber-800 text-white shadow-lg shadow-amber-800/20'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-amber-500'
            }`}
          >
            {L('برونزي', 'Bronze')} ({stats.bronze})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('بحث بالاسم أو رقم الهاتف...', 'Search name or phone...')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Loyalty Table */}
      <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[760px] text-xs text-start">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3.5 text-start">{L('العميل', 'Customer')}</th>
              <th className="p-3.5 text-center">{L('الفئة الحالية', 'Current Tier')}</th>
              <th className="p-3.5 text-center">{L('رصيد النقاط', 'Points Balance')}</th>
              <th className="p-3.5 text-center">{L('القيمة المعادلة', 'Equivalent Value')}</th>
              <th className="p-3.5 text-center">{L('إجمالي الشراء', 'Total Spent')}</th>
              <th className="p-3.5 text-center">{L('عدد الطلبات', 'Orders')}</th>
              <th className="p-3.5 text-end">{L('الإجراءات', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  {L('لا توجد بيانات مطابقة للبحث أو الفلتر', 'No matching customer loyalty records found')}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const tier = getTier(c.loyaltyPoints);
                const TierIcon = tier.icon;
                const valueEgp = c.loyaltyPoints * pointValue;

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-100">{c.name || L('عميل بدون اسم', 'Unnamed Customer')}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5" dir="ltr">
                        {c.phone}
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${tier.color}`}
                      >
                        <TierIcon className="w-3 h-3" />
                        {tier.label}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-black text-amber-400 text-sm">{c.loyaltyPoints.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 ms-1">{L('نقطة', 'pts')}</span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-bold text-emerald-400">{valueEgp.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 ms-1">{currencyLabel}</span>
                    </td>

                    <td className="p-3.5 text-center text-slate-300 font-semibold">
                      {c.totalSpent.toLocaleString()} {currencyLabel}
                    </td>

                    <td className="p-3.5 text-center text-slate-400 font-mono">{c.ordersCount}</td>

                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setAdjustingCustomer(c);
                            setAdjustType('ADD');
                            setAdjustAmount(50);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                          title={L('تعديل رصيد النقاط', 'Adjust points')}
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          {L('تعديل الرصيد', 'Adjust')}
                        </button>

                        <button
                          onClick={() => handleSendWhatsAppNotification(c)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                          title={L('إرسال إشعار رصيد عبر واتساب', 'Send balance via WhatsApp')}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Adjust Points Modal */}
      {adjustingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setAdjustingCustomer(null)}
              className="absolute top-5 end-5 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-100 text-sm">
                  {L('تعديل رصيد نقاط الولاء', 'Adjust Customer Loyalty Points')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {adjustingCustomer.name || adjustingCustomer.phone}
                </p>
              </div>
            </div>

            <form onSubmit={handleAdjustPoints} className="space-y-4 mt-5">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('نوع التعديل', 'Adjustment Type')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      adjustType === 'ADD'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {L('إضافة نقاط مكافأة', 'Add Points')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('DEDUCT')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      adjustType === 'DEDUCT'
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    {L('خصم أو تصحيح نقاط', 'Deduct Points')}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('عدد النقاط', 'Points Amount')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Math.max(1, Number(e.target.value) || 0))}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-bold focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {L('الرصيد الحالي:', 'Current balance:')} {adjustingCustomer.loyaltyPoints} {L('نقطة', 'pts')} →{' '}
                  {L('الرصيد الجديد:', 'New balance:')}{' '}
                  {adjustType === 'ADD'
                    ? adjustingCustomer.loyaltyPoints + adjustAmount
                    : Math.max(0, adjustingCustomer.loyaltyPoints - adjustAmount)}{' '}
                  {L('نقطة', 'pts')}
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                  {L('سبب التعديل (اختياري للتوثيق)', 'Reason note (Optional)')}
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={L('مثال: هدية ترحيبية، تعويض عن تأخير، تسوية رصيد', 'e.g. Compensation, Welcome bonus')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdjustingCustomer(null)}
                  disabled={isSubmitting}
                >
                  {L('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  <Check className="w-3.5 h-3.5" />
                  {isSubmitting ? L('جار الحفظ...', 'Saving...') : L('تأكيد التعديل', 'Confirm Adjustment')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
