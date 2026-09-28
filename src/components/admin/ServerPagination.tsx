import Link from 'next/link';

/**
 * Server-rendered pager.
 *
 * `Pagination` in the UI foundation takes an `onPageChange` callback, so it can
 * only be used from a client component. A page that paginates in the database has
 * no client component to hang that callback on, so it needs real links. The
 * styling matches the client pager so the two do not look different.
 */
function pageWindow(page: number, total: number, width = 2): Array<number | '…'> {
  const pages = new Set<number>([1, total]);
  for (let i = Math.max(1, page - width); i <= Math.min(total, page + width); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function ServerPagination({
  page,
  totalPages,
  hrefFor,
  ariaLabel,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  ariaLabel?: string;
}) {
  if (totalPages <= 1) return null;

  const btn =
    'flex h-10 min-w-10 items-center justify-center rounded-control border border-slate-700 px-2 text-xs font-bold transition-colors';

  return (
    <nav aria-label={ariaLabel || 'Pagination'} className="pt-4">
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label="Previous page" className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100`}>
            ‹
          </Link>
        ) : (
          <span aria-hidden="true" className={`${btn} text-slate-300 opacity-40`}>‹</span>
        )}

        {pageWindow(page, totalPages).map((entry, i) =>
          entry === '…' ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-slate-600">…</span>
          ) : entry === page ? (
            <span key={entry} aria-current="page" className={`${btn} border-blue-500 bg-blue-500/15 text-blue-200`}>
              {entry}
            </span>
          ) : (
            <Link key={entry} href={hrefFor(entry)} className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100`}>
              {entry}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label="Next page" className={`${btn} text-slate-300 hover:bg-slate-800 hover:text-slate-100`}>
            ›
          </Link>
        ) : (
          <span aria-hidden="true" className={`${btn} text-slate-300 opacity-40`}>›</span>
        )}
      </div>
    </nav>
  );
}
