'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from '@/i18n/routing';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { STORE_WHATSAPP_INTL } from '@/components/storefront/ProductCard';

export default function ProductDetailsClient({
  product,
  totalStock,
}: {
  product: {
    id: string;
    sku: string;
    nameAr: string;
    nameEn: string;
    price: number;
    images: string[];
  };
  totalStock: number;
}) {
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const images =
    product.images.length > 0
      ? product.images
      : [
          'https://res.cloudinary.com/djseokhow/image/upload/v1789820962/sports-champions/products/bmxe8ldv89v1lwf3vi4v.jpg',
        ];

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
    `مرحباً "ابطال الرياضة"، أرغب في طلب:\n- المنتج: ${product.nameAr} (${product.sku})\n- الكمية: ${qty}\n- السعر: ${product.price} ج.م`
  );

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-3">
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
          <Image
            src={images[Math.min(activeImg, images.length - 1)]}
            alt={product.nameAr}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                aria-label={`صورة ${i + 1}`}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 ${
                  i === activeImg ? 'border-blue-500' : 'border-slate-800'
                }`}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <label htmlFor="qty" className="text-xs font-bold text-slate-400">
            الكمية:
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 font-bold"
              aria-label="إنقاص الكمية"
            >
              −
            </button>
            <input
              id="qty"
              type="number"
              min={1}
              max={Math.max(1, totalStock)}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.min(totalStock || 1, Number(e.target.value) || 1)))
              }
              className="w-16 text-center py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm font-bold"
            />
            <button
              onClick={() => setQty((q) => Math.min(totalStock || 1, q + 1))}
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 font-bold"
              aria-label="زيادة الكمية"
            >
              +
            </button>
          </div>
          <span className="text-[11px] text-slate-500">(المتاح: {totalStock})</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAdd}
            disabled={totalStock <= 0}
            className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            أضف للسلة
          </button>
          <a
            href={`https://wa.me/${STORE_WHATSAPP_INTL}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            طلب واتساب
          </a>
        </div>
      </div>
    </div>
  );
}
