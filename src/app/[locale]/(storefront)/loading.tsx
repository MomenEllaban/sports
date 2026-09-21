import React from 'react';

/**
 * Instant route-level skeleton for storefront navigations.
 * Rendered inside the persistent storefront layout, so only the content
 * area is replaced while the header/footer stay interactive.
 */
export default function StorefrontLoading() {
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 space-y-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">جارٍ تحميل الصفحة…</span>

      {/* Page title block */}
      <div className="space-y-3 animate-pulse">
        <div className="h-3 w-32 rounded-full bg-slate-800/80" />
        <div className="h-8 w-2/3 max-w-md rounded-xl bg-slate-800" />
      </div>

      {/* Filter / toolbar row */}
      <div className="flex flex-wrap items-center gap-3 animate-pulse">
        <div className="h-9 w-28 rounded-xl bg-slate-800/80" />
        <div className="h-9 w-28 rounded-xl bg-slate-800/80" />
        <div className="h-9 w-28 rounded-xl bg-slate-800/80" />
        <div className="ms-auto h-10 w-full sm:w-72 rounded-xl bg-slate-800/70" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="glass-panel rounded-3xl border border-slate-800 p-4 space-y-4 animate-pulse"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="aspect-square w-full rounded-2xl bg-slate-800/70" />
            <div className="h-3.5 w-3/4 rounded-full bg-slate-800" />
            <div className="h-3 w-1/2 rounded-full bg-slate-800/70" />
            <div className="h-6 w-1/3 rounded-lg bg-amber-500/20" />
          </div>
        ))}
      </div>
    </main>
  );
}
