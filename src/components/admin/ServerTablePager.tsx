import ServerPagination from './ServerPagination';
import { TABLE_PAGE_SIZE } from '@/lib/table-paging';

/**
 * Server-rendered twin of `TablePager` for pages that paginate in the
 * database. Keeps the range summary + pager layout identical to the client
 * one so every admin table renders the same footer.
 */
export default function ServerTablePager({
  page,
  total,
  pageSize = TABLE_PAGE_SIZE,
  hrefFor,
  isAr,
  ariaLabel,
}: {
  page: number;
  total: number;
  pageSize?: number;
  hrefFor: (page: number) => string;
  isAr: boolean;
  ariaLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

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
      <ServerPagination
        page={page}
        totalPages={totalPages}
        hrefFor={hrefFor}
        ariaLabel={ariaLabel ?? (isAr ? 'ترقيم الصفحات' : 'Pagination')}
      />
    </div>
  );
}