'use client';

import React, { useMemo } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { findAdminItemBySection, pathMatches } from '@/config/admin-navigation';

export default function AdminSectionTabs({ section, className = '' }: { section: string; className?: string }) {
  const pathname = usePathname() || '/admin';
  const entry = findAdminItemBySection(section);
  const tabs = entry?.item.tabs ?? [];

  const activeHref = useMemo(() => {
    const match = tabs.find((tab) => pathMatches(pathname, tab.href));
    return match?.href ?? tabs[0]?.href;
  }, [pathname, tabs]);

  if (!entry || tabs.length === 0) return null;

  return (
    <nav
      aria-label={section}
      className={`mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none ${className}`}
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
            {tab.labelAr}
            {tab.labelEn !== tab.labelAr && (
              <span className="hidden text-[10px] font-normal opacity-60 sm:inline">{tab.labelEn}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
