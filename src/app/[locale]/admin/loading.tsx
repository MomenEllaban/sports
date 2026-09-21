import React from 'react';

/**
 * Instant skeleton for admin route transitions. The persistent admin shell
 * (sidebar + header) stays put; only this content area is replaced.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">جارٍ تحميل لوحة التحكم…</span>

      {/* Page title */}
      <div className="flex items-center justify-between gap-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-56 max-w-[60vw] rounded-xl bg-slate-800" />
          <div className="h-3 w-80 max-w-[70vw] rounded-full bg-slate-800/70" />
        </div>
        <div className="h-7 w-24 rounded-full bg-blue-500/20" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-3 animate-pulse"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 rounded-full bg-slate-800/80" />
              <div className="h-4 w-4 rounded bg-slate-800" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-slate-800" />
            <div className="h-3 w-24 rounded-full bg-slate-800/60" />
          </div>
        ))}
      </div>

      {/* Content panels */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 glass-panel rounded-3xl border border-slate-800 p-6 space-y-4 animate-pulse">
          <div className="h-4 w-40 rounded-full bg-slate-800" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded-xl bg-slate-800/60" />
          ))}
        </div>
        <div className="lg:col-span-4 glass-panel rounded-3xl border border-slate-800 p-6 space-y-4 animate-pulse">
          <div className="h-4 w-32 rounded-full bg-slate-800" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-2xl bg-slate-800/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
