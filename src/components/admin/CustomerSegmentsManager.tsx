'use client';

import React, { useState, useMemo } from 'react';
import { useLocale } from 'next-intl';
import {
  Users,
  Crown,
  UserCheck,
  UserPlus,
  UserX,
  Search,
  MessageCircle,
} from 'lucide-react';

export interface CustomerSegmentItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
  createdAt: string;
}

export default function CustomerSegmentsManager({
  customers,
}: {
  customers: CustomerSegmentItem[];
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [activeSegment, setActiveSegment] = useState<'ALL' | 'VIP' | 'ACTIVE' | 'NEW' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');

  // Classify each customer into a segment
  const classified = useMemo(() => {
    const now = new Date().getTime();
    return customers.map((c) => {
      const createdDaysAgo = (now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      let segment: 'VIP' | 'ACTIVE' | 'NEW' | 'INACTIVE' = 'ACTIVE';

      if (c.totalSpent >= 3000 || c.ordersCount >= 5) {
        segment = 'VIP';
      } else if (createdDaysAgo <= 30 && c.ordersCount <= 1) {
        segment = 'NEW';
      } else if (c.ordersCount === 0 || (c.lastOrderDate && (now - new Date(c.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24) > 60)) {
        segment = 'INACTIVE';
      } else {
        segment = 'ACTIVE';
      }

      return {
        ...c,
        segment,
      };
    });
  }, [customers]);

  const stats = useMemo(() => {
    const vip = classified.filter((c) => c.segment === 'VIP');
    const active = classified.filter((c) => c.segment === 'ACTIVE');
    const newCust = classified.filter((c) => c.segment === 'NEW');
    const inactive = classified.filter((c) => c.segment === 'INACTIVE');

    return {
      vipCount: vip.length,
      vipSpent: vip.reduce((acc, c) => acc + c.totalSpent, 0),
      activeCount: active.length,
      activeSpent: active.reduce((acc, c) => acc + c.totalSpent, 0),
      newCount: newCust.length,
      newSpent: newCust.reduce((acc, c) => acc + c.totalSpent, 0),
      inactiveCount: inactive.length,
    };
  }, [classified]);

  const filtered = useMemo(() => {
    return classified.filter((c) => {
      const matchSeg = activeSegment === 'ALL' || c.segment === activeSegment;
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));
      return matchSeg && matchSearch;
    });
  }, [classified, activeSegment, search]);

  const getSegmentBadge = (seg: string) => {
    switch (seg) {
      case 'VIP':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 w-fit">
            <Crown className="w-3 h-3" />
            {L('شريحة VIP الفضية/الذهبية', 'VIP Elite')}
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 w-fit">
            <UserCheck className="w-3 h-3" />
            {L('عميل متكرر ونشط', 'Active Regular')}
          </span>
        );
      case 'NEW':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-sky-500/10 text-sky-400 border-sky-500/30 flex items-center gap-1 w-fit">
            <UserPlus className="w-3 h-3" />
            {L('عميل جديد', 'New Customer')}
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black border bg-rose-500/10 text-rose-400 border-rose-500/30 flex items-center gap-1 w-fit">
            <UserX className="w-3 h-3" />
            {L('بحاجة لإعادة تنشيط', 'Inactive / Risk')}
          </span>
        );
      default:
        return null;
    }
  };

  const getWhatsAppMessage = (c: typeof classified[0]) => {
    const custName = c.name || L('عميلنا العزيز', 'Valued Customer');
    if (c.segment === 'VIP') {
      return encodeURIComponent(
        isAr
          ? `أهلاً بك يا ${custName} في أبطال الرياضة! تقديراً لانضمامك لشريحة كبار العملاء، يسعدنا تقديم خصم خاص وكوبون مميز لطلبك القادم.`
          : `Hello ${custName}, thank you for being an elite VIP customer at Sports Champions! Here is an exclusive reward for your next order.`
      );
    }
    if (c.segment === 'INACTIVE') {
      return encodeURIComponent(
        isAr
          ? `أهلاً بك يا ${custName}! افتقدناك في أبطال الرياضة الإبراهيمية. يسعدنا زيارتك واستخدام كود خصم ترحيبي لطلبك القادم.`
          : `Hello ${custName}, we miss you at Sports Champions! Visit us again soon with an exclusive welcome-back discount.`
      );
    }
    return encodeURIComponent(
      isAr
        ? `أهلاً بك يا ${custName} في أبطال الرياضة الإبراهيمية! نحن في خدمتك لأي استفسار حول مشترياتك ورصيد نقاطك.`
        : `Hello ${custName} from Sports Champions! We are at your service for any questions regarding your orders and points.`
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveSegment('VIP')}
          className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer ${
            activeSegment === 'VIP' ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-500/5' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{L('كبار العملاء (VIP)', 'VIP Customers')}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-100">{stats.vipCount}</div>
          <div className="text-[11px] text-amber-400 font-bold mt-1">
            {stats.vipSpent.toLocaleString()} {currencyLabel} {L('إجمالي المشتريات', 'Total Spend')}
          </div>
        </div>

        <div
          onClick={() => setActiveSegment('ACTIVE')}
          className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer ${
            activeSegment === 'ACTIVE' ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{L('العملاء النشطون (Active)', 'Active Regulars')}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-100">{stats.activeCount}</div>
          <div className="text-[11px] text-emerald-400 font-bold mt-1">
            {stats.activeSpent.toLocaleString()} {currencyLabel} {L('إجمالي المشتريات', 'Total Spend')}
          </div>
        </div>

        <div
          onClick={() => setActiveSegment('NEW')}
          className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer ${
            activeSegment === 'NEW' ? 'border-sky-500 ring-1 ring-sky-500/30 bg-sky-500/5' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{L('عملاء جدد (آخر 30 يوم)', 'New Customers')}</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-100">{stats.newCount}</div>
          <div className="text-[11px] text-sky-400 font-bold mt-1">
            {stats.newSpent.toLocaleString()} {currencyLabel} {L('طلبات أولية', 'First orders')}
          </div>
        </div>

        <div
          onClick={() => setActiveSegment('INACTIVE')}
          className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer ${
            activeSegment === 'INACTIVE' ? 'border-rose-500 ring-1 ring-rose-500/30 bg-rose-500/5' : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{L('غير نشطين / خمول', 'Inactive / Churn Risk')}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-100">{stats.inactiveCount}</div>
          <div className="text-[11px] text-rose-400 font-bold mt-1">
            {L('بحاجة لإرسال عروض استعادة', 'Need retention coupon')}
          </div>
        </div>
      </div>

      {/* Filter and Segment switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: L('كافة الشرائح', 'All Segments'), count: classified.length },
            { id: 'VIP', label: L('كبار العملاء VIP', 'VIP Elite'), count: stats.vipCount },
            { id: 'ACTIVE', label: L('نشطون', 'Active'), count: stats.activeCount },
            { id: 'NEW', label: L('جدد', 'New'), count: stats.newCount },
            { id: 'INACTIVE', label: L('غير نشطين', 'Inactive'), count: stats.inactiveCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSegment(tab.id as typeof activeSegment)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 flex items-center gap-1.5 ${
                activeSegment === tab.id
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder={L('بحث بالاسم أو الهاتف...', 'Search name or phone...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2.5 ps-9 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-3" />
        </div>
      </div>

      {/* Segment Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
        <table className="w-full text-start text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold">
              <th className="p-3.5 text-start">{L('العميل', 'Customer')}</th>
              <th className="p-3.5 text-start">{L('رقم الهاتف', 'Phone')}</th>
              <th className="p-3.5 text-start">{L('الشريحة الحالية', 'Current Segment')}</th>
              <th className="p-3.5 text-start">{L('عدد الطلبات', 'Orders')}</th>
              <th className="p-3.5 text-start">{L('إجمالي المشتريات', 'Total Spend')}</th>
              <th className="p-3.5 text-start">{L('نقاط الولاء', 'Loyalty Points')}</th>
              <th className="p-3.5 text-start">{L('إجراء تسويقي', 'Marketing Action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  {L('لا يوجد عملاء يطابقون الفلتر المختار', 'No customers found matching this filter')}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3.5 font-bold text-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                        {c.name ? c.name[0] : <Users className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div>{c.name || L('عميل بدون اسم', 'Unnamed Customer')}</div>
                        {c.email && <div className="text-[10px] text-slate-500 font-mono">{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300" dir="ltr">
                    {c.phone}
                  </td>
                  <td className="p-3.5">{getSegmentBadge(c.segment)}</td>
                  <td className="p-3.5 font-bold text-slate-200">
                    {c.ordersCount} {L('طلبات', 'orders')}
                  </td>
                  <td className="p-3.5 font-black text-emerald-400">
                    {c.totalSpent.toLocaleString()} {currencyLabel}
                  </td>
                  <td className="p-3.5 font-bold text-amber-400">
                    {c.loyaltyPoints} {L('نقطة', 'pts')}
                  </td>
                  <td className="p-3.5">
                    <a
                      href={`https://wa.me/20${c.phone.replace(/^0+/, '')}?text=${getWhatsAppMessage(c)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-[11px] transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{L('تواصل WhatsApp', 'WhatsApp')}</span>
                    </a>
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
