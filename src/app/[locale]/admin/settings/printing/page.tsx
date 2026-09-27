import React from 'react';
import { getLocale } from 'next-intl/server';
import SettingsManager from '@/components/admin/SettingsManager';
import { prisma } from '@/lib/db';
import { parseStored } from '@/lib/settings-registry';
import { Printer } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPrintingPage() {
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
          <Printer className="w-6 h-6 text-purple-400" />
          {L('إعدادات الطباعة وتصميم الإيصالات (Thermal Printing)', 'Thermal Receipt & Printing Setup')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'تخصيص ترويسة وتذييل فواتير الكاشير، مقاس الورق الحراري (80mm / 58mm)، ورسائل الشكر الترويجية.',
            'Customize thermal POS receipt headers, footers, QR layout, and promotional receipt messages.'
          )}
        </p>
      </div>

      <div className="animate-fade-up">
        <SettingsManager initial={initial} activeSection="printing" />
      </div>
    </>
  );
}
