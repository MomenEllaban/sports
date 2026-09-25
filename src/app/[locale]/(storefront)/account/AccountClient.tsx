'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useStorefrontSession } from '@/components/storefront/StorefrontSessionProvider';
import { User, Phone, Package, Star, MapPin, LogOut, Trash2, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/client-api';

interface PortalOrder {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  trackingNumber: string | null;
  createdAt: string;
  items: Array<{ quantity: number; unitPrice: number; totalPrice: number; product: { nameAr: string; nameEn: string; sku: string } }>;
}

interface PortalAddress {
  id: string;
  title: string;
  street: string;
  building: string | null;
  city: string;
  governorate: string;
}

interface Me {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  addresses: PortalAddress[];
  orders: PortalOrder[];
}

export default function AccountClient() {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const orderStatusLabel = (value: string) => isAr
    ? ({ PENDING: 'قيد التجهيز', PROCESSING: 'قيد التجهيز', SHIPPED: 'تم الشحن', DELIVERED: 'تم التسليم', CANCELLED: 'ملغي' } as Record<string, string>)[value] || value
    : ({ PENDING: 'Processing', PROCESSING: 'Processing', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' } as Record<string, string>)[value] || value;
  const paymentStatusLabel = (value: string) => isAr
    ? ({ PAID: 'مدفوع', PENDING: 'قيد الدفع', FAILED: 'فشل' } as Record<string, string>)[value] || value
    : ({ PAID: 'Paid', PENDING: 'Payment pending', FAILED: 'Failed' } as Record<string, string>)[value] || value;
  const router = useRouter();
  const { setAuthenticated, mergeGuestWishlist } = useStorefrontSession();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ success?: boolean; customer?: Me }>('/api/account/me', {
        suppressAuthRedirect: true,
        suppressErrorEvents: true,
        errorKey: 'account:me',
      });
      setMe(data.customer ?? null);
    } catch {
      // A guest/expired portal cookie is an expected state, not console noise.
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);
    try {
      const data = await apiRequest<{ success?: boolean; customer?: Me; error?: string }>('/api/account/login', {
        method: 'POST',
        body: JSON.stringify({ phone, orderNumber }),
        suppressErrorEvents: true,
        errorKey: 'account:login',
      });
      if (data.success) {
        setAuthenticated(true);
        try {
          await mergeGuestWishlist();
        } catch {
          // The portal session is valid; keep guest IDs locally if merge is unavailable.
        }
        setPhone('');
        setOrderNumber('');
        await load();
      } else {
        setError(data.error || (isAr ? 'فشل تسجيل الدخول' : 'Login failed'));
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : (isAr ? 'تعذر الاتصال بالسيرفر' : 'Connection failed'));
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/account/logout', { method: 'POST', suppressErrorEvents: true, errorKey: 'account:logout' });
    } finally {
      setAuthenticated(false);
      setMe(null);
      router.refresh();
    }
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim()) return;
    try {
      await apiRequest('/api/account/addresses', {
        method: 'POST',
        body: JSON.stringify({ street, building }),
        suppressErrorEvents: true,
        errorKey: 'account:address:create',
      });
      setStreet('');
      setBuilding('');
      await load();
    } catch (addressError) {
      setError(addressError instanceof Error ? addressError.message : (isAr ? 'تعذر حفظ العنوان' : 'Could not save address'));
    }
  };

  const removeAddress = async (id: string) => {
    try {
      await apiRequest(`/api/account/addresses?id=${id}`, { method: 'DELETE', suppressErrorEvents: true, errorKey: 'account:address:delete' });
      await load();
    } catch (addressError) {
      setError(addressError instanceof Error ? addressError.message : (isAr ? 'تعذر حذف العنوان' : 'Could not delete address'));
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;
  }

  if (!me) {
    return (
      <form onSubmit={login} className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-4 max-w-md mx-auto">
        <h2 className="font-black text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-blue-400" />
          {isAr ? 'دخول بوابة العميل' : 'Customer login'}
        </h2>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {isAr
            ? 'ادخل رقم موبايلك + رقم أي طلب سابق (ستجده في رسالة التأكيد) للتحقق — بدون كلمات مرور.'
            : 'Enter your phone + any previous order number to verify — no passwords needed.'}
        </p>
        <div>
          <label htmlFor="portal-phone" className="block text-xs font-bold text-slate-300 mb-1">
            {isAr ? 'رقم الموبايل *' : 'Phone *'}
          </label>
          <div className="relative">
            <input
              id="portal-phone"
              type="tel"
              required
              placeholder="01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-3 pl-10 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-blue-500 font-semibold text-sm"
              dir="ltr"
            />
            <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
          </div>
        </div>
        <div>
          <label htmlFor="portal-order" className="block text-xs font-bold text-slate-300 mb-1">
            {isAr ? 'رقم طلب سابق *' : 'Previous order number *'}
          </label>
          <input
            id="portal-order"
            type="text"
            required
            placeholder="ORD-2026-XXXX"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm"
            dir="ltr"
          />
        </div>
        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold text-center">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loggingIn}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-extrabold text-sm"
        >
          {loggingIn ? (isAr ? 'جاري الدخول...' : 'Signing in...') : isAr ? 'دخول' : 'Sign in'}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-lg">{isAr ? `أهلاً ${me.name || 'عميلنا الكريم'}` : `Hi ${me.name || 'customer'}`}</h2>
          <p className="text-xs text-slate-400" dir="ltr">{me.phone}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800">
          <LogOut className="w-4 h-4" />
          {isAr ? 'خروج' : 'Logout'}
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
            <Star className="w-4 h-4" />
            {isAr ? 'نقاط الولاء' : 'Loyalty points'}
          </div>
          <div className="text-3xl font-black text-slate-100">{me.loyaltyPoints.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">{isAr ? 'نقطة لكل 10 جنيه مشتريات' : '1 point per 10 EGP'}</div>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
            <Package className="w-4 h-4" />
            {isAr ? 'طلباتك' : 'Your orders'}
          </div>
          <div className="text-3xl font-black text-slate-100">{me.orders.length}</div>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
            <MapPin className="w-4 h-4" />
            {isAr ? 'عناوين التوصيل' : 'Addresses'}
          </div>
          <div className="text-3xl font-black text-slate-100">{me.addresses.length}</div>
        </div>
      </div>

      <section className="glass-panel rounded-3xl border border-slate-800 p-5 space-y-3">
        <h3 className="font-black text-sm">{isAr ? 'سجل الطلبات' : 'Order history'}</h3>
        {me.orders.length === 0 && <p className="text-xs text-slate-500">{isAr ? 'لا توجد طلبات بعد.' : 'No orders yet.'}</p>}
        <div className="space-y-2">
          {me.orders.map((o) => (
            <div key={o.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-black text-amber-400 font-mono" dir="ltr">{o.orderNumber}</span>
                <span className="font-black text-slate-100">{o.totalAmount.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 font-bold">{orderStatusLabel(o.orderStatus)}</span>
                <span className={`px-2 py-0.5 rounded-lg font-bold ${o.paymentStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {paymentStatusLabel(o.paymentStatus)}
                </span>
                {o.trackingNumber && <span dir="ltr" className="font-mono">{o.trackingNumber}</span>}
                <span>{new Date(o.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {o.items.map((i, idx) => (
                  <span key={idx}>
                    {isAr ? i.product.nameAr : i.product.nameEn} ×{i.quantity}
                    {idx < o.items.length - 1 ? ' • ' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-3xl border border-slate-800 p-5 space-y-3">
        <h3 className="font-black text-sm">{isAr ? 'عناوين التوصيل' : 'Delivery addresses'}</h3>
        <div className="space-y-2">
          {me.addresses.map((a) => (
            <div key={a.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-100">{a.title} — {a.street}</div>
                <div className="text-[11px] text-slate-400">{a.building ? `${a.building}${isAr ? '، ' : ', '}` : ''}{a.city}{isAr ? '، ' : ', '}{a.governorate}</div>
              </div>
              <button onClick={() => removeAddress(a.id)} aria-label={isAr ? 'حذف العنوان' : 'Delete address'} className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={addAddress} className="grid sm:grid-cols-[1fr_140px_auto] gap-2">
          <div>
            <label htmlFor="addr-street" className="sr-only">{isAr ? 'الشارع والمنطقة' : 'Street'}</label>
            <input id="addr-street" value={street} onChange={(e) => setStreet(e.target.value)} placeholder={isAr ? 'الشارع والمنطقة...' : 'Street & area...'} className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label htmlFor="addr-building" className="sr-only">{isAr ? 'العمارة' : 'Building'}</label>
            <input id="addr-building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder={isAr ? 'عمارة/شقة' : 'Bldg/Apt'} className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit" className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" />
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </form>
      </section>
    </div>
  );
}
