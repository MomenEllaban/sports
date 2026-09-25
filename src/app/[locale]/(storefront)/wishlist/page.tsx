import React from 'react';
import { getLocale } from 'next-intl/server';
import WishlistClient from './WishlistClient';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const isAr = (await getLocale()) === 'ar';
  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 py-8 space-y-6 w-full">
      <h1 className="text-2xl font-black">{isAr ? 'قائمة الأمنيات' : 'Wishlist'}</h1>
      <WishlistClient />
    </main>
  );
}
