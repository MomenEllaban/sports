'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/foundation';

export default function StorefrontError({ reset }: { reset: () => void }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  return (
    <div className="flex-1 flex items-center justify-center p-6 py-16">
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 max-w-md w-full text-center space-y-4 animate-fade-up">
        <h1 className="text-xl font-black">{isAr ? 'حدث خطأ أثناء تحميل الصفحة' : 'Something went wrong'}</h1>
        <p className="text-xs text-slate-400">{isAr ? 'حاول مجدداً أو عُد للرئيسية.' : 'Try again or go home.'}</p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset} variant="primary">
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </Button>
          <Link href="/" className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
        </div>
      </div>
    </div>
  );
}
