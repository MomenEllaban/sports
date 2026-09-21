'use client';

import React from 'react';
import { usePathname } from '@/i18n/routing';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

/**
 * Persistent admin shell. The sidebar and header stay mounted across admin
 * navigations (no re-mount, no notification refetch, no layout shift), while
 * route `loading.tsx` skeletons stream into the content area only.
 *
 * The login screen renders bare so it can stay a focused, full-screen card.
 */
export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
