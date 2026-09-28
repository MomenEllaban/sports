import React from 'react';
import { getLocale } from 'next-intl/server';
import { Clock, MapPin, ShieldCheck, Truck } from 'lucide-react';
import HeroCarousel from '@/components/storefront/HeroCarousel';
import { readHeroBanners } from '@/lib/website/cms';

/**
 * Storefront hero. Content comes from the CMS (`cms.heroBanners`), so what an
 * admin saves on /admin/website/content is what visitors see. This component
 * used to hardcode the whole hero, which is why the CMS editor appeared to do
 * nothing.
 */
export default async function HeroBanner() {
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const banners = await readHeroBanners(isAr ? 'ar' : 'en');

  const trust = [
    { icon: Truck, tint: 'text-blue-400', label: L('توصيل سريع لكل الإسكندرية', 'Fast delivery across Alexandria') },
    { icon: ShieldCheck, tint: 'text-emerald-400', label: L('منتجات أصلية 100%', '100% original products') },
    { icon: Clock, tint: 'text-amber-400', label: L('فواتير وإيصالات معتمدة', 'Approved invoices & receipts') },
    { icon: MapPin, tint: 'text-cyan-400', label: L('استلام من الفرع بدون رسوم', 'Free in-store pickup') },
  ];

  return (
    <>
      <HeroCarousel banners={banners} />

      {/* Value strip. Sits directly under the hero so the guarantees read as
          part of the offer rather than as an unrelated block further down. */}
      <section className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
          {trust.map(({ icon: Icon, tint, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-300">
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${tint}`} />
              <span className="leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
