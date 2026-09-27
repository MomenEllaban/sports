import React from 'react';
import { getLocale } from 'next-intl/server';
import SettingsManager from '@/components/admin/SettingsManager';
import { prisma } from '@/lib/db';
import { parseStored } from '@/lib/settings-registry';
import { CreditCard } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPaymentsPage() {
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
          <CreditCard className="w-6 h-6 text-blue-400" />
          {L('إعدادات بوابات وطرق الدفع (Payments)', 'Payment Methods & Gateways')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'تفعيل وتعطيل قنوات الدفع (كاش، فيزا/ماستركارد، إنستاباي InstaPay، فودافون كاش، باي موب Paymob، فوري Fawry).',
            'Enable and configure payment channels including Cash, Cards, InstaPay, Mobile Wallets, and Payment Gateways.'
          )}
        </p>
      </div>

      <div className="animate-fade-up">
        <SettingsManager initial={initial} activeSection="payments" />
      </div>
    </>
  );
}
