'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowLeft, Construction, Database, ShieldCheck } from 'lucide-react';

type EmptyIcon = 'construction' | 'database' | 'shield';

const icons = {
  construction: Construction,
  database: Database,
  shield: ShieldCheck,
} as const;

export default function AdminEmptyState({
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  actionHref,
  actionLabelAr = 'العودة للوحة التحكم',
  actionLabelEn = 'Back to dashboard',
  status = 'قريبًا',
  icon = 'construction',
}: {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  actionHref?: string;
  actionLabelAr?: string;
  actionLabelEn?: string;
  status?: string;
  icon?: EmptyIcon;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const Icon = icons[icon];
  const displayTitle = isAr ? titleAr : titleEn;
  const displayDescription = isAr ? descriptionAr : descriptionEn;
  const displayAction = isAr ? actionLabelAr : actionLabelEn;
  return (
    <section className="glass-panel flex min-h-[22rem] flex-col items-center justify-center rounded-3xl border border-slate-800 p-6 text-center sm:p-10" aria-labelledby="empty-state-title">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
        <Icon className="h-8 w-8" aria-hidden="true" />
      </div>
      <span className="mb-3 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">{status}</span>
      <h1 id="empty-state-title" className="text-xl font-black text-slate-100 sm:text-2xl">{displayTitle}</h1>
      <p className="mt-2 max-w-xl text-sm leading-7 text-slate-400">{displayDescription}</p>
      {actionHref && (
        <Link href={actionHref} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500">
          <ArrowLeft className="h-4 w-4 rtl-flip" aria-hidden="true" />
          <span>{displayAction}</span>
        </Link>
      )}
      <p className="mt-6 text-xs text-slate-600" dir="ltr">{actionHref ? `${actionLabelEn} · ` : ''}{titleEn} — {descriptionEn}</p>
    </section>
  );
}
