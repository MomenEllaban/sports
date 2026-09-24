'use client';

import React, { useEffect, useState } from 'react';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { getWishlist, toggleWishlist } from '@/components/storefront/WishlistButton';
import { SafeImage, EmptyState, Button } from '@/components/ui/foundation';
import { useCartStore } from '@/store/cartStore';

type Item = { id: string; sku: string; nameAr: string; nameEn: string; price: number; images: string[]; availableStock: number };

export default function WishlistClient() {
  const router = useRouter(); const addItem = useCartStore((state) => state.addItem); const [ids, setIds] = useState<string[]>([]); const [items, setItems] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    let list: string[] = [];
    try { const response = await fetch('/api/account/wishlist', { cache: 'no-store' }); if (response.ok) { const data = await response.json() as { productIds?: string[] }; list = data.productIds || []; } else list = getWishlist(); } catch { list = getWishlist(); }
    setIds(list);
    if (!list.length) { setItems([]); setLoading(false); return; }
    try { const response = await fetch(`/api/products/by-ids?ids=${encodeURIComponent(list.slice(0, 50).join(','))}`); const data = await response.json(); if (data.success) setItems(data.products || []); } catch { setError('تعذر تحميل المنتجات'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const remove = async (id: string) => { setBusy(id); try { await toggleWishlist(id); setIds((current) => current.filter((item) => item !== id)); setItems((current) => current.filter((item) => item.id !== id)); } catch { setError('تعذر الحذف'); } finally { setBusy(''); } };
  const move = (item: Item) => { if (item.availableStock <= 0) return; addItem({ id: item.id, sku: item.sku, nameAr: item.nameAr, nameEn: item.nameEn, price: item.price, image: item.images[0] || '/placeholder-product.svg', availableStock: item.availableStock }); void remove(item.id); router.push('/cart'); };
  if (loading) return <p className="py-10 text-center text-xs text-slate-500">جاري التحميل...</p>;
  if (!ids.length || !items.length) return <EmptyState title="قائمة الأمنيات فارغة" hint="اضغط على القلب في أي منتج لحفظه هنا." actionLabel="تصفح الكتالوج" onAction={() => router.push('/catalog')} />;
  return <div className="space-y-4">{error && <p role="alert" className="status-danger rounded-xl border p-3 text-xs">{error}</p>}<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{items.map((item) => <article key={item.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-3 space-y-2"><Link href={`/catalog/${item.id}`} className="block relative aspect-square rounded-xl overflow-hidden bg-slate-950"><SafeImage src={item.images[0] || '/placeholder-product.svg'} alt={item.nameAr} fill sizes="300px" className="object-cover" /></Link><Link href={`/catalog/${item.id}`} className="block font-bold text-xs line-clamp-1 hover:text-blue-300">{item.nameAr}</Link><span className="flex items-center gap-1 text-xs font-black text-amber-400"><Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />{item.price.toLocaleString()} ج.م</span><div className="flex gap-2"><Button type="button" onClick={() => move(item)} disabled={item.availableStock <= 0 || busy === item.id} className="flex-1 min-h-[44px] px-2 text-[10px]"><ShoppingCart className="w-3.5 h-3.5" />نقل للسلة</Button><button type="button" onClick={() => remove(item.id)} disabled={busy === item.id} aria-label={`حذف ${item.nameAr}`} className="min-h-[44px] min-w-[44px] rounded-xl border border-rose-500/30 text-rose-300"><Trash2 className="w-4 h-4" /></button></div></article>)}</div></div>;
}
