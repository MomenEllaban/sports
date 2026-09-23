'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Save } from 'lucide-react';
import { apiFetch, Field, fieldInputCls } from './ui';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/foundation';

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
            className={fieldInputCls}
          />
        </Field>
      </div>
      <Button
        onClick={() => save(key)}
        disabled={saving === key}
        variant="primary"
      >
        <Save className="w-3.5 h-3.5" />
        {saving === key ? '...' : isAr ? 'حفظ' : 'Save'}
      </Button>
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
            className={fieldInputCls}
            dir="ltr"
          />
        </Field>
      </div>
      <Button
        onClick={() => save(key)}
        disabled={saving === key}
        variant="primary"
      >
        <Save className="w-3.5 h-3.5" />
        {saving === key ? '...' : isAr ? 'حفظ' : 'Save'}
      </Button>
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
          <Button
            onClick={() => save('shipping.zones')}
            disabled={saving === 'shipping.zones'}
            variant="primary"
          >
            {isAr ? 'حفظ المناطق' : 'Save zones'}
          </Button>
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
          <Button
            onClick={() => save('payments.methods')}
            disabled={saving === 'payments.methods'}
            variant="primary"
          >
            {isAr ? 'حفظ' : 'Save'}
          </Button>
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

      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 lg:col-span-2">
        <h3 className="font-extrabold text-sm text-slate-100 border-b border-slate-800 pb-3">
          {isAr ? 'التكاملات الخارجية (تُفعَّل من هنا — العميل يملأ البيانات)' : 'External integrations (activate here)'}
        </h3>

        <IntegrationSection
          title={isAr ? 'منظومة الفاتورة الإلكترونية ETA' : 'ETA eInvoicing'}
          status={
            form['eta.mode'] === 'off' ? (
              <StatusPill off label={isAr ? 'غير مفعّلة — وضع محلي' : 'Not activated — offline mode'} />
            ) : !(form['eta.clientId'] && form['eta.clientSecret'] && form['eta.taxRegNumber']) ? (
              <StatusPill warn label={isAr ? 'مفعّلة جزئياً — ينقصها بيانات' : 'Partially enabled — missing data'} />
            ) : (
              <StatusPill on label={isAr ? 'مفعّلة — إرسال حقيقي' : 'Active — live submission'} />
            )
          }
          hint={
            isAr
              ? 'تحتاج: حساب preprod/production على بوابة مصلحة الضرائب + Client ID و Client Secret + رقم التسجيل الضريبي + ختم إلكتروني (HSM) للتوقيع. بدونها تبقى الفواتير محلية بـ QR فقط.'
              : 'Needs: ETA portal account + Client ID/Secret + tax reg number + e-seal (HSM). Otherwise invoices stay local with QR only.'
          }
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Field label={isAr ? 'وضع ETA' : 'ETA mode'}>
                <select
                  value={String(form['eta.mode'] ?? 'off')}
                  onChange={(e) => set('eta.mode', e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  dir="ltr"
                >
                  <option value="off">off (offline)</option>
                  <option value="preprod">preprod (test)</option>
                  <option value="production">production (live)</option>
                </select>
              </Field>
            </div>
            <div className="flex items-end">
              <Button onClick={() => save('eta.mode')} disabled={saving === 'eta.mode'} variant="primary">
                {isAr ? 'حفظ الوضع' : 'Save mode'}
              </Button>
            </div>
          </div>
          {etaText('eta.clientId', isAr ? 'Client ID' : 'Client ID', 'ETA portal → app credentials', true)}
          {etaText('eta.clientSecret', isAr ? 'Client Secret' : 'Client Secret', isAr ? 'يُحفظ للإدارة فقط' : 'Admin-only', true)}
          {etaText('eta.taxRegNumber', isAr ? 'رقم التسجيل الضريبي' : 'Tax registration number', '123-456-789', true)}
        </IntegrationSection>

        <IntegrationSection
          title={isAr ? 'واتساب الرسمية (Business Cloud API)' : 'WhatsApp Business Cloud API'}
          status={
            form['whatsapp.mode'] === 'off' ? (
              <StatusPill off label={isAr ? 'غير مفعّلة — روابط wa.me فقط' : 'Not activated — wa.me links only'} />
            ) : !(form['whatsapp.phoneId'] && form['whatsapp.token']) ? (
              <StatusPill warn label={isAr ? 'مفعّلة جزئياً — ينقصها بيانات' : 'Partially enabled — missing data'} />
            ) : (
              <StatusPill on label={isAr ? 'مفعّلة — إرسال تلقائي' : 'Active — auto send'} />
            )
          }
          hint={
            isAr
              ? 'تحتاج: حساب Meta Business + رقم واتساب رسمي + Phone Number ID و API Token + قالب معتمد (مثل order_confirmation). بدونها تصل الإشعارات داخل النظام فقط.'
              : 'Needs: Meta Business account + official number + Phone ID/token + approved template. Otherwise in-app notifications only.'
          }
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Field label={isAr ? 'وضع واتساب' : 'WhatsApp mode'}>
                <select
                  value={String(form['whatsapp.mode'] ?? 'off')}
                  onChange={(e) => set('whatsapp.mode', e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs"
                  dir="ltr"
                >
                  <option value="off">off (links only)</option>
                  <option value="cloud">cloud (API)</option>
                </select>
              </Field>
            </div>
            <div className="flex items-end">
              <Button onClick={() => save('whatsapp.mode')} disabled={saving === 'whatsapp.mode'} variant="primary">
                {isAr ? 'حفظ الوضع' : 'Save mode'}
              </Button>
            </div>
          </div>
          {etaText('whatsapp.phoneId', 'Phone Number ID', 'Meta dashboard → WhatsApp → API', true)}
          {etaText('whatsapp.token', 'API Token', isAr ? 'توكن دائم (System User)' : 'Permanent system-user token', true)}
          {etaText('whatsapp.templateOrder', isAr ? 'قالب تأكيد الطلب' : 'Order template name', 'order_confirmation', true)}
        </IntegrationSection>

        <IntegrationSection
          title={isAr ? 'بوابة العميل (حسابي)' : 'Customer portal'}
          status={
            form['portal.enabled'] ? (
              <StatusPill on label={isAr ? 'مفعّلة — صفحة /account' : 'Active — /account page'} />
            ) : (
              <StatusPill off label={isAr ? 'معطّلة' : 'Disabled'} />
            )
          }
          hint={isAr ? 'الدخول برقم الموبايل + رقم آخر طلب للتحقق. يمكن إيقافها من هنا في أي وقت.' : 'Login with phone + last order number. Can be disabled anytime.'}
        >
          <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form['portal.enabled']}
              onChange={(e) => set('portal.enabled', e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            {isAr ? 'تفعيل بوابة العميل' : 'Enable customer portal'}
          </label>
          <Button onClick={() => save('portal.enabled')} disabled={saving === 'portal.enabled'} variant="primary">
            {isAr ? 'حفظ' : 'Save'}
          </Button>
        </IntegrationSection>
      </div>
    </div>
  );

  function etaText(key: string, label: string, hint?: string, ltr = false) {
    return (
      <div className="flex gap-2 items-end mt-3">
        <div className="flex-1">
          <Field label={label} hint={hint}>
            <input
              value={String(form[key] ?? '')}
              dir={ltr ? 'ltr' : undefined}
              type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('token') ? 'password' : 'text'}
              onChange={(e) => set(key, e.target.value)}
              className={fieldInputCls}
            />
          </Field>
        </div>
        <Button
          onClick={() => save(key)}
          disabled={saving === key}
          variant="primary"
        >
          {saving === key ? '...' : isAr ? 'حفظ' : 'Save'}
        </Button>
      </div>
    );
  }
}

function IntegrationSection({ title, status, hint, children }: { title: string; status: React.ReactNode; hint: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-black text-sm text-slate-100">{title}</h4>
        {status}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{hint}</p>
      <div>{children}</div>
    </div>
  );
}

function StatusPill({ on, off, warn, label }: { on?: boolean; off?: boolean; warn?: boolean; label: string }) {
  const cls = on
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : warn
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-slate-500/15 text-slate-400 border-slate-600/40';
  return <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${cls}`}>{label}</span>;
}
