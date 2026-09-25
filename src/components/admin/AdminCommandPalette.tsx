'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Search, X, Command, CornerDownLeft } from 'lucide-react';
import {
  getVisibleAdminGroups,
  type AdminRole,
  type AdminTab,
} from '@/config/admin-navigation';

interface PaletteEntry {
  key: string;
  href: string;
  label: string;
  group: string;
  description: string;
  status?: 'live' | 'partial' | 'planned';
}

export default function AdminCommandPalette() {
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const role = (session?.user as { role?: AdminRole } | undefined)?.role;
  const groups = useMemo(() => getVisibleAdminGroups(role), [role]);
  const entries = useMemo<PaletteEntry[]>(() => {
    const seen = new Set<string>();
    const result: PaletteEntry[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        const candidates = [item, ...(item.tabs ?? [])];
        for (const candidate of candidates) {
          const tab = candidate as typeof item | AdminTab;
          if (seen.has(tab.href)) continue;
          seen.add(tab.href);
          result.push({
            key: tab.href,
            href: tab.href,
            label: isAr ? (tab as typeof item).labelAr : (tab as typeof item).labelEn,
            group: isAr ? group.labelAr : group.labelEn,
            description: isAr ? (tab as typeof item).descriptionAr || (tab as typeof item).labelAr : (tab as typeof item).descriptionEn || (tab as typeof item).labelEn,
            status: item.status,
          });
        }
      }
    }
    return result;
  }, [groups, isAr]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => `${entry.label} ${entry.group} ${entry.description}`.toLocaleLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === '/' && !open) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          event.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filtered[activeIndex]) {
      event.preventDefault();
      go(filtered[activeIndex].href);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-xs font-bold text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 md:flex"
        aria-label={isAr ? 'فتح البحث السريع' : 'Open quick navigation'}
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isAr ? 'انتقال سريع' : 'Quick jump'}</span>
        <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">Ctrl K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/75 p-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={isAr ? 'البحث السريع' : 'Quick navigation'}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label={isAr ? 'إغلاق البحث' : 'Close search'} onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3 border-b border-slate-800 px-4">
          <Search className="h-5 w-5 shrink-0 text-blue-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={isAr ? 'ابحث عن صفحة أو قسم...' : 'Search pages and sections...'}
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            aria-label={isAr ? 'ابحث عن صفحة' : 'Search pages'}
          />
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label={isAr ? 'إغلاق' : 'Close'}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="app-scrollbar max-h-[min(55vh,26rem)] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">{isAr ? 'لا توجد نتائج مطابقة.' : 'No matching pages.'}</div>
          ) : (
            filtered.map((entry, index) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => go(entry.href)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors ${index === activeIndex ? 'bg-blue-500/15 text-blue-200' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400"><Command className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{entry.label}</span>
                  <span className="block truncate text-[11px] text-slate-500">{entry.group} · {entry.description}</span>
                  {entry.status && entry.status !== 'live' && <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${entry.status === 'partial' ? 'status-info' : 'status-warning'}`}>{entry.status === 'partial' ? (isAr ? 'جزئي' : 'Partial') : (isAr ? 'قريبًا' : 'Planned')}</span>}
                </span>
                {index === activeIndex && <CornerDownLeft className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
          <span>{isAr ? 'استخدم ↑ ↓ للتنقل و Enter للفتح' : 'Use ↑ ↓ to navigate and Enter to open'}</span>
          <span className="font-mono">Esc للإغلاق</span>
        </div>
      </div>
    </div>
  );
}
