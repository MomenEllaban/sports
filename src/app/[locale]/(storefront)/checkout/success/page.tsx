'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { apiRequest } from '@/lib/client-api';

/**
 * Gateway return page (T01): Paymob redirects back here. We verify the
 * order's paymentStatus server-side (track API) — never trust URL params.
 */
export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const orderNumber = params.get('order') || '';
  const [state, setState] = useState<'loading' | 'paid' | 'pending' | 'missing'>('loading');

  useEffect(() => {
    if (!orderNumber) {
      setState('missing');
      return;
    }
    void apiRequest<{ order?: { paymentStatus: string } }>(`/api/orders/track?query=${encodeURIComponent(orderNumber)}`, { errorKey: 'storefront:checkout:verify' })
      .then((d) => {
        if (d.order) setState(d.order.paymentStatus === 'PAID' ? 'paid' : 'pending');
        else setState('missing');
      })
      .catch(() => setState('pending'));
  }, [orderNumber]);

  return (
    <main className="flex-1 max-w-3xl mx-auto px-4 py-16 text-center space-y-6 w-full">
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-4">
        {state === 'loading' && <p className="text-sm text-slate-400">جاري التحقق من الدفع...</p>}
        {state === 'paid' && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            <h1 className="text-3xl font-black text-slate-100">تم الدفع بنجاح!</h1>
            <p className="text-sm text-slate-400">طلبك <span className="font-mono font-bold text-amber-400" dir="ltr">{orderNumber}</span> مدفوع وجارٍ تجهيزه.</p>
          </>
        )}
        {state === 'pending' && (
          <>
            <XCircle className="w-16 h-16 text-amber-400 mx-auto" />
            <h1 className="text-2xl font-black text-slate-100">الدفع لم يكتمل بعد</h1>
            <p className="text-sm text-slate-400">لو خصم منك المبلغ سيُحدَّث طلبك تلقائياً خلال دقائق، أو تواصل معنا برقم الطلب.</p>
          </>
        )}
        {state === 'missing' && <p className="text-sm text-rose-400">رقم الطلب غير موجود.</p>}
        <div className="pt-2 flex justify-center gap-3">
          <Link href={orderNumber ? `/tracking?order=${encodeURIComponent(orderNumber)}` : '/tracking'} className="min-h-[44px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs flex items-center">
            تتبع الطلب
          </Link>
          <Link href="/" className="min-h-[44px] px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs flex items-center">
            الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
