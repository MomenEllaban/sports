import React from 'react';
import { getLocale } from 'next-intl/server';
import SettingsManager from '@/components/admin/SettingsManager';
import { prisma } from '@/lib/db';
import { parseStored } from '@/lib/settings-registry';
import { MapPin, Building2 } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsBranchesPage() {
  await requirePageRole('SUPER_ADMIN');
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [rows, branchCount] = await Promise.all([
    prisma.setting.findMany(),
    prisma.branch.count({ where: { isActive: true } }),
  ]);

  const initial: Record<string, unknown> = {};
  for (const r of rows) {
    const { value } = parseStored(r.value, null);
    initial[r.key] = value;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-400" />
            {L('إعدادات الفروع ومناطق الشحن', 'Branch Delivery & Shipping Zones')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {L(
              'تحديد مناطق التوصيل بالإسكندرية، رسوم كل حي، وربط الطلبات بفروع التغطية الجغرافية.',
              'Set Alexandria delivery zone pricing and branch fulfillment rules.'
            )}
          </p>
        </div>
        <Link
          href="/admin/branches"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs"
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          {L('إدارة مواقع الفروع', 'Branch Directory')} ({branchCount})
        </Link>
      </div>

      <div className="animate-fade-up">
        <SettingsManager initial={initial} activeSection="branches" />
      </div>
    </>
  );
}
