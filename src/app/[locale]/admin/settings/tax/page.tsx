import React from 'react';
import { getLocale } from 'next-intl/server';
import SettingsManager from '@/components/admin/SettingsManager';
import { prisma } from '@/lib/db';
import { parseStored } from '@/lib/settings-registry';
import { Calculator } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsTaxPage() {
  await requirePageRole('SUPER_ADMIN');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const rows = await prisma.setting.findMany();
  const initial: Record<string, unknown> = {};
  for (const r of rows) {
    const { value } = parseStored(r.value, null);
    initial[r.key] = value;
  }

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Calculator className="w-6 h-6 text-emerald-400" />
          {L('إعدادات الضرائب وضريبة القيمة المضافة', 'VAT & Tax Authority Settings')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'تحديد نسبة ضريبة الجدول والقيمة المضافة (14%)، رقم التسجيل الضريبي، وبيانات الربط مع منظومة الفاتورة الإلكترونية ETA.',
            'Configure VAT rates (14%), tax registration numbers, and ETA e-invoicing API integration credentials.'
          )}
        </p>
      </div>

      <div className="animate-fade-up">
        <SettingsManager initial={initial} activeSection="tax" />
      </div>
    </>
  );
}
