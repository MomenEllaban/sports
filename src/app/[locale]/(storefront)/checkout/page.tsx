'use client';

import React, { useState } from 'react';
import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import { useCartStore } from '@/store/cartStore';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { CreditCard, Truck, MapPin, CheckCircle, ShieldCheck, AlertCircle, Phone, User, MessageCircle } from 'lucide-react';
import { ALEXANDRIA_DELIVERY_ZONES } from '@/lib/logistics';

export default function CheckoutPage() {
  const tCommon = useTranslations('common');
  const tCheckout = useTranslations('checkout');
  const router = useRouter();

  const { items, selectedZone, deliveryFee, getSubtotal, getVatAmount, getTotalAmount, clearCart } = useCartStore();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PAYMOB' | 'FAWRY' | 'INSTAPAY'>('COD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [orderCompleted, setOrderCompleted] = useState<{ orderNumber: string; trackingNumber: string; paymentInstructions?: string } | null>(null);

  const subtotal = getSubtotal();
  const vat = getVatAmount();
  const finalDeliveryFee = fulfillmentType === 'PICKUP' ? 0 : deliveryFee;
  const total = subtotal + vat + finalDeliveryFee;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || items.length === 0) return;

    setIsSubmitting(true);
    setFormError('');

    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: name || 'عميل كريم',
          address: fulfillmentType === 'PICKUP' ? 'استلام من فرع الإبراهيمية (92 شارع عمر لطفى)' : address,
          fulfillmentType,
          zoneId: selectedZone,
          deliveryFee: finalDeliveryFee,
          paymentMethod,
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity, price: i.price })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        clearCart();
        setOrderCompleted({
          orderNumber: data.orderNumber,
          trackingNumber: data.trackingNumber,
          paymentInstructions: data.instructionsAr,
        });
      } else {
        setFormError(data.error || 'حدث خطأ أثناء حفظ الطلب.');
      }
    } catch {
      setFormError('تعذر الاتصال بالسيرفر. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderCompleted) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            <h1 className="text-3xl font-black text-slate-100">تم تأكيد طلبك بنجاح!</h1>
            <p className="text-sm text-slate-400">
              شكراً لتسوقك من ابطال الرياضة الإبراهيمية. تم إرسال تفاصيل الطلب عبر الواتساب.
            </p>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-right space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">رقم الطلب:</span>
                <span className="font-extrabold text-amber-400 text-sm">{orderCompleted.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رقم تتبع الشحنة:</span>
                <span className="font-bold text-blue-400">{orderCompleted.trackingNumber}</span>
              </div>
              {orderCompleted.paymentInstructions && (
                <div className="pt-2 border-t border-slate-800 text-amber-300">
                  {orderCompleted.paymentInstructions}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-center gap-4">
              <button
                onClick={() => router.push(`/tracking?phone=${phone}&order=${orderCompleted.orderNumber}`)}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs"
              >
                تتبع حالة الشحنة الآن
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-100 border-b border-slate-800 pb-4">
          {tCheckout('title')}
        </h1>

        <form onSubmit={handleSubmitOrder} className="grid lg:grid-cols-12 gap-8">
          {/* Form Fields */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Customer Info */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                بيانات التوصل (بدون حاجة لإنشاء حساب)
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {tCheckout('phoneLabel')} *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="01012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold"
                    />
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {tCheckout('nameLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد محمود"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Fulfillment Choice */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                {tCheckout('deliveryOptions')}
              </h2>

              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <label
                  onClick={() => setFulfillmentType('DELIVERY')}
                  className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-2 transition-all ${
                    fulfillmentType === 'DELIVERY'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold text-sm text-slate-100">توصيل للمنزل بالإسكندرية</span>
                  <span className="text-[11px]">عن طريق بوسطة أو مرسول</span>
                </label>

                <label
                  onClick={() => setFulfillmentType('PICKUP')}
                  className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-2 transition-all ${
                    fulfillmentType === 'PICKUP'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold text-sm text-slate-100">استلام من فرع الإبراهيمية</span>
                  <span className="text-[11px] text-amber-400">مجاناً (92 شارع عمر لطفى)</span>
                </label>
              </div>

              {fulfillmentType === 'DELIVERY' && (
                <div className="space-y-2 text-xs pt-2">
                  <label className="block font-bold text-slate-300 mb-1">
                    {tCheckout('addressLabel')} *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="اسم الشارع، المنطقة، رقم العمارة والدور والشقة..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Step 3: Payment Method */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                {tCheckout('paymentMethod')}
              </h2>

              <div className="space-y-3 text-xs">
                <label
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'COD'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">{tCheckout('cod')}</span>
                    <span className="text-[11px] text-slate-400">ادفع نقداً عند وصول الشحنة لمندوب الشحن</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">متاح دائماً</span>
                </label>

                <label
                  onClick={() => setPaymentMethod('PAYMOB')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'PAYMOB'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">باي مب Paymob (فيزا/ماستر/محافظ)</span>
                    <span className="text-[11px] text-slate-400">فودافون كاش، اتصالات كاش، أورانج كاش وكروت البنوك</span>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('FAWRY')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'FAWRY'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">فوري Fawry (رقم مرجعي)</span>
                    <span className="text-[11px] text-slate-400">كود دفع بالسوبرماركت ومنافذ فوري</span>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('INSTAPAY')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'INSTAPAY'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">تحويل انستا باي InstaPay مباشر</span>
                    <span className="text-[11px] text-slate-400">تحويل فوري بحساب الشركة sports.champions@instapay</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-base text-slate-100 border-b border-slate-800 pb-3">
                ملخص الفاتورة
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      {item.nameAr} x{item.quantity}
                    </span>
                    <span className="font-bold text-slate-100">
                      {(item.price * item.quantity).toLocaleString()} {tCommon('currency')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-xs border-t border-b border-slate-800/80 py-4">
                <div className="flex justify-between text-slate-400">
                  <span>المجموع الفرعي:</span>
                  <span className="font-semibold text-slate-200">{subtotal.toLocaleString()} {tCommon('currency')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>ضريبة القيمة المضافة 14%:</span>
                  <span className="font-semibold text-slate-200">{vat.toLocaleString()} {tCommon('currency')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>رسوم التوصيل:</span>
                  <span className="font-semibold text-amber-400">{finalDeliveryFee} {tCommon('currency')}</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="font-bold text-sm text-slate-300">الإجمالي الكلي:</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-100">{total.toLocaleString()}</span>
                  <span className="text-xs font-bold text-amber-400 ml-1">{tCommon('currency')}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'جاري التأكيد...' : tCheckout('placeOrder')}
              </button>
              {formError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold text-center animate-fade-in">
                  {formError}
                </div>
              )}
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
