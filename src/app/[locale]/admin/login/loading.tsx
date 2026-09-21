import React from 'react';

export default function AdminLoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <span className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-slate-400">جارٍ التحضير…</span>
      </div>
    </div>
  );
}
