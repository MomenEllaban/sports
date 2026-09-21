'use client';

import React, { useState } from 'react';
import { Search, Package, Truck, CheckCircle2, Clock, MapPin, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function TrackingPage() {
  const tCommon = useTranslations('common');
  const tTracking = useTranslations('orderTracking');

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderNumber: string;
    orderStatus: string;
    shippingProvider: string;
    trackingNumber?: string;
    totalAmount: number;
    guestName?: string;
    guestPhone: string;
    deliveryAddress: string;
    createdAt: string;
    items: Array<{ name: string; quantity: number; price: number }>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setErrorMsg('');
    setOrderResult(null);

    try {
      const res = await fetch(`/api/orders/track?query=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.success && data.order) {
        setOrderResult(data.order);
      } else {
        setErrorMsg(data.message || 'لم نتمكن من العثور على طلب بهذا الرقم أو الموبايل.');
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالسيرفر. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 space-y-8 w-full">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-slate-100">{tTracking('title')}</h1>
          <p className="text-xs text-slate-400">
            أدخل رقم الموبايل الخاص بالطلب أو رقم الفاتورة لمتابعة حالة الشحنة لحظة بلحظة.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} role="search" className="glass-panel p-4 rounded-3xl border border-slate-800 flex gap-3 max-w-2xl mx-auto">
          <label htmlFor="tracking-search" className="sr-only">{tTracking('inputPlaceholder')}</label>
          <input
            id="tracking-search"
            type="text"
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tTracking('inputPlaceholder')}
            aria-label={tTracking('inputPlaceholder')}
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-semibold placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
          >
            <Search className="w-4 h-4" />
            {loading ? 'جاري البحث...' : tTracking('searchBtn')}
          </button>
        </form>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center max-w-2xl mx-auto">
            {errorMsg}
          </div>
        )}

        {/* Order Details Display */}
        {orderResult && (
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-slate-400">رقم الطلب:</span>
                <h2 className="text-xl font-black text-amber-400">{orderResult.orderNumber}</h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30">
                  {orderResult.orderStatus}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-900 text-slate-300 font-bold text-xs border border-slate-800">
                  شركة الشحن: {orderResult.shippingProvider}
                </span>
              </div>
            </div>

            {/* Tracking Status Timeline */}
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <Clock className="w-5 h-5 text-amber-400 mx-auto" />
                <div className="font-bold text-slate-200">تأكيد الطلب</div>
                <div className="text-[10px] text-slate-400">تم الاستلام</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <Truck className="w-5 h-5 text-blue-400 mx-auto" />
                <div className="font-bold text-slate-200">جاري الشحن</div>
                <div className="text-[10px] text-slate-400">{orderResult.trackingNumber || 'بانتظار التحديث'}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                <div className="font-bold text-slate-200">التسليم النهائي</div>
                <div className="text-[10px] text-slate-400">العميل</div>
              </div>
            </div>

            {/* Address & Items */}
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  عنوان التوصيل:
                </div>
                <p className="text-slate-400">{orderResult.deliveryAddress}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center gap-1">
                  <Phone className="w-4 h-4 text-blue-400" />
                  بيانات التواصل:
                </div>
                <p className="text-slate-400">{orderResult.guestName} - {orderResult.guestPhone}</p>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <h3 className="font-bold text-xs text-slate-300">المنتجات الشاملة في الشحنة:</h3>
              <div className="space-y-2">
                {orderResult.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs p-2 rounded-xl bg-slate-900/60">
                    <span className="text-slate-200 font-medium">{item.name} x{item.quantity}</span>
                    <span className="font-bold text-slate-300">{item.price.toLocaleString()} {tCommon('currency')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
