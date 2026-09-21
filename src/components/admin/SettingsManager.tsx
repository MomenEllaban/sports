'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Save } from 'lucide-react';
import { apiFetch, Field } from './ui';
import { useToast } from '@/components/Toast';

interface Zone {
  id: string;
  nameAr: string;
  nameEn: string;
  fee: number;
}

interface PayMethod {
  id: string;
  enabled: boolean;
  handle?: string;
  number?: string;
}

export default function SettingsManager({ initial }: { initial: Record<string, unknown> }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const [saving, setSaving] = useState('');
  const [form, setForm] = useState<Record<string, unknown>>({ ...initial });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (key: string) => {
    setSaving(key);
    try {
      await apiFetch('/api/admin/settings', 'PUT', { key, value: form[key] });
      toast(isAr ? 'تم حفظ الإعداد' : 'Setting saved', 'success');
      router.refresh();
    } catch {
      toast(isAr ? 'فشل الحفظ' : 'Save failed', 'error');
    } finally {
      setSaving('');
    }
  };

  const text = (key: string, label: string, hint?: string, ltr = false) => (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Field label={label} hint={hint}>
          <input
            value={String(form[key] ?? '')}
            dir={ltr ? 'ltr' : undefined}
            onChange={(e) => set(key, e.target.value)}
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
          />
        </Field>
      </div>
      <button
        onClick={() => save(key)}
        disabled={saving === key}
        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1 shrink-0"
      >
        <Save className="w-3.5 h-3.5" />
        {saving === key ? '...' : isAr ? 'حفظ' : 'Save'}
      </button>
    </div>
  );

  const num = (key: string, label: string, hint?: string) => (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Field label={label} hint={hint}>
          <input
            type="number"
            min={0}
            step="any"
            value={String(form[key] ?? '')}
            onChange={(e) => set(key, Number(e.target.value))}
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
            dir="ltr"
          />
        </Field>
      </div>
      <button
        onClick={() => save(key)}
        disabled={saving === key}
        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs flex items-center gap-1 shrink-0"
      >
        <Save className="w-3.5 h-3.5" />
        {saving === key ? '...' : isAr ? 'حفظ' : 'Save'}
      </button>
    </div>
  );

  const zones = (Array.isArray(form['shipping.zones']) ? (form['shipping.zones'] as Zone[]) : []);
  const methods = (Array.isArray(form['payments.methods']) ? (form['payments.methods'] as PayMethod[]) : []);
  const integrations = (form['integrations'] as Record<string, boolean>) || {};

  const setZoneFee = (id: string, fee: number) =>
    set('shipping.zones', zones.map((z) => (z.id === id ? { ...z, fee } : z)));

  const toggleMethod = (id: string) =>
    set('payments.methods', methods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));

  const setMethodField = (id: string, field: 'handle' | 'number', value: string) =>
    set('payments.methods', methods.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
          {isAr ? 'هوية المتجر والتواصل' : 'Store identity & contacts'}
        </h3>
        <div className="space-y-3">
          {text('store.nameAr', isAr ? 'اسم المتجر (عربي)' : 'Store name (AR)')}
          {text('store.nameEn', isAr ? 'اسم المتجر (إنجليزي)' : 'Store name (EN)', undefined, true)}
          {text('store.landline', isAr ? 'التليفون الأرضي' : 'Landline', '03 xxxxxxx', true)}
          {text('store.whatsapp', isAr ? 'واتساب (يظهر بزر واتساب)' : 'WhatsApp number', '01xxxxxxxxx', true)}
          {text('store.addressAr', isAr ? 'العنوان (عربي)' : 'Address (AR)')}
          {text('store.addressEn', isAr ? 'العنوان (إنجليزي)' : 'Address (EN)', undefined, true)}
          {text('store.taxNumber', isAr ? 'رقم التسجيل الضريبي' : 'Tax registration', '123-456-789', true)}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
          {isAr ? 'الضرائب والولاء والحدود' : 'Tax, loyalty & thresholds'}
        </h3>
        <div className="space-y-3">
          {num('vat.rate', isAr ? 'نسبة الضريبة (0.14 = 14%)' : 'VAT rate (0.14 = 14%)', isAr ? 'تغييرها يؤثر على كل الفواتير الجديدة' : 'Affects all new invoices')}
          {num('loyalty.earnPerEgp', isAr ? 'جنيه لكل نقطة ولاء' : 'EGP per loyalty point')}
          {num('loyalty.pointsPerUnit', isAr ? 'نقاط الولاء لكل وحدة' : 'Points per unit')}
          {num('discount.approvalThreshold', isAr ? 'عتبة اعتماد الخصم (ج.م)' : 'Discount approval threshold (EGP)')}
          {num('stock.lowThreshold', isAr ? 'عتبة المخزون المنخفض' : 'Low-stock threshold')}
          {text('receipt.headerAr', isAr ? 'ترويسة الفاتورة' : 'Receipt header')}
          {text('receipt.footerAr', isAr ? 'تذييل الفاتورة' : 'Receipt footer')}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-sm text-slate-100">
            {isAr ? 'مناطق ورسوم التوصيل' : 'Delivery zones & fees'}
          </h3>
          <button
            onClick={() => save('shipping.zones')}
            disabled={saving === 'shipping.zones'}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs"
          >
            {isAr ? 'حفظ المناطق' : 'Save zones'}
          </button>
        </div>
        <div className="space-y-2">
          {zones.map((z) => (
            <div key={z.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center gap-3 text-xs">
              <span className="font-bold text-slate-200">{isAr ? z.nameAr : z.nameEn}</span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={z.fee}
                  onChange={(e) => setZoneFee(z.id, Number(e.target.value))}
                  className="w-20 p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  dir="ltr"
                  aria-label={`${z.id} fee`}
                />
                <span className="text-amber-400 font-bold">{isAr ? 'ج.م' : 'EGP'}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-extrabold text-sm text-slate-100">
            {isAr ? 'طرق الدفع' : 'Payment methods'}
          </h3>
          <button
            onClick={() => save('payments.methods')}
            disabled={saving === 'payments.methods'}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-xs"
          >
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
        <div className="space-y-2 text-xs">
          {methods.map((m) => (
            <div key={m.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-black text-slate-100" dir="ltr">{m.id}</span>
                <input type="checkbox" checked={!!m.enabled} onChange={() => toggleMethod(m.id)} className="w-4 h-4 accent-blue-600" />
              </label>
              {(m.id === 'INSTAPAY' || m.id === 'VODAFONE_CASH') && (
                <input
                  value={m.id === 'INSTAPAY' ? m.handle || '' : m.number || ''}
                  onChange={(e) => setMethodField(m.id, m.id === 'INSTAPAY' ? 'handle' : 'number', e.target.value)}
                  placeholder={m.id === 'INSTAPAY' ? 'IPA handle' : '01xxxxxxxxx'}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  dir="ltr"
                />
              )}
            </div>
          ))}
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="font-bold text-slate-200">{isAr ? 'حالة الربط الخارجي (قراءة فقط — تُدار من البيئة)' : 'Integration status (read-only)'}</div>
          {Object.entries(integrations).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span dir="ltr">{k}</span>
              <span className={v ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{v ? 'ON' : 'OFF'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
