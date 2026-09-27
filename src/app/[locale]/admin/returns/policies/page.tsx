import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { parseStored } from '@/lib/settings-registry';
import ReturnPolicyManager from '@/components/admin/ReturnPolicyManager';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminReturnsPoliciesPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const policySetting = await prisma.setting.findUnique({
    where: { key: 'returns.policyConfig' },
  });

  const parsed = policySetting ? parseStored(policySetting.value, null).value : null;

  const initialConfig = {
    windowDays: 14,
    exchangeWindowDays: 30,
    requireReceipt: true,
    requireTags: true,
    managerApprovalThreshold: 500,
    allowStoreCredit: true,
    policyTextAr:
      'يحق للعميل استبدال أو استرجاع المنتجات خلال 14 يوماً من تاريخ الشراء بشرط وجود أصل الفاتورة وأن تكون المنتجات بحالتها الأصلية غير مستعملة مع كافة الملصقات والتغليف.',
    policyTextEn:
      'Customers may exchange or return items within 14 days of purchase with the original receipt, provided items are unworn with all tags and original packaging intact.',
    ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
  };

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-purple-400" />
          {L('سياسات وضوابط الإرجاع والاستبدال', 'Return & Exchange Policies')}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {L(
            'تحديد فترات الإرجاع، شروط القبول والرفض، سقف موافقة المدير، والنصوص القانونية المطبوعة على إيصالات البيع.',
            'Configure return windows, acceptance criteria, manager approval limits, and receipt disclaimers.'
          )}
        </p>
      </div>

      <div className="animate-fade-up">
        <ReturnPolicyManager initial={initialConfig} />
      </div>
    </>
  );
}
