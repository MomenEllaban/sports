'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingCart, MessageCircle, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { Link } from '@/i18n/routing';
import { SafeImage, Button } from '@/components/ui/foundation';
import { WishlistButton } from './WishlistButton';

export interface ProductWithInventory {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  price: number;
  isFeatured: boolean;
  images: string[];
  category: { nameAr: string; nameEn: string };
  inventories: Array<{
    branch: { name: string; nameEn: string };
    stockQuantity: number;
  }>;
}

// Official store WhatsApp (matches store.whatsapp setting default 01224226876).
export const STORE_WHATSAPP_INTL = '201224226876';

export default function ProductCard({
  product,
  whatsappNumber = STORE_WHATSAPP_INTL,
}: {
  product: ProductWithInventory;
  whatsappNumber?: string;
}) {
  const locale = useLocale();
  const tStore = useTranslations('storefront');
  const tCommon = useTranslations('common');
  const addItem = useCartStore((s) => s.addItem);

  const isAr = locale === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const name = isAr ? product.nameAr : product.nameEn;
  const categoryName = isAr ? product.category.nameAr : product.category.nameEn;

  // Stock from Flagship branch (Al Ibrahimeyah)
  const flagshipInventory = product.inventories?.find((inventory) => /ibrah|ابراهيم|الإبراهيمية/i.test(`${inventory.branch.name} ${inventory.branch.nameEn}`));
  const ibrahimeyahStock = flagshipInventory?.stockQuantity || 0;
  const inStock = ibrahimeyahStock > 0;

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      sku: product.sku,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      price: product.price,
      image: product.images[0] || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
      availableStock: ibrahimeyahStock,
    });
  };

  const whatsappMessage = encodeURIComponent(
    isAr
      ? `مرحباً "ابطال الرياضة الإبراهيمية"، يرغب العميل في طلب:\n- المنتج: ${product.nameAr} (${product.sku})\n- السعر: ${product.price} ج.م`
      : `Hello "Sports Champions Alexandria", the customer would like to order:\n- Product: ${product.nameEn} (${product.sku})\n- Price: ${product.price} EGP`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-line flex flex-col justify-between group hover:border-blue-500/40 hover:-translate-y-1.5 transition-all duration-300 shadow-sm">
      {/* Top Image Container */}
      <div className="relative aspect-square w-full bg-surface overflow-hidden block">
        <Link href={`/catalog/${product.id}`} className="absolute inset-0 block">
          <SafeImage
            src={product.images[0] || '/placeholder-product.svg'}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        </Link>

        {/* Category & Featured Badge */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-surface/90 backdrop-blur-md text-[11px] font-bold text-ink border border-line shadow-sm">
            {categoryName}
          </span>
          <span className="flex items-center gap-1.5 pointer-events-auto">
            <WishlistButton productId={product.id} productName={name} />
            {product.isFeatured && (
              <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-[10px] font-black uppercase shadow-md shadow-amber-500/20">
                {L('مميز', 'Featured')}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Content Details */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Per-Branch Live Stock Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            {inStock ? (
              <span className="text-emerald-500 flex items-center gap-1.5 font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {L(`متوفر بفرع الإبراهيمية (${ibrahimeyahStock} قطعة)`, `Available at Ibrahimeyah branch (${ibrahimeyahStock} units)`)}
              </span>
            ) : (
              <span className="text-rose-500 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {L('غير متوفر حالياً', 'Currently unavailable')}
              </span>
            )}
          </div>

          <Link
            href={`/catalog/${product.id}`}
            className="inline-flex min-h-[44px] items-center font-bold text-ink text-base line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors hover:underline"
          >
            {name}
          </Link>
          <p className="text-xs text-ink-muted line-clamp-2">
            {isAr ? product.descriptionAr : product.descriptionEn}
          </p>
        </div>

        {/* Pricing & Actions */}
        <div className="space-y-3 pt-3 border-t border-line">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-ink">
                {product.price.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-amber-500 ml-1">
                {tCommon('currency')}
              </span>
            </div>
            <span className="text-[10px] text-ink-muted">{L('شامل ضريبة 14%', 'Includes 14% VAT')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleAddToCart}
              disabled={!inStock}
              variant="primary"
              className="shimmer-hover font-bold text-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              {tStore('addToCart')}
            </Button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              {L('طلب واتساب', 'Order on WhatsApp')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
