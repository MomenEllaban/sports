'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useWishlist } from '@/components/storefront/StorefrontSessionProvider';
import { SafeImage, EmptyState, Button } from '@/components/ui/foundation';
import { useCartStore } from '@/store/cartStore';
import { useToast } from '@/components/Toast';
import { apiRequest } from '@/lib/client-api';
import { useLocale } from 'next-intl';

type Item = { id: string; sku: string; nameAr: string; nameEn: string; price: number; images: string[]; availableStock: number };

export default function WishlistClient() {
  const router = useRouter();
  const isAr = useLocale() === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);
  const { toast } = useToast();
  const { wishlist, wishlistLoading, wishlistError, toggle } = useWishlist();
  const addItem = useCartStore((state) => state.addItem);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (wishlistLoading) return;
    let cancelled = false;
    const loadProducts = async () => {
      setLoading(true);
      setError('');
      const ids = wishlist.slice(0, 50);
      if (ids.length === 0) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await apiRequest<{ products?: Item[] }>(`/api/products/by-ids?ids=${encodeURIComponent(ids.join(','))}`, {
          cache: 'no-store',
          errorKey: 'wishlist:products',
        });
        if (!cancelled) setItems(Array.isArray(data.products) ? data.products : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : L('تعذر تحميل المنتجات', 'Could not load products'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadProducts();
    return () => { cancelled = true; };
  }, [wishlist, wishlistLoading, L]);

  const remove = async (id: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(id);
    try {
      await toggle(id);
      setItems((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : L('تعذر الحذف', 'Could not remove item');
      setError(message);
      toast(message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const move = async (item: Item) => {
    if (item.availableStock <= 0 || busy) return;
    if (!await remove(item.id)) return;
    addItem({
      id: item.id,
      sku: item.sku,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      price: item.price,
      image: item.images[0] || '/placeholder-product.svg',
      availableStock: item.availableStock,
    });
    router.push('/cart');
  };

  if (loading || wishlistLoading) return <p className="py-10 text-center text-xs text-slate-500">{L('جاري التحميل...', 'Loading...')}</p>;
  if (!wishlist.length || !items.length) return <EmptyState title={L('قائمة الأمنيات فارغة', 'Your wishlist is empty')} hint={L('اضغط على القلب في أي منتج لحفظه هنا.', 'Tap the heart on any product to save it here.')} actionLabel={L('تصفح الكتالوج', 'Browse catalog')} onAction={() => router.push('/catalog')} />;

  return (
    <div className="space-y-4">
      {(error || wishlistError) && <p role="alert" className="status-danger rounded-xl border p-3 text-xs">{error || wishlistError}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article key={item.id} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <Link href={`/catalog/${item.id}`} className="relative block aspect-square overflow-hidden rounded-xl bg-slate-950">
              <SafeImage src={item.images[0] || '/placeholder-product.svg'} alt={isAr ? item.nameAr : item.nameEn} fill sizes="300px" className="object-cover" />
            </Link>
            <Link href={`/catalog/${item.id}`} className="block truncate text-xs font-bold hover:text-blue-300">{isAr ? item.nameAr : item.nameEn}</Link>
            <span className="flex items-center gap-1 text-xs font-black text-amber-400"><Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />{item.price.toLocaleString()} {L('ج.م', 'EGP')}</span>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void move(item)} disabled={item.availableStock <= 0 || busy === item.id} className="flex-1 min-h-[44px] px-2 text-[10px]">
                <ShoppingCart className="h-3.5 w-3.5" />{L('نقل للسلة', 'Move to cart')}
              </Button>
              <button type="button" onClick={() => void remove(item.id)} disabled={busy === item.id} aria-label={`${L('حذف', 'Remove')} ${isAr ? item.nameAr : item.nameEn}`} className="min-h-[44px] min-w-[44px] rounded-xl border border-rose-500/30 text-rose-300">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
