'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Award } from 'lucide-react';

interface CustomerRow {
  id: string;
  name: string | null;
  phone: string;
  loyaltyPoints: number;
  createdAt: string;
  addresses: Array<{ street: string }>;
  orders: Array<{ id: string }>;
}

export default function CustomersManager({ customers }: { customers: CustomerRow[] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [search, setSearch] = useState('');

  const filtered = customers.filter(
    (c) => (c.name || '').includes(search) || c.phone.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-200">
          {isAr ? `إجمالي العملاء: ${filtered.length}` : `Total customers: ${filtered.length}`}
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isAr ? 'بحث بالاسم أو الموبايل...' : 'Search by name or phone...'}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 w-64 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'اسم العميل' : 'Name'}</th>
              <th className="p-3">{isAr ? 'رقم الموبايل' : 'Phone'}</th>
              <th className="p-3">{isAr ? 'نقاط الولاء' : 'Loyalty'}</th>
              <th className="p-3">{isAr ? 'العنوان الرئيسي' : 'Address'}</th>
              <th className="p-3">{isAr ? 'عدد الطلبات' : 'Orders'}</th>
              <th className="p-3">{isAr ? 'تاريخ التسجيل' : 'Since'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-slate-900/50">
                <td className="p-3 font-bold text-slate-100">{c.name || (isAr ? 'عميل كريم' : 'Guest')}</td>
                <td className="p-3 font-bold text-amber-400" dir="ltr">{c.phone}</td>
                <td className="p-3">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/30 flex items-center gap-1 w-fit">
                    <Award className="w-3.5 h-3.5" />
                    {c.loyaltyPoints} {isAr ? 'نقطة' : 'pts'}
                  </span>
                </td>
                <td className="p-3 text-slate-300">{c.addresses[0]?.street || '—'}</td>
                <td className="p-3 font-bold text-blue-400">{c.orders.length}</td>
                <td className="p-3 text-slate-400">{new Date(c.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-xs text-slate-500 py-12">{t('noData')}</div>}
      </div>
    </div>
  );
}
