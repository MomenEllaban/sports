'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Pagination } from '@/components/ui/foundation';
import { TABLE_PAGE_SIZE } from '@/lib/table-paging';

export { TABLE_PAGE_SIZE };

/** Clamp an out-of-range page to the last real one. */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

/**
 * Client-side paging for a table that already holds its whole row set.
 *
 * The slice is derived from the clamped page, so filtering down to fewer rows
 * while on page 4 renders the last real page immediately instead of flashing
 * an empty table. The stored page catches up in the effect afterwards.
 */
export function useTablePage<T>(rows: T[], pageSize: number = TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = clampPage(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const paged = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );

  return { page: safePage, totalPages, paged, setPage, total: rows.length, pageSize };
}

/**
 * The pager every table shows under its rows: a range summary plus the page
 * buttons. The summary is the part that was missing before, and it is what
 * tells a user whether the table is genuinely paginating or simply short.
 */
export function TablePager({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  ariaLabel,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (p: number) => void;
  ariaLabel?: string;
}) {
  const locale = useLocale();
  const isAr = locale === 'ar';

  const size = pageSize ?? TABLE_PAGE_SIZE;
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
      <span className="text-[11px] font-bold text-slate-400" aria-live="polite">
        {total === 0
          ? isAr
            ? 'لا توجد صفوف'
            : 'No rows'
          : isAr
            ? `عرض ${from}–${to} من ${total}`
            : `Showing ${from}–${to} of ${total}`}
      </span>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        ariaLabel={ariaLabel ?? (isAr ? 'ترقيم الصفحات' : 'Pagination')}
      />
    </div>
  );
}
