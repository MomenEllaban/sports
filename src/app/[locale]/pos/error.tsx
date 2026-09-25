'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/foundation';

export default function PosError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  return (
    <main role="alert" className="flex min-h-[60dvh] items-center justify-center p-6">
      <div className="glass-panel w-full max-w-md space-y-4 rounded-3xl border border-rose-500/30 p-8 text-center">
        <h1 className="text-xl font-black text-slate-100">{isAr ? 'تعذر تشغيل شاشة POS' : 'POS could not load'}</h1>
        <p className="text-xs text-slate-400">{isAr ? 'أغلق أي نافذة مفتوحة ثم أعد المحاولة.' : 'Close any open window and try again.'}</p>
        <Button type="button" onClick={reset} variant="primary">{isAr ? 'إعادة المحاولة' : 'Retry'}</Button>
      </div>
    </main>
  );
}
