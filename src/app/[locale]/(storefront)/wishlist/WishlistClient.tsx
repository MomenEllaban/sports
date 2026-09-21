'use client';

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getWishlist } from '@/components/storefront/WishlistButton';
import { SafeImage } from '@/components/ui/foundation';
import { EmptyState } from '@/components/ui/foundation';

interface Item {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  price: number;
  images: string[];
}

/** Guest wishlist page (T08): resolves saved IDs to live products. */
export default function WishlistClient() {
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const list = getWishlist();
    setIds(list);
    if (list.length === 0) {
      setLoading(false);
      return;
    }
    fetch(`/api/products/by-ids?ids=${encodeURIComponent(list.slice(0, 50).join(','))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setItems(d.products);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-10 text-center text-xs text-slate-500">جاري التحميل...</p>;
  if (ids.length === 0) {
    return <EmptyState title="قائمة الأمنيات فارغة" hint="اضغط على القلب في أي منتج لحفظه هنا." actionLabel="تصفح الكتالوج" onAction={() => (window.location.href = '/catalog')} />;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((p) => (
        <Link key={p.id} href={`/catalog/${p.id}`} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 hover:border-rose-500/40">
          <span className="relative block aspect-square rounded-xl overflow-hidden bg-slate-950">
            <SafeImage src={p.images[0] || '/placeholder-product.svg'} alt={p.nameAr} fill sizes="300px" className="object-cover" />
          </span>
          <span className="block font-bold text-xs line-clamp-1">{p.nameAr}</span>
          <span className="flex items-center gap-1 text-xs font-black text-amber-400">
            <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
            {p.price.toLocaleString()} ج.م
          </span>
        </Link>
      ))}
    </div>
  );
}
