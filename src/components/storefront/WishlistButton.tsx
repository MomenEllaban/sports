'use client';

import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

const KEY = 'sc:wishlist';
const EVENT = 'sc:wishlist-changed';

function notify() {
  window.dispatchEvent(new CustomEvent(EVENT));
  window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
}

export function getWishlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY); const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0))].slice(0, 500) : [];
  } catch { return []; }
}

export function setGuestWishlist(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].slice(0, 500))); } catch { /* storage unavailable */ }
  notify();
}

export function clearGuestWishlist() { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } notify(); }

async function accountIds(): Promise<string[] | null> {
  try {
    const response = await fetch('/api/account/wishlist', { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json() as { productIds?: unknown };
    return Array.isArray(data.productIds) ? data.productIds.filter((id): id is string => typeof id === 'string') : [];
  } catch { return null; }
}

export async function toggleWishlist(productId: string): Promise<boolean> {
  const remote = await accountIds();
  if (remote !== null) {
    const active = remote.includes(productId);
    const response = await fetch('/api/account/wishlist', { method: active ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) });
    if (!response.ok) throw new Error('Wishlist update failed');
    notify(); return !active;
  }
  const list = getWishlist(); const active = list.includes(productId); setGuestWishlist(active ? list.filter((id) => id !== productId) : [...list, productId]); return !active;
}

export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const [active, setActive] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    accountIds().then((remote) => { if (alive) setActive((remote ?? getWishlist()).includes(productId)); });
    const onChange = () => { accountIds().then((remote) => { if (alive) setActive((remote ?? getWishlist()).includes(productId)); }); };
    window.addEventListener(EVENT, onChange); window.addEventListener('storage', onChange);
    return () => { alive = false; window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', onChange); };
  }, [productId]);
  return <button type="button" disabled={busy} onClick={async (event) => { event.preventDefault(); event.stopPropagation(); setBusy(true); try { setActive(await toggleWishlist(productId)); } finally { setBusy(false); } }} aria-label={active ? `إزالة ${productName} من الأمنيات` : `إضافة ${productName} للأمنيات`} aria-pressed={active} aria-busy={busy} title={active ? 'في الأمنيات' : 'أضف للأمنيات'} className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-colors ${active ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-rose-300'}`}><Heart className={`w-4 h-4 ${active ? 'fill-rose-400' : ''}`} /></button>;
}

export function useWishlistCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const update = () => { accountIds().then((remote) => { if (alive) setCount((remote ?? getWishlist()).length); }); };
    update(); window.addEventListener(EVENT, update); window.addEventListener('storage', update);
    return () => { alive = false; window.removeEventListener(EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return count;
}
