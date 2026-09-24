'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/routing';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

/**
 * Persistent admin shell (app-shell pattern):
 * - The whole shell is `h-screen overflow-hidden`, so the window itself never
 *   scrolls. The sidebar and the content area are independent scroll containers:
 *   - sidebar keeps its scroll position while you navigate (no snap-to-top).
 *   - content resets to the top on every route change, so each page starts at
 *     its natural beginning.
 * - Sidebar + header stay mounted across navigations (no re-mount, no layout
 *   shift); route `loading.tsx` skeletons stream into the content only.
 *
 * The login screen renders bare so it stays a focused, full-screen card.
 */
export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Content scroll resets per navigation; the sidebar is untouched.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  if (pathname?.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AdminHeader />
        <main ref={mainRef} className="flex-1 min-h-0 p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}