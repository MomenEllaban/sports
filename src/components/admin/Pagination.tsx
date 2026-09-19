'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from 'next-intl';

function pageWindow(page: number, total: number, width = 2): (number | '…')[] {
  const pages = new Set<number>([1, total]);
  for (let i = Math.max(1, page - width); i <= Math.min(total, page + width); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  const isRtl = locale === 'ar';

  if (totalPages <= 1) return null;

  const btn =
    'flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-700 px-2 text-xs font-bold transition-colors';

  return (
    <nav aria-label={ariaLabel || 'Pagination'} className="pt-4">
      <div className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          aria-disabled={page <= 1}
          className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ChevronRight className={`h-4 w-4 ${isRtl ? 'rtl-flip' : ''}`} />
        </button>

        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-slate-500">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${
                p === page
                  ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          aria-disabled={page >= totalPages}
          className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ChevronLeft className={`h-4 w-4 ${isRtl ? 'rtl-flip' : ''}`} />
        </button>
      </div>
    </nav>
  );
}