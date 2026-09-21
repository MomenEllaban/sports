import React from 'react';
import Header from '@/components/storefront/Header';
import Footer from '@/components/storefront/Footer';

/**
 * Persistent storefront shell: the header and footer stay mounted while the
 * page content swaps, so client navigation no longer remounts the whole page
 * (cart state, scroll position and menu state survive route changes).
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <div className="flex-1 flex flex-col">{children}</div>
      <Footer />
    </div>
  );
}
