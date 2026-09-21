'use client';

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

const KEY = 'sc:wishlist';

export function getWishlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function setWishlist(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('sc:wishlist-changed'));
}

/** Heart toggle for product cards + details (T08, guest-friendly). */
export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(getWishlist().includes(productId));
    const onChange = () => setActive(getWishlist().includes(productId));
    window.addEventListener('sc:wishlist-changed', onChange);
    return () => window.removeEventListener('sc:wishlist-changed', onChange);
  }, [productId]);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const list = getWishlist();
        setWishlist(list.includes(productId) ? list.filter((x) => x !== productId) : [...list, productId]);
      }}
      aria-label={active ? `إزالة ${productName} من الأمنيات` : `إضافة ${productName} للأمنيات`}
      aria-pressed={active}
      title={active ? 'في الأمنيات' : 'أضف للأمنيات'}
      className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-colors ${
        active ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-rose-300'
      }`}
    >
      <Heart className={`w-4 h-4 ${active ? 'fill-rose-400' : ''}`} />
    </button>
  );
}

/** Badge count for the storefront header. */
export function useWishlistCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(getWishlist().length);
    const onChange = () => setCount(getWishlist().length);
    window.addEventListener('sc:wishlist-changed', onChange);
    return () => window.removeEventListener('sc:wishlist-changed', onChange);
  }, []);
  return count;
}
