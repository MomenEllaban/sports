'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { StatusBadge, PayLabel, SourceLabel, apiFetch } from './ui';

interface OrderRow {
  id: string;
  orderNumber: string;
  orderSource: string;
  guestName: string | null;
  guestPhone: string;
  deliveryAddress: string;
  shippingProvider: string;
  trackingNumber: string | null;
  paymentMethod: string;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
}

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];

export default function OrdersManager({ orders }: { orders: OrderRow[] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');

  const filtered = orders.filter(
    (o) =>
      (statusFilter === 'ALL' || o.orderStatus === statusFilter) &&
      (sourceFilter === 'ALL' || o.orderSource === sourceFilter)
  );

  const changeStatus = async (id: string, orderStatus: string) => {
    setUpdatingId(id);
    setError('');
    try {
      await apiFetch(`/api/admin/orders/${id}`, 'PATCH', { orderStatus });
      router.refresh();
    } catch {
      setError(t('operationFailed'));
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3 text-xs">
        <span className="font-bold text-slate-200">
          {isAr ? `إجمالي الطلبات: ${filtered.length} طلب` : `Total orders: ${filtered.length}`}
        </span>
        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
          >
            <option value="ALL">{isAr ? 'كل المصادر' : 'All sources'}</option>
            <option value="ONLINE">{t('src_ONLINE')}</option>
            <option value="POS">{t('src_POS')}</option>
            <option value="WHATSAPP">{t('src_WHATSAPP')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
          >
            <option value="ALL">{isAr ? 'كل الحالات' : 'All statuses'}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status_${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="p-3">{t('sku')}</th>
              <th className="p-3">{isAr ? 'المصدر' : 'Source'}</th>
              <th className="p-3">{isAr ? 'العميل والموبايل' : 'Customer'}</th>
              <th className="p-3">{isAr ? 'شركة الشحن / التتبع' : 'Courier'}</th>
              <th className="p-3">{isAr ? 'الدفع' : 'Payment'}</th>
              <th className="p-3">{isAr ? 'المبلغ الكلي' : 'Total'}</th>
              <th className="p-3">{isAr ? 'حالة الطلب' : 'Status'}</th>
              <th className="p-3">{t('changeStatus')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((ord) => (
              <tr key={ord.id} className="hover:bg-slate-900/50">
                <td className="p-3 font-bold text-amber-400">{ord.orderNumber}</td>
                <td className="p-3 font-semibold text-slate-300"><SourceLabel value={ord.orderSource} /></td>
                <td className="p-3">
                  <div className="font-bold text-slate-100">{ord.guestName || 'عميل'}</div>
                  <div className="text-[10px] text-slate-400" dir="ltr">{ord.guestPhone}</div>
                </td>
                <td className="p-3">
                  <span className="font-bold text-blue-400 block">{ord.shippingProvider}</span>
                  <span className="text-[10px] text-slate-400">{ord.trackingNumber || '—'}</span>
                </td>
                <td className="p-3 text-slate-300"><PayLabel value={ord.paymentMethod} /></td>
                <td className="p-3 font-black text-slate-100">{ord.totalAmount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</td>
                <td className="p-3"><StatusBadge value={ord.orderStatus} /></td>
                <td className="p-3">
                  <select
                    value={ord.orderStatus}
                    disabled={updatingId === ord.id}
                    onChange={(e) => changeStatus(ord.id, e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs disabled:opacity-60"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`status_${s}`)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-12">{t('noData')}</div>
        )}
      </div>
    </div>
  );
}
