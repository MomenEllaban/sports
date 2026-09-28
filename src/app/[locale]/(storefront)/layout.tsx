import React from 'react';
import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';
import AnnouncementBar from '@/components/storefront/AnnouncementBar';
import StorefrontSessionProvider from '@/components/storefront/StorefrontSessionProvider';
import { readPortalSession } from '@/lib/account/session';
import { readAnnouncement } from '@/lib/website/cms';

/**
 * Persistent storefront shell: the header and footer stay mounted while the
 * page content swaps, so client navigation no longer remounts the whole page
 * (cart state, scroll position and menu state survive route changes).
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [portalSession, announcement] = await Promise.all([
    readPortalSession(),
    readAnnouncement(),
  ]);
  return (
    <StorefrontSessionProvider initialAuthenticated={Boolean(portalSession)}>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <AnnouncementBar announcement={announcement} />
        <Header />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
      </div>
    </StorefrontSessionProvider>
  );
}
