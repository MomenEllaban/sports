import React from 'react';
import AccountClient from './AccountClient';
import { isPortalEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const enabled = await isPortalEnabled().catch(() => true);

  return (
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 space-y-6 w-full">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl sm:text-3xl font-black">{isAr ? 'حسابي' : 'My account'}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'تابع طلباتك ونقاط الولاء وعناوين التوصيل' : 'Track orders, loyalty points and delivery addresses'}
          </p>
        </div>
        {enabled ? (
          <AccountClient />
        ) : (
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-center text-sm text-slate-400">
            {isAr ? 'بوابة العميل معطّلة حالياً — تابع طلبك من صفحة التتبع.' : 'Customer portal is disabled — use order tracking instead.'}
          </div>
        )}
      </main>
  );
}
