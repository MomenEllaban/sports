'use client';

import React from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingCart, MessageCircle, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

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
  const name = isAr ? product.nameAr : product.nameEn;
  const categoryName = isAr ? product.category.nameAr : product.category.nameEn;

  // Stock from Flagship branch (Al Ibrahimeyah)
  const ibrahimeyahStock = product.inventories?.[0]?.stockQuantity || 0;
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
    `مرحباً "ابطال الرياضة الإبراهيمية"، يرغب العميل في طلب:\n- المنتج: ${product.nameAr} (${product.sku})\n- السعر: ${product.price} ج.م`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-between group">
      {/* Top Image Container */}
      <div className="relative aspect-square w-full bg-slate-900 overflow-hidden">
        <Image
          src={product.images[0] || 'https://res.cloudinary.com/djseokhow/image/upload/v1789820962/sports-champions/products/bmxe8ldv89v1lwf3vi4v.jpg'}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Category & Featured Badge */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-semibold text-slate-300 border border-slate-700">
            {categoryName}
          </span>
          {product.isFeatured && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-extrabold uppercase">
              مميز
            </span>
          )}
        </div>
      </div>

      {/* Content Details */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Per-Branch Live Stock Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            {inStock ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                متوفر بفرع الإبراهيمية ({ibrahimeyahStock} قطعة)
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                غير متوفر حالياً
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-100 text-base line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
            {name}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2">
            {isAr ? product.descriptionAr : product.descriptionEn}
          </p>
        </div>

        {/* Pricing & Actions */}
        <div className="space-y-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-slate-100">
                {product.price.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-amber-400 ml-1">
                {tCommon('currency')}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">شامل ضريبة 14%</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20"
            >
              <ShoppingCart className="w-4 h-4" />
              {tStore('addToCart')}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              طلب واتساب
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
