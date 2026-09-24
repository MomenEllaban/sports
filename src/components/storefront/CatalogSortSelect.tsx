'use client';

import React from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';

export default function CatalogSortSelect({ value, isAr }: { value: string; isAr: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  return <select aria-label={isAr ? 'ترتيب' : 'Sort'} value={value} onChange={(event) => { const next = new URLSearchParams(params.toString()); next.set('sort', event.target.value); next.delete('page'); router.push(`${pathname}?${next.toString()}`); }} className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 px-2 text-xs"><option value="newest">{isAr ? 'الأحدث' : 'Newest'}</option><option value="price_asc">{isAr ? 'السعر: الأقل' : 'Price: low'}</option><option value="price_desc">{isAr ? 'السعر: الأعلى' : 'Price: high'}</option><option value="name_asc">{isAr ? 'الاسم' : 'Name'}</option></select>;
}
