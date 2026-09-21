import React from 'react';
import WishlistClient from './WishlistClient';

export const dynamic = 'force-dynamic';

export default function WishlistPage() {
  return (
    <main className="flex-1 max-w-6xl mx-auto px-4 py-8 space-y-6 w-full">
      <h1 className="text-2xl font-black">قائمة الأمنيات</h1>
      <WishlistClient />
    </main>
  );
}
