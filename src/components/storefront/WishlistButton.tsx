'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useWishlist } from './StorefrontSessionProvider';

export { clearGuestWishlist, getWishlist, setGuestWishlist } from './StorefrontSessionProvider';

export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const { wishlist, toggle } = useWishlist();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const active = wishlist.includes(productId);

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(productId);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر تحديث قائمة الأمنيات', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleToggle}
      aria-label={active ? `إزالة ${productName} من الأمنيات` : `إضافة ${productName} للأمنيات`}
      aria-pressed={active}
      aria-busy={busy}
      title={active ? 'في الأمنيات' : 'أضف للأمنيات'}
      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border p-2.5 transition-colors ${active ? 'border-rose-500/50 bg-rose-500/20 text-rose-400' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-rose-300'}`}
    >
      <Heart className={`h-4 w-4 ${active ? 'fill-rose-400' : ''}`} aria-hidden="true" />
    </button>
  );
}

export function useWishlistCount(): number {
  return useWishlist().wishlist.length;
}
