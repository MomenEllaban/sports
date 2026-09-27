'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Sparkles, Save, Truck, ShoppingBag, Percent, Gift } from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

export interface AutoPromoConfig {
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  bulkDiscountEnabled: boolean;
  bulkMinQty: number;
  bulkPercent: number;
  cartTierDiscountEnabled: boolean;
  cartTierMinTotal: number;
  cartTierPercent: number;
  promoBannerTextAr: string;
  promoBannerTextEn: string;
}

export default function AutoPromosManager({ initial }: { initial: AutoPromoConfig }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [form, setForm] = useState<AutoPromoConfig>(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', 'PUT', {
        key: 'marketing.autoPromos',
        value: JSON.stringify(form),
      });
      toast(isAr ? 'تم حفظ قواعد العروض التلقائية بنجاح' : 'Automatic promo rules saved successfully', 'success');
      router.refresh();
    } catch {
      toast(isAr ? 'فشل حفظ العروض' : 'Failed to save auto promo rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100">
                {L('العروض والخصومات التلقائية (بدون كود)', 'Automatic Cart Discounts & Free Shipping')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {L('تُطبَّق هذه الخصومات تلقائياً في سلة الشراء والكاشير عند استيفاء الشروط', 'Automatically applied in shopping cart and POS without needing a coupon code')}
              </p>
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="w-4 h-4 me-1.5" />
            {saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ العروض', 'Save offers')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Shipping Rule */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-200 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                {L('عرض الشحن المجاني التلقائي', 'Auto Free Shipping')}
              </label>
              <input
                type="checkbox"
                checked={form.freeShippingEnabled}
                onChange={(e) => setForm({ ...form, freeShippingEnabled: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {L('إلغاء مصاريف الشحن لطلبات الإسكندرية عند بلوغ قيمة معينة', 'Waive delivery fees when cart exceeds threshold')}
            </p>
            {form.freeShippingEnabled && (
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  {L('الحد الأدنى لقيمة الطلب (ج.م)', 'Minimum order amount (EGP)')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={form.freeShippingThreshold}
                    onChange={(e) => setForm({ ...form, freeShippingThreshold: Number(e.target.value) || 1000 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                  <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{currencyLabel}</span>
                </div>
              </div>
            )}
          </div>

          {/* Cart Value Tier Discount */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-200 flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-400" />
                {L('خصم سلة المشتريات الكبير', 'Cart Total Tier Discount')}
              </label>
              <input
                type="checkbox"
                checked={form.cartTierDiscountEnabled}
                onChange={(e) => setForm({ ...form, cartTierDiscountEnabled: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {L('خصم نسبة مئوية تلقائياً عند تجاوز إجمالي السلة حداً معيناً', 'Automatic percentage discount above target cart total')}
            </p>
            {form.cartTierDiscountEnabled && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {L('فوق مبلغ (ج.م)', 'Above Total')}
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="100"
                    value={form.cartTierMinTotal}
                    onChange={(e) => setForm({ ...form, cartTierMinTotal: Number(e.target.value) || 2000 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {L('نسبة الخصم %', 'Discount %')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.cartTierPercent}
                    onChange={(e) => setForm({ ...form, cartTierPercent: Number(e.target.value) || 10 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bulk Quantity Discount */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-200 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-400" />
                {L('خصم الكميات والقطع المتعددة', 'Quantity Multi-buy Discount')}
              </label>
              <input
                type="checkbox"
                checked={form.bulkDiscountEnabled}
                onChange={(e) => setForm({ ...form, bulkDiscountEnabled: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {L('تشجيع شراء قطع أكثر بخصم تلقائي عند شراء قطعتين أو أكثر', 'Encourage higher basket size with multi-item discounts')}
            </p>
            {form.bulkDiscountEnabled && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {L('عند شراء (قطع)', 'Min Items')}
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={form.bulkMinQty}
                    onChange={(e) => setForm({ ...form, bulkMinQty: Number(e.target.value) || 3 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {L('نسبة الخصم %', 'Discount %')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={form.bulkPercent}
                    onChange={(e) => setForm({ ...form, bulkPercent: Number(e.target.value) || 15 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Promotional Announcement Banner */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <label className="text-xs font-black text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {L('شريط الإعلان الترويجي بالمتجر (Promo Banner)', 'Top Announcement Banner')}
            </label>
            <p className="text-[11px] text-slate-500">
              {L('النص الذي يظهر في الشريط الإعلاني العلوي لزوار الموقع', 'Promotional announcement shown in the header banner')}
            </p>
            <div className="space-y-2 pt-1">
              <input
                type="text"
                placeholder={isAr ? 'مثال: شحن مجاني لكافة طلبات الإسكندرية فوق 1000 ج.م!' : 'e.g. Free shipping on all orders over 1000 EGP!'}
                value={form.promoBannerTextAr}
                onChange={(e) => setForm({ ...form, promoBannerTextAr: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
              <input
                type="text"
                dir="ltr"
                placeholder="English banner text..."
                value={form.promoBannerTextEn}
                onChange={(e) => setForm({ ...form, promoBannerTextEn: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
