'use client';

import React from 'react';
import { useCartStore } from '@/store/cartStore';
import { ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { Trash2, Plus, Minus, ArrowRight, ShieldCheck, Truck, ShoppingBag } from 'lucide-react';

export default function CartPage() {
  const tCommon = useTranslations('common');
  const tCart = useTranslations('cart');
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const {
    items,
    selectedZone,
    deliveryFee,
    updateQuantity,
    removeItem,
    setZone,
    getSubtotal,
    getVatAmount,
    getTotalAmount,
  } = useCartStore();

  const subtotal = getSubtotal();
  const vat = getVatAmount();
  const total = getTotalAmount();

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zoneId = e.target.value;
    const found = ALEXANDRIA_DELIVERY_ZONES.find((z) => z.id === zoneId);
    if (found) {
      setZone(found.id, found.fee);
    }
  };

  return (

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-blue-400" />
            {tCart('title')}
          </h1>
          <Link
            href="/catalog"
            className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
          >
            {tCart('continueShopping')}
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="p-16 text-center glass-panel rounded-3xl space-y-4">
            <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-base">{tCart('empty')}</p>
            <Link
              href="/catalog"
              className="inline-flex px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg"
            >
              {L('تصفح المنتجات الآن', 'Browse products now')}
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-4 justify-between"
                >
                  <div className="relative w-20 h-20 rounded-xl bg-slate-900 overflow-hidden shrink-0">
                    <Image
                      src={item.image}
                      alt={isAr ? item.nameAr : item.nameEn}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-1">
                    <h3 className="font-bold text-sm text-slate-100 line-clamp-1">
                      {isAr ? item.nameAr : item.nameEn}
                    </h3>
                    <p className="text-[11px] text-slate-400">SKU: {item.sku}</p>
                    <div className="text-xs font-bold text-blue-400">
                      {item.price.toLocaleString()} {tCommon('currency')}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="text-slate-400 hover:text-slate-100"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-sm text-slate-100 w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="text-slate-400 hover:text-slate-100"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-start space-y-1 min-w-[80px]">
                    <div className="font-extrabold text-sm text-slate-100">
                      {(item.price * item.quantity).toLocaleString()} {tCommon('currency')}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs flex items-center justify-end gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {tCommon('delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Summary Card */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
                <h3 className="font-extrabold text-base text-slate-100 border-b border-slate-800 pb-3">
                  {L('ملخص الحساب والتوصيل', 'Order summary & delivery')}
                </h3>

                {/* Delivery Zone Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-400" />
                    {L('منطقة التوصيل بالإسكندرية والمحافظات', 'Delivery area in Alexandria and governorates')}:
                  </label>
                  <select
                    value={selectedZone}
                    onChange={handleZoneChange}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {ALEXANDRIA_DELIVERY_ZONES.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {isAr ? zone.nameAr : zone.nameEn} ({zone.fee} {L('ج.م', 'EGP')} - {zone.estimatedHours})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Costs Breakup */}
                <div className="space-y-2.5 text-xs border-t border-b border-slate-800/80 py-4">
                  <div className="flex justify-between text-slate-400">
                    <span>{tCart('itemTotal')}:</span>
                    <span className="font-semibold text-slate-200">{subtotal.toLocaleString()} {tCommon('currency')}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{tCommon('tax')}:</span>
                    <span className="font-semibold text-slate-200">{vat.toLocaleString()} {tCommon('currency')}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{L('رسوم الشحن والتوصيل', 'Shipping & delivery fee')}:</span>
                    <span className="font-semibold text-amber-400">{deliveryFee} {tCommon('currency')}</span>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-sm text-slate-300">{L('الإجمالي النهائي', 'Final total')}:</span>
                  <div className="text-start">
                    <span className="text-2xl font-black text-slate-100">{total.toLocaleString()}</span>
                    <span className="text-xs font-bold text-amber-400 ml-1">{tCommon('currency')}</span>
                  </div>
                </div>

                {/* Checkout Link Button */}
                <Link
                  href="/checkout"
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-control transition-all"
                >
                  <span>{tCart('checkout')}</span>
                  <ArrowRight className="w-4 h-4 rtl-flip" />
                </Link>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{L('دفع آمن بالبطاقة، فوري، أو نقداً عند الاستلام', 'Secure card, Fawry, or cash-on-delivery payment')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
  );
}
