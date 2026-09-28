import React from 'react';
import { getLocale } from 'next-intl/server';
import { Zap, Award, RotateCcw, Store } from 'lucide-react';
import HeroCarousel from '@/components/storefront/HeroCarousel';
import { readHeroBanners } from '@/lib/website/cms';

/**
 * Storefront hero. Content comes from the CMS (`cms.heroBanners`), so what an
 * admin saves on /admin/website/content is what visitors see.
 */
export default async function HeroBanner() {
  const isAr = (await getLocale()) === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const banners = await readHeroBanners(isAr ? 'ar' : 'en');

  const trust = [
    {
      icon: Zap,
      accent: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30',
      tint: 'text-blue-400',
      label: L('توصيل سريع لكل الإسكندرية', 'Fast delivery across Alexandria'),
      sub: L('خلال 24-48 ساعة لباب منزلك', 'Within 24-48 hrs to your door'),
    },
    {
      icon: Award,
      accent: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30',
      tint: 'text-emerald-400',
      label: L('منتجات رياضية أصلية 100%', '100% authentic sports gear'),
      sub: L('ضمان معتمد وفواتير رسمية', 'Official warranty & genuine items'),
    },
    {
      icon: RotateCcw,
      accent: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
      tint: 'text-amber-400',
      label: L('استبدال واسترجاع مرن', 'Flexible returns & exchange'),
      sub: L('دعم فني وخدمة عملاء متخصصة', 'Expert advice & friendly support'),
    },
    {
      icon: Store,
      accent: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/30',
      tint: 'text-cyan-400',
      label: L('استلام من الفرع الرئيسي', 'Flagship store pickup'),
      sub: L('فرع الإبراهيمية بدون رسوم', 'Ibrahimeyah Branch — Free pickup'),
    },
  ];

  return (
    <>
      <HeroCarousel banners={banners} />

      {/* Value strip with sporty cards and semantic tokens */}
      <section className="border-b border-line bg-surface relative z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {trust.map(({ icon: Icon, accent, tint, label, sub }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-3.5 rounded-2xl glass-card border border-line hover:border-blue-500/40 transition-all duration-300 group"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm`}>
                <Icon className={`w-5 h-5 ${tint}`} />
              </div>
              <div className="min-w-0">
                <span className="block text-xs sm:text-sm font-bold text-ink leading-tight truncate">
                  {label}
                </span>
                <span className="block text-[11px] text-ink-muted leading-tight mt-0.5 truncate">
                  {sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
