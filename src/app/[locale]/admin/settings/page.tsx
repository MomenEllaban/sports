import React from 'react';
import { getLocale } from 'next-intl/server';
import SettingsManager from '@/components/admin/SettingsManager';
import { prisma } from '@/lib/db';
import { parseStored } from '@/lib/settings-registry';
import { Settings } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requirePageRole('SUPER_ADMIN');
  const isAr = (await getLocale()) === 'ar';
  const rows = await prisma.setting.findMany();
  const initial: Record<string, unknown> = {};
  for (const r of rows) {
    const { value } = parseStored(r.value, null);
    initial[r.key] = value;
  }
  const branchCount = await prisma.branch.count();

  return (
    <>
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <Settings className="w-6 h-6 text-slate-400" />
                {isAr ? 'إعدادات النظام والفروع والضرائب' : 'System, branch & tax settings'}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr ? 'كل القيم هنا هي المصدر الوحيد المعتمد — تُقرأ مباشرة من البيع والشحن والفواتير' : 'These values are the single source of truth for sales, shipping, and invoices'}
              </p>
            </div>
            <Link
              href="/admin/branches"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs"
            >
              {isAr ? 'إدارة الفروع' : 'Manage branches'} ({branchCount})
            </Link>
          </div>

          <div className="animate-fade-up">
            <SettingsManager initial={initial} />
          </div>
        </>
  );
}
