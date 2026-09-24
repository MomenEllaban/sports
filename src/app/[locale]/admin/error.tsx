'use client';

import React from 'react';
import { useLocale } from 'next-intl';

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  void error;
  return (
    <div className="flex items-center justify-center py-16">
      <div className="glass-panel p-8 rounded-3xl border border-rose-500/30 max-w-md w-full text-center space-y-4 animate-fade-up">
        <h1 className="text-xl font-black">{isAr ? 'حدث خطأ في لوحة التحكم' : 'Dashboard error'}</h1>
        <p className="text-xs text-slate-400">{isAr ? 'تعذر تحميل هذه الصفحة. حاول مجدداً أو تواصل مع الدعم.' : 'Could not load this page. Try again.'}</p>
        <button onClick={reset} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all">
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    </div>
  );
}
