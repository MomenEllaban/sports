'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { findAdminItemBySection, pathMatches } from '@/config/admin-navigation';

export default function AdminSectionTabs({ section, className = '' }: { section: string; className?: string }) {
  const pathname = usePathname() || '/admin';
  const locale = useLocale();
  const isAr = locale === 'ar';
  const entry = findAdminItemBySection(section);
  const tabs = entry?.item.tabs ?? [];

  const activeHref = tabs
    .filter((tab) => pathMatches(pathname, tab.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? tabs[0]?.href;

  if (!entry || tabs.length === 0) return null;

  return (
    <nav
      aria-label={section}
      className={`app-scrollbar app-scrollbar-horizontal mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 inline-flex min-h-10 items-center rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${
              active
                ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                : 'border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            {isAr ? tab.labelAr : tab.labelEn}
            {isAr && tab.labelEn !== tab.labelAr && (
              <span className="hidden text-[10px] font-normal opacity-60 sm:inline" dir="ltr">{tab.labelEn}</span>
            )}
            {!isAr && tab.labelAr !== tab.labelEn && (
              <span className="hidden text-[10px] font-normal opacity-60 sm:inline" dir="rtl">{tab.labelAr}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
