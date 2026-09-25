'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from '@/i18n/routing';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import AdminBreadcrumbs from './AdminBreadcrumbs';

/**
 * Persistent admin shell (app-shell pattern):
 * - The window never scrolls; the sidebar and content are independent scroll areas.
 * - On small screens the sidebar becomes a focusable drawer instead of stealing width.
 * - The shell, breadcrumb, and command palette remain mounted across route changes.
 */
export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith('/admin/login')) return;
    const previous = document.body.dataset.appShell;
    document.body.dataset.appShell = 'admin';
    return () => {
      if (previous) document.body.dataset.appShell = previous;
      else delete document.body.dataset.appShell;
    };
  }, [pathname]);

  if (pathname?.startsWith('/admin/login')) return <>{children}</>;

  return (
    <div className="admin-shell flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-slate-950 text-slate-100">
      <AdminSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminHeader onMenuClick={() => setMobileNavOpen(true)} />
        <main
          ref={mainRef}
          data-scroll-region="admin-main"
          className="app-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:space-y-6 sm:p-6"
        >
          <AdminBreadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
