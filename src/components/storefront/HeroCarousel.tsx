'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import type { HeroBanner } from '@/lib/website/cms';

const ROTATE_MS = 6500;

export default function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const count = banners.length;
  // Guard against the list shrinking (admin hid a slide) while it is mounted.
  const safeIndex = count > 0 ? index % count : 0;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={L('عروض المتجر', 'Store offers')}
      className="relative overflow-hidden bg-slate-950 border-b border-slate-800"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        const end = e.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined) return;
        const delta = end - start;
        // ~48px of travel so a tap does not flip the slide.
        if (Math.abs(delta) < 48) return;
        go(safeIndex + (delta < 0 ? 1 : -1));
      }}
    >
      <div className="relative h-[520px] sm:h-[560px] lg:h-[600px]">
        {banners.map((banner, i) => {
          const active = i === safeIndex;
          const title = isAr ? banner.titleAr : banner.titleEn;
          const subtitle = isAr ? banner.subtitleAr : banner.subtitleEn;
          const badge = isAr ? banner.badgeAr : banner.badgeEn;
          const cta = isAr ? banner.ctaTextAr : banner.ctaTextEn;

          return (
            <div
              key={banner.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {banner.imageUrl ? (
                <>
                  {/* Plain <img> on purpose: image URLs are admin-supplied, so
                      next/image cannot be used — an unlisted host would throw
                      at runtime instead of just rendering. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={banner.imageUrl}
                    alt=""
                    aria-hidden="true"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Two-stop scrim: dark enough under the copy on the left,
                      still lets the product photo read on the right. */}
                  <div className="absolute inset-0 bg-gradient-to-l from-slate-950 via-slate-950/80 to-slate-950/25" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950" />
              )}

              <div className="relative z-10 h-full max-w-7xl mx-auto px-4 flex items-center">
                <div className="max-w-2xl space-y-5">
                  {badge ? (
                    <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur border border-white/20 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">
                      {badge}
                    </span>
                  ) : null}

                  <h1
                    className={`text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white ${
                      active ? 'animate-fade-up' : ''
                    }`}
                  >
                    {title}
                  </h1>

                  {subtitle ? (
                    <p
                      className={`text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl ${
                        active ? 'animate-fade-up stagger-1' : ''
                      }`}
                    >
                      {subtitle}
                    </p>
                  ) : null}

                  {banner.ctaLink && cta ? (
                    <div className={`pt-2 ${active ? 'animate-fade-up stagger-2' : ''}`}>
                      <Link
                        href={banner.ctaLink}
                        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-slate-950 font-black text-sm sm:text-base hover:bg-slate-100 transition-colors shadow-xl"
                      >
                        <ShoppingCart className="w-5 h-5" />
                        {cta}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            onClick={() => go(safeIndex - 1)}
            aria-label={L('العرض السابق', 'Previous slide')}
            className="absolute top-1/2 -translate-y-1/2 start-3 z-20 hidden sm:flex items-center justify-center w-11 h-11 rounded-full bg-slate-950/60 backdrop-blur border border-white/15 text-white hover:bg-slate-950/85 transition-colors"
          >
            {isAr ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => go(safeIndex + 1)}
            aria-label={L('العرض التالي', 'Next slide')}
            className="absolute top-1/2 -translate-y-1/2 end-3 z-20 hidden sm:flex items-center justify-center w-11 h-11 rounded-full bg-slate-950/60 backdrop-blur border border-white/15 text-white hover:bg-slate-950/85 transition-colors"
          >
            {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          <div className="absolute bottom-5 inset-x-0 z-20 flex justify-center gap-2">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                onClick={() => go(i)}
                aria-label={L('انتقل إلى الشريحة', 'Go to slide') + ` ${i + 1}`}
                aria-current={i === safeIndex}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === safeIndex ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
