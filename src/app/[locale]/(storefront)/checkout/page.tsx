'use client';

import React, { useState, useEffect } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { CreditCard, Truck, CheckCircle, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { apiRequest } from '@/lib/client-api';

/**
 * Random key for one checkout attempt. `crypto.randomUUID` is preferred; the
 * fallback keeps the key format the server accepts (8-80 chars of
 * `[A-Za-z0-9_-]`) on older browsers and insecure origins.
 */
function newCheckoutKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function CheckoutPage() {
  const tCommon = useTranslations('common');
  const tCheckout = useTranslations('checkout');
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const { items, selectedZone, deliveryFee, getSubtotal, getVatAmount, clearCart } = useCartStore();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  // T09: portal saved addresses (prefill when logged in).
  const [savedAddresses, setSavedAddresses] = useState<Array<{ id: string; title: string; street: string; building: string | null; city: string; governorate: string }>>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  useEffect(() => {
    void apiRequest<{ customer?: { phone?: string; name?: string | null; addresses?: typeof savedAddresses; loyaltyPoints?: number } }>('/api/account/me', {
      suppressAuthRedirect: true,
      suppressErrorEvents: true,
      errorKey: 'storefront:checkout:account',
    })
      .then((d) => {
        if (d.customer) {
          if (d.customer.phone) setPhone(d.customer.phone);
          if (d.customer.name) setName(d.customer.name);
          if (Array.isArray(d.customer.addresses)) {
            setSavedAddresses(d.customer.addresses);
            const def = d.customer.addresses[0];
            if (def) setSelectedAddressId(def.id);
          }
          if (typeof d.customer.loyaltyPoints === 'number') setLoyaltyBalance(d.customer.loyaltyPoints);
        }
      })
      .catch(() => null);
  }, []);
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PAYMOB' | 'FAWRY' | 'INSTAPAY' | 'VODAFONE_CASH'>('COD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const needsReceipt = paymentMethod === 'INSTAPAY' || paymentMethod === 'VODAFONE_CASH';
  const [orderCompleted, setOrderCompleted] = useState<{ orderNumber: string; trackingNumber: string; paymentInstructions?: string; paymentPending?: boolean; paymentError?: string | null } | null>(null);

  // One idempotency key per checkout attempt, reused across retries until the
  // order succeeds, so a double tap or a retried request cannot create two
  // orders (and charge the customer twice). A successful submit clears it.
  const [idempotencyKey, setIdempotencyKey] = useState(() => newCheckoutKey());

  // T01: only offer payment methods that are actually available (gateway-gated).
  const [availableMethods, setAvailableMethods] = useState<string[] | null>(null);
  useEffect(() => {
    void apiRequest<{ methods?: string[] }>('/api/payments/methods', { errorKey: 'storefront:checkout:methods' })
      .then((d) => {
        if (Array.isArray(d.methods) && d.methods.length > 0) {
          setAvailableMethods(d.methods);
          if (!d.methods.includes(paymentMethod)) setPaymentMethod('COD');
        } else {
          setAvailableMethods(['COD']);
        }
      })
      .catch(() => setAvailableMethods(['COD']));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = getSubtotal();
  const vat = getVatAmount();
  const finalDeliveryFee = fulfillmentType === 'PICKUP' ? 0 : deliveryFee;
  const total = subtotal + vat + finalDeliveryFee;

  // T16: coupon + loyalty redeem (server recomputes authoritatively).
  const [couponCode, setCouponCode] = useState('');
  const [couponAmount, setCouponAmount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [loyaltyBalance, setLoyaltyBalance] = useState<number | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [redeemRate, setRedeemRate] = useState(1);
  useEffect(() => {
    void apiRequest<{ rate?: number }>('/api/discounts/quote', { errorKey: 'storefront:checkout:quote' })
      .then((d) => {
        if (Number(d.rate) > 0) setRedeemRate(Number(d.rate));
      })
      .catch(() => null);
  }, []);
  const loyaltyPreview = Math.min(Math.max(0, Math.floor(Number(loyaltyPoints) || 0)), loyaltyBalance || 0) * redeemRate;
  const previewTotal = Math.max(0, total - couponAmount - loyaltyPreview);

  const applyCoupon = async () => {
    if (!couponCode.trim() || couponBusy) return;
    setCouponBusy(true);
    setCouponError('');
    try {
      const data = await apiRequest<{ amount?: number }>('/api/discounts/quote', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode.trim(), subtotal }),
        errorKey: 'storefront:checkout:coupon',
      });
      setCouponAmount(data.amount || 0);
    } catch {
      setCouponError(L('تعذر التحقق من الكود', 'Could not verify the code'));
    } finally {
      setCouponBusy(false);
    }
  };

  const fetchLoyalty = async () => {
    if (!phone.trim()) return;
    try {
      const data = await apiRequest<{ points?: number }>('/api/discounts/loyalty', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
        errorKey: 'storefront:checkout:loyalty',
      });
      if (typeof data.points === 'number') setLoyaltyBalance(data.points);
    } catch { /* silent */ }
  };

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptError('');
    setReceiptUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiRequest<{ url?: string }>('/api/upload/receipt', {
        method: 'POST',
        body: fd,
        errorKey: 'storefront:checkout:receipt',
      });
      if (data.url) setReceiptUrl(data.url);
      else setReceiptError(L('فشل رفع صورة الإيصال', 'Could not upload the receipt image'));
    } catch {
      setReceiptError(L('تعذر رفع الصورة. حاول مرة أخرى.', 'Could not upload the image. Please try again.'));
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || items.length === 0) return;
    if (needsReceipt && !receiptUrl) {
      setFormError(L('يرجى رفع صورة إيصال التحويل أولاً (InstaPay / فودافون كاش).', 'Please upload the transfer receipt first (InstaPay / Vodafone Cash).'));
      return;
    }
    // T09: saved address or typed address required for delivery.
    const useSavedAddress = fulfillmentType === 'DELIVERY' && selectedAddressId !== '';
    if (fulfillmentType === 'DELIVERY' && !useSavedAddress && !address.trim()) {
      setFormError(L('يرجى إدخال عنوان التوصيل.', 'Please enter a delivery address.'));
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const data = await apiRequest<{
        redirectUrl?: string;
        orderNumber: string;
        trackingNumber?: string;
        instructionsAr?: string;
        paymentPending?: boolean;
        paymentInitializationError?: string | null;
      }>('/api/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey,
          phone,
          name: name || L('عميل كريم', 'Valued customer'),
          address: fulfillmentType === 'PICKUP' ? L('استلام من فرع الإبراهيمية (92 شارع عمر لطفى)', 'Pickup from Ibrahimeyah branch (92 Omar Lotfy St.)') : address,
          addressId: useSavedAddress ? selectedAddressId : undefined,
          fulfillmentType,
          zoneId: selectedZone,
          deliveryFee: finalDeliveryFee,
          paymentMethod,
          receiptImage: receiptUrl || undefined,
          couponCode: couponCode.trim() || undefined,
          loyaltyPoints: Math.max(0, Math.floor(Number(loyaltyPoints) || 0)) || undefined,
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity, price: i.price })),
        }),
        errorKey: 'storefront:checkout:create',
      });

      // T01: real gateway → redirect to Paymob iframe; else show confirmation.
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        clearCart();
        // The order exists now, so the next checkout attempt is a different
        // order and must not reuse this key.
        setIdempotencyKey(newCheckoutKey());
        setOrderCompleted({
          orderNumber: data.orderNumber,
          trackingNumber: data.trackingNumber || '',
          paymentInstructions: data.instructionsAr,
           paymentPending: data.paymentPending,
           paymentError: data.paymentInitializationError,
        });
    } catch {
      setFormError(L('تعذر الاتصال بالسيرفر. يرجى المحاولة مرة أخرى.', 'Could not connect to the server. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderCompleted) {
    return (
        <main className="flex-1 max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            <h1 className="text-3xl font-black text-slate-100">{L('تم تأكيد طلبك بنجاح!', 'Your order was placed successfully!')}</h1>
            <p className="text-sm text-slate-400">
              {L('شكراً لتسوقك من ابطال الرياضة الإبراهيمية. تم إرسال تفاصيل الطلب عبر الواتساب.', 'Thank you for shopping with Sports Champions Alexandria. Order details were sent via WhatsApp.')}
            </p>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-start space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">{L('رقم الطلب', 'Order number')}:</span>
                <span className="font-extrabold text-amber-400 text-sm">{orderCompleted.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{L('رقم تتبع الشحنة', 'Shipment tracking number')}:</span>
                <span className="font-bold text-blue-400">{orderCompleted.trackingNumber}</span>
              </div>
              {orderCompleted.paymentInstructions && (
                <div className="pt-2 border-t border-slate-800 text-amber-300">
                  {orderCompleted.paymentInstructions}
                </div>
              )}
              {orderCompleted.paymentPending && (
                <div role="status" className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                  <p className="font-bold">{L('تم حفظ الطلب، لكن الدفع الإلكتروني لم يُثبت بعد.', 'The order was saved, but the electronic payment is not confirmed yet.')}</p>
                  {orderCompleted.paymentError && <p className="mt-1 text-xs">{orderCompleted.paymentError}</p>}
                  <p className="mt-1 text-xs">{L('سيظهر في الإدارة كطلب pending حتى webhook أو تسوية موثقة.', 'It will appear in Admin as a pending order until the webhook or documented reconciliation arrives.')}</p>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-center gap-4">
              <Button variant="primary" onClick={() => router.push(`/tracking?phone=${phone}&order=${orderCompleted.orderNumber}`)}>
                {L('تتبع حالة الشحنة الآن', 'Track shipment now')}
              </Button>
            </div>
          </div>
        </main>
  );
  }

  return (

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
                {L('بيانات التواصل (بدون حاجة لإنشاء حساب)', 'Contact details (no account required)')}
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
                    placeholder={L('مثال: أحمد محمود', 'Example: Ahmed Mahmoud')}
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
                  <span className="font-bold text-sm text-slate-100">{L('توصيل للمنزل بالإسكندرية', 'Home delivery in Alexandria')}</span>
                  <span className="text-[11px]">{L('عن طريق بوسطة (تتبع مباشر)', 'Via Bosta (live tracking)')}</span>
                </label>

                <label
                  onClick={() => setFulfillmentType('PICKUP')}
                  className={`p-4 rounded-2xl border cursor-pointer flex flex-col gap-2 transition-all ${
                    fulfillmentType === 'PICKUP'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                   <span className="font-bold text-sm text-slate-100">{L('استلام من فرع الإبراهيمية', 'Pickup from Ibrahimeyah branch')}</span>
                  <span className="text-[11px] text-amber-400">{L('مجاناً (92 شارع عمر لطفى)', 'Free (92 Omar Lotfy St.)')}</span>
                </label>
              </div>

              {fulfillmentType === 'DELIVERY' && (
                <div className="space-y-2 text-xs pt-2">
                  <label className="block font-bold text-slate-300 mb-1">
                    {tCheckout('addressLabel')} *
                  </label>
                  {savedAddresses.length > 0 && (
                    <div className="grid gap-2" role="radiogroup" aria-label={L('العناوين المحفوظة', 'Saved addresses')}>
                      {savedAddresses.map((a) => (
                        <label
                          key={a.id}
                          className={`p-3 rounded-2xl border cursor-pointer flex items-start gap-2 transition-all ${
                            selectedAddressId === a.id
                              ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="saved-address"
                            checked={selectedAddressId === a.id}
                            onChange={() => { setSelectedAddressId(a.id); setAddress(''); }}
                            className="mt-1 accent-blue-500 w-5 h-5"
                          />
                          <span>
                            <span className="font-bold block">{a.title} — {a.street}</span>
                            <span className="text-[11px]">{a.building ? `${a.building}${isAr ? '، ' : ', '}` : ''}{a.city}{isAr ? '، ' : ', '}{a.governorate}</span>
                          </span>
                        </label>
                      ))}
                      <label
                        className={`p-3 rounded-2xl border cursor-pointer flex items-center gap-2 transition-all ${
                          selectedAddressId === ''
                            ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          checked={selectedAddressId === ''}
                          onChange={() => setSelectedAddressId('')}
                          className="accent-blue-500 w-5 h-5"
                        />
                        <span className="font-bold">{L('عنوان جديد...', 'New address...')}</span>
                      </label>
                    </div>
                  )}
                  {(savedAddresses.length === 0 || selectedAddressId === '') && (
                    <textarea
                      required={selectedAddressId === ''}
                      rows={3}
                      placeholder={L('اسم الشارع، المنطقة، رقم العمارة والدور والشقة...', 'Street, area, building, floor, and apartment...')}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full min-h-[44px] p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  )}
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
                {availableMethods === null && (
                  <p className="text-[11px] text-slate-500">{L('جاري تحميل طرق الدفع...', 'Loading payment methods...')}</p>
                )}
                {availableMethods !== null && !availableMethods.includes('PAYMOB') && !availableMethods.includes('FAWRY') && availableMethods.length <= 3 && (
                  <p className="text-[11px] text-slate-500">{L('الدفع الإلكتروني غير مفعل حالياً — الدفع عند الاستلام والتحويل متاحان.', 'Electronic payment is not enabled yet — cash on delivery and transfer are available.')}</p>
                )}
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
                    <span className="text-[11px] text-slate-400">{L('ادفع نقداً عند وصول الشحنة لمندوب الشحن', 'Pay cash when the courier arrives')}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">{L('متاح دائماً', 'Always available')}</span>
                </label>

                {(!availableMethods || availableMethods.includes('PAYMOB')) && (
                <label
                  onClick={() => setPaymentMethod('PAYMOB')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'PAYMOB'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">{L('باي مب Paymob (فيزا/ماستر/محافظ)', 'Paymob (Visa/Mastercard/wallets)')}</span>
                    <span className="text-[11px] text-slate-400">{L('فودافون كاش، اتصالات كاش، أورانج كاش وكروت البنوك', 'Vodafone Cash, Etisalat Cash, Orange Cash, and bank cards')}</span>
                  </div>
                </label>
                )}

                {(!availableMethods || availableMethods.includes('FAWRY')) && (
                <label
                  onClick={() => setPaymentMethod('FAWRY')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'FAWRY'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">{L('فوري Fawry (رقم مرجعي)', 'Fawry (reference number)')}</span>
                    <span className="text-[11px] text-slate-400">{L('كود دفع بالسوبرماركت ومنافذ فوري', 'Payment code at supermarkets and Fawry points')}</span>
                  </div>
                </label>
                )}

                {(!availableMethods || availableMethods.includes('INSTAPAY')) && (
                <label
                  onClick={() => setPaymentMethod('INSTAPAY')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'INSTAPAY'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">{L('تحويل انستا باي InstaPay مباشر', 'Direct InstaPay transfer')}</span>
                    <span className="text-[11px] text-slate-400">{L('سيظهر حساب التحويل الآمن بعد التحقق من إعدادات المتجر', 'The secure transfer account will appear after store settings are verified')}</span>
                  </div>
                </label>
                )}

                {(!availableMethods || availableMethods.includes('VODAFONE_CASH')) && (
                <label
                  onClick={() => setPaymentMethod('VODAFONE_CASH')}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    paymentMethod === 'VODAFONE_CASH'
                      ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-sm text-slate-100">{L('محفظة فودافون كاش', 'Vodafone Cash wallet')}</span>
                    <span className="text-[11px] text-slate-400">{L('سيظهر رقم المحفظة الآمن بعد التحقق من إعدادات المتجر', 'The secure wallet number will appear after store settings are verified')}</span>
                  </div>
                </label>
                )}

                {needsReceipt && (
                  <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-3">
                    <label htmlFor="receipt-upload" className="block font-bold text-sm text-amber-300">
                      {L('صورة إيصال التحويل (مطلوبة) *', 'Transfer receipt image (required) *')}
                    </label>
                    <input
                      id="receipt-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptChange}
                      className="w-full text-xs text-slate-300 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-500 file:text-slate-950 file:font-bold file:text-xs"
                    />
                    {receiptUploading && <p className="text-[11px] text-slate-400">{L('جاري رفع الصورة...', 'Uploading image...')}</p>}
                    {receiptError && (
                      <p role="alert" className="text-[11px] font-bold text-rose-400">{receiptError}</p>
                    )}
                    {receiptUrl && (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={receiptUrl} alt={L('صورة إيصال التحويل', 'Transfer receipt image')} className="w-20 h-20 rounded-xl object-cover border border-amber-500/40" />
                        <p className="text-[11px] font-bold text-emerald-400">{L('تم رفع الإيصال بنجاح ✓', 'Receipt uploaded successfully ✓')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-extrabold text-base text-slate-100 border-b border-slate-800 pb-3">
                {L('ملخص الفاتورة', 'Order summary')}
              </h3>

              <div className="app-scrollbar space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      {isAr ? item.nameAr : item.nameEn} x{item.quantity}
                    </span>
                    <span className="font-bold text-slate-100">
                      {(item.price * item.quantity).toLocaleString()} {tCommon('currency')}
                    </span>
                  </div>
                ))}
              </div>

              {/* T16: coupon + loyalty */}
              <div className="space-y-3 text-xs border-t border-b border-slate-800/80 py-4">
                <div className="flex gap-2">
                  <label htmlFor="coupon-code" className="sr-only">{L('كود الخصم', 'Discount code')}</label>
                  <input
                    id="coupon-code"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value); setCouponAmount(0); setCouponError(''); }}
                    placeholder={L('كود الخصم (اختياري)', 'Discount code (optional)')}
                    dir="ltr"
                    className="flex-1 min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold focus:outline-none focus:border-purple-500"
                  />
                  <button type="button" onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()} className="min-h-[44px] px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold">
                    {couponBusy ? '...' : L('تطبيق', 'Apply')}
                  </button>
                </div>
                {couponError && <p role="alert" className="text-rose-400 font-bold">{couponError}</p>}
                {couponAmount > 0 && <p className="text-emerald-400 font-bold">{L('خصم الكوبون', 'Coupon discount')}: −{couponAmount.toLocaleString()} {tCommon('currency')}</p>}
                <div className="flex gap-2 items-center">
                  <label htmlFor="loyalty-points" className="sr-only">{L('النقاط', 'Points')}</label>
                  <input
                    id="loyalty-points"
                    type="number"
                    min="0"
                    value={loyaltyPoints}
                    onChange={(e) => setLoyaltyPoints(e.target.value)}
                    onBlur={fetchLoyalty}
                    placeholder={loyaltyBalance !== null ? L(`نقاطك: ${loyaltyBalance} (القيمة ${redeemRate} ج/نقطة)`, `Your points: ${loyaltyBalance} (value ${redeemRate} EGP/point)`) : L('نقاط الولاء (أدخل رقمك أولاً)', 'Loyalty points (enter your number first)')}
                    className="flex-1 min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                {loyaltyPreview > 0 && <p className="text-amber-300 font-bold">{L('خصم النقاط التقريبي', 'Estimated points discount')}: −{loyaltyPreview.toLocaleString()} {tCommon('currency')}</p>}
              </div>

              <div className="space-y-2 text-xs border-t border-b border-slate-800/80 py-4">
                <div className="flex justify-between text-slate-400">
                  <span>{L('المجموع الفرعي', 'Subtotal')}:</span>
                  <span className="font-semibold text-slate-200">{subtotal.toLocaleString()} {tCommon('currency')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{L('ضريبة القيمة المضافة 14%', 'VAT 14%')}:</span>
                  <span className="font-semibold text-slate-200">{vat.toLocaleString()} {tCommon('currency')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{L('رسوم التوصيل', 'Delivery fee')}:</span>
                  <span className="font-semibold text-amber-400">{finalDeliveryFee} {tCommon('currency')}</span>
                </div>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="font-bold text-sm text-slate-300">{L('الإجمالي الكلي', 'Grand total')}:</span>
                <div className="text-start">
                  <span className="text-2xl font-black text-slate-100">{total.toLocaleString()}</span>
                  <span className="text-xs font-bold text-amber-400 ml-1">{tCommon('currency')}</span>
                  {(couponAmount > 0 || loyaltyPreview > 0) && (
                    <div className="text-[11px] text-emerald-400 font-bold">{L('بعد الخصم التقريبي', 'After estimated discount')}: {previewTotal.toLocaleString()} {tCommon('currency')}</div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-sm shadow-control transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? L('جاري التأكيد...', 'Confirming...') : tCheckout('placeOrder')}
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
  );
}
