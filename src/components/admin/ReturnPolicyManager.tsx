'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ShieldCheck, Save, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/foundation';
import { useToast } from '@/components/Toast';
import { apiFetch } from './ui';

interface ReturnPolicyConfig {
  windowDays: number;
  exchangeWindowDays: number;
  requireReceipt: boolean;
  requireTags: boolean;
  managerApprovalThreshold: number;
  allowStoreCredit: boolean;
  policyTextAr: string;
  policyTextEn: string;
}

export default function ReturnPolicyManager({ initial }: { initial: ReturnPolicyConfig }) {
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const currencyLabel = L('ج.م', 'EGP');

  const [form, setForm] = useState<ReturnPolicyConfig>(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', 'PUT', {
        key: 'returns.policyConfig',
        value: JSON.stringify(form),
      });
      toast(isAr ? 'تم حفظ سياسات الإرجاع والاستبدال بنجاح' : 'Return & exchange policies saved successfully', 'success');
      router.refresh();
    } catch {
      toast(isAr ? 'فشل حفظ الإعدادات' : 'Failed to save policies', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100">
                {L('شروط وضوابط الإرجاع والاستبدال', 'Return & Exchange Terms & Rules')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {L('تُطبَّق هذه القواعد آلياً على فواتير الكاشير وطلبات المتجر الإلكتروني', 'These rules apply automatically to POS cashier sales and online returns')}
              </p>
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="w-4 h-4 me-1.5" />
            {saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ السياسات', 'Save policies')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              {L('فترة الإرجاع النقدي المسموح بها (أيام)', 'Cash return window (days)')}
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={form.windowDays}
              onChange={(e) => setForm({ ...form, windowDays: Number(e.target.value) || 14 })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              {L('الحد الأقصى القانوني وفق حماية المستهلك هو 14 يوماً للسلع غير المعيبة', 'Legal standard is 14 days for non-defective goods')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              {L('فترة الاستبدال المسموح بها (أيام)', 'Exchange window (days)')}
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={form.exchangeWindowDays}
              onChange={(e) => setForm({ ...form, exchangeWindowDays: Number(e.target.value) || 30 })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              {L('الفترة المسموح بها لاستبدال المقاس أو الموديل (مثلاً 30 يوماً)', 'Period allowed for size or item exchange (e.g. 30 days)')}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              {L('سقف الاسترداد بدون موافقة مدير الفرع', 'Manager approval threshold')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="50"
                value={form.managerApprovalThreshold}
                onChange={(e) => setForm({ ...form, managerApprovalThreshold: Number(e.target.value) || 500 })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                {currencyLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {L('أي مرتجع نقدي يتجاوز هذا المبلغ يتطلب موافقة مدير الفرع عبر PIN', 'Refunds above this amount require manager PIN confirmation')}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-300 block">
              {L('الاشتراطات الإلزامية للمرتجع', 'Mandatory return requirements')}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requireReceipt}
                  onChange={(e) => setForm({ ...form, requireReceipt: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
                />
                <span>{L('اشتراط وجود أصل فاتورة الشراء أو إشعار الطلب الإلكتروني', 'Require original invoice / digital receipt')}</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requireTags}
                  onChange={(e) => setForm({ ...form, requireTags: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
                />
                <span>{L('اشتراط سلامة التيكت الأصلي والغلاف وعدم الاستعمال', 'Require original tags, packaging, and unworn condition')}</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowStoreCredit}
                  onChange={(e) => setForm({ ...form, allowStoreCredit: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0"
                />
                <span>{L('إتاحة خيار الرصيد بالمحفظة (Store Credit) كبديل نقدي فوري', 'Allow instant Store Credit / Wallet as refund option')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Policy Notice Text */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <h3 className="text-xs font-bold text-slate-200">
            {L('نص سياسة الإرجاع المطبوع أسفل الفواتير والمعروض بالمتجر', 'Printed policy text on receipts & storefront')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{L('النص العربي', 'Arabic text')}</label>
              <textarea
                rows={4}
                value={form.policyTextAr}
                onChange={(e) => setForm({ ...form, policyTextAr: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{L('النص الإنجليزي', 'English text')}</label>
              <textarea
                rows={4}
                dir="ltr"
                value={form.policyTextEn}
                onChange={(e) => setForm({ ...form, policyTextEn: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
