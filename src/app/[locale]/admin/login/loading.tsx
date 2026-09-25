import React from 'react';
import { getLocale } from 'next-intl/server';

export default async function AdminLoginLoading() {
  const isAr = (await getLocale()) === 'ar';
  return (
    <div className="min-h-screen flex items-center justify-center p-4" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <span className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-slate-400">{isAr ? 'جارٍ التحضير…' : 'Preparing…'}</span>
      </div>
    </div>
  );
}
