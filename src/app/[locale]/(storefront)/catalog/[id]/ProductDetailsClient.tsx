'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { ShoppingCart, MessageCircle, Ruler } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { STORE_WHATSAPP_INTL } from '@/components/storefront/ProductCard';
import { SafeImage, Button, NumberField } from '@/components/ui/foundation';
import { sizesOf, colorsOf, type VariantOption } from '@/lib/catalog/groups';

export interface SizeChart {
  titleAr: string;
  titleEn: string;
  columns: string[];
  rows: string[][];
}

export default function ProductDetailsClient({
  product,
  totalStock,
  variants,
  sizeChart,
}: {
  product: {
    id: string;
    sku: string;
    nameAr: string;
    nameEn: string;
    price: number;
    images: string[];
    size: string | null;
    color: string | null;
  };
  totalStock: number;
  variants: VariantOption[];
  sizeChart: SizeChart | null;
}) {
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [showChart, setShowChart] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const sizes = sizesOf(variants);
  const colors = colorsOf(variants);
  const hasVariants = variants.length > 1;

  const pick = (size: string | null, color: string | null) => {
    const v =
      variants.find((x) => (x.size || null) === (size || null) && (x.color || null) === (color || null)) ||
      (size ? variants.find((x) => x.size === size) : undefined) ||
      (color ? variants.find((x) => x.color === color) : undefined);
    if (v && v.id !== product.id) {
      setQty(1);
      setActiveImg(0);
      router.push(`/catalog/${v.id}`);
    }
  };

  const images = product.images.length > 0 ? product.images : ['/placeholder-product.svg'];

  const handleAdd = () => {
    addItem(
      {
        id: product.id,
        sku: product.sku,
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        price: product.price,
        image: images[0],
        availableStock: totalStock,
      },
      Math.min(qty, totalStock)
    );
    router.push('/cart');
  };

  const waMsg = encodeURIComponent(
    isAr
      ? `مرحباً "ابطال الرياضة"، أرغب في طلب:\n- المنتج: ${product.nameAr} (${product.sku})\n- الكمية: ${qty}\n- السعر: ${product.price} ج.م`
      : `Hello "Sports Champions", I would like to order:\n- Product: ${product.nameEn} (${product.sku})\n- Quantity: ${qty}\n- Price: ${product.price} EGP`
  );

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-3">
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
          <SafeImage
            src={images[Math.min(activeImg, images.length - 1)]}
            alt={isAr ? product.nameAr : product.nameEn}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        {images.length > 1 && (
          <div className="app-scrollbar app-scrollbar-horizontal flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                aria-label={`${L('صورة', 'Image')} ${i + 1}`}
                className={`relative w-20 h-20 min-h-[44px] rounded-xl overflow-hidden border-2 shrink-0 ${
                  i === activeImg ? 'border-blue-500' : 'border-slate-800'
                }`}
              >
                <SafeImage src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {hasVariants && (
          <div className="space-y-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            {sizes.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-300">{L('المقاس', 'Size')}:  <span className="text-amber-400">{product.size || '—'}</span></span>
                  {sizeChart && (
                    <button onClick={() => setShowChart(!showChart)} className="min-h-[44px] px-2 text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5" /> {L('جدول المقاسات', 'Size guide')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const v = variants.find((x) => x.size === s && (x.color || null) === (product.color || null)) || variants.find((x) => x.size === s);
                    const out = !v || v.stock <= 0;
                    return (
                      <button
                        key={s}
                        onClick={() => pick(s, product.color)}
                        disabled={out}
                        aria-label={`${L('مقاس', 'Size')} ${s}`}
                        className={`min-h-[44px] min-w-[44px] px-3 rounded-xl border text-xs font-black ${
                          product.size === s
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : out
                              ? 'bg-slate-950 border-slate-800 text-slate-600 line-through'
                              : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-blue-500'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {colors.length > 0 && (
              <div>
                <span className="block text-xs font-bold text-slate-300 mb-1.5">{L('اللون', 'Color')}:  <span className="text-amber-400">{product.color || '—'}</span></span>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => {
                    const v = variants.find((x) => x.color === c && (x.size || null) === (product.size || null)) || variants.find((x) => x.color === c);
                    const out = !v || v.stock <= 0;
                    return (
                      <button
                        key={c}
                        onClick={() => pick(product.size, c)}
                        disabled={out}
                        aria-label={`${L('لون', 'Color')} ${c}`}
                        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold ${
                          product.color === c
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : out
                              ? 'bg-slate-950 border-slate-800 text-slate-600 line-through'
                              : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-blue-500'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {showChart && sizeChart && (
              <div className="app-scrollbar app-scrollbar-horizontal overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-[11px] text-start">
                  <caption className="p-2 font-bold text-slate-200">{isAr ? sizeChart.titleAr : sizeChart.titleEn}</caption>
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>{sizeChart.columns.map((col) => <th key={col} className="p-2 whitespace-nowrap">{col}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sizeChart.rows.map((row: string[], i: number) => (
                      <tr key={i} className={product.size === row[0] ? 'bg-blue-600/10' : ''}>
                        {row.map((cell: string, j: number) => <td key={j} className="p-2">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor="qty" className="text-xs font-bold text-slate-400">
            {L('الكمية', 'Quantity')}:
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 font-bold"
              aria-label={L('إنقاص الكمية', 'Decrease quantity')}
            >
              −
            </button>
            <NumberField
              id="qty"
              min={1}
              max={Math.max(1, totalStock)}
              step={1}
              value={qty}
              onChange={setQty}
              inputClassName="w-16 text-center py-1.5"
            />
            <button
              onClick={() => setQty((q) => Math.min(totalStock || 1, q + 1))}
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 font-bold"
              aria-label={L('زيادة الكمية', 'Increase quantity')}
            >
              +
            </button>
          </div>
          <span className="text-[11px] text-slate-500">({L('المتاح', 'Available')}: {totalStock})</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleAdd}
            disabled={totalStock <= 0}
            variant="primary"
          >
            <ShoppingCart className="w-4 h-4" />
            {L('أضف للسلة', 'Add to cart')}
          </Button>
          <a
            href={`https://wa.me/${STORE_WHATSAPP_INTL}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            {L('طلب واتساب', 'Order on WhatsApp')}
          </a>
        </div>
      </div>
    </div>
  );
}
