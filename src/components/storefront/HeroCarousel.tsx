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
      className="relative overflow-hidden bg-[#020617] border-b border-slate-800"
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
      {/* Athletic ambient stadium lighting glows */}
      <div className="absolute top-1/4 start-10 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-10 end-10 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none z-0" />

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
                  {/* Plain <img> on purpose: image URLs are admin-supplied */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={banner.imageUrl}
                    alt=""
                    aria-hidden="true"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[7000ms] ease-out ${
                      active ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  {/* Directional scrim: deep dark coverage over copy area */}
                  <div
                    className={`absolute inset-0 ${
                      isAr
                        ? 'bg-gradient-to-l from-[#020617]/95 via-[#020617]/85 to-[#020617]/30'
                        : 'bg-gradient-to-r from-[#020617]/95 via-[#020617]/85 to-[#020617]/30'
                    }`}
                  />
                  {/* Grounding vertical scrim: dark bottom for controls */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/60 to-[#020617]/20" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#172554] via-[#020617] to-[#1e1b4b]" />
              )}

              <div className="relative z-10 h-full max-w-7xl mx-auto px-4 flex items-center">
                <div className="max-w-2xl space-y-6">
                  {badge ? (
                    <div className={active ? 'animate-fade-up' : ''}>
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/25">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-60" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950" />
                        </span>
                        <span>{badge}</span>
                      </span>
                    </div>
                  ) : null}

                  <h1
                    className={`text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] ${
                      active ? 'animate-fade-up stagger-1' : ''
                    }`}
                  >
                    {title}
                  </h1>

                  {subtitle ? (
                    <p
                      className={`text-base sm:text-lg font-medium leading-relaxed max-w-xl text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)] opacity-95 ${
                        active ? 'animate-fade-up stagger-2' : ''
                      }`}
                      style={{ color: '#ffffff' }}
                    >
                      {subtitle}
                    </p>
                  ) : null}

                  {banner.ctaLink && cta ? (
                    <div className={`pt-2 flex flex-wrap items-center gap-3 sm:gap-4 ${active ? 'animate-fade-up stagger-3' : ''}`}>
                      {/* Primary CTA: Royal Athletic Blue */}
                      <Link
                        href={banner.ctaLink}
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2.5 px-7 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm sm:text-base transition-all duration-300 shadow-xl shadow-blue-600/35 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/30 group"
                      >
                        <ShoppingCart className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                        <span className="text-white font-bold" style={{ color: '#ffffff' }}>{cta}</span>
                      </Link>

                      {/* Secondary CTA: Sleek Frosted Glass */}
                      <Link
                        href="/catalog"
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2 px-6 py-3.5 sm:px-7 sm:py-4 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/5 text-white font-bold text-sm sm:text-base border border-white/25 hover:border-white/50 backdrop-blur-md shadow-lg shadow-black/15 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 group"
                      >
                        <span className="text-white font-bold" style={{ color: '#ffffff' }}>
                          {isAr ? 'تصفح كل التشكيلات' : 'Explore Collections'}
                        </span>
                        {isAr ? (
                          <ChevronLeft className="w-4 h-4 text-white/90 transition-transform duration-300 group-hover:-translate-x-1" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white/90 transition-transform duration-300 group-hover:translate-x-1" />
                        )}
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
            className="absolute top-1/2 -translate-y-1/2 start-4 z-20 hidden sm:flex items-center justify-center w-12 h-12 rounded-full bg-black/60 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/20 hover:border-amber-400 backdrop-blur-md transition-all duration-300 shadow-2xl group"
          >
            {isAr ? <ChevronRight className="w-6 h-6 transition-transform group-hover:scale-110" /> : <ChevronLeft className="w-6 h-6 transition-transform group-hover:scale-110" />}
          </button>
          <button
            onClick={() => go(safeIndex + 1)}
            aria-label={L('العرض التالي', 'Next slide')}
            className="absolute top-1/2 -translate-y-1/2 end-4 z-20 hidden sm:flex items-center justify-center w-12 h-12 rounded-full bg-black/60 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/20 hover:border-amber-400 backdrop-blur-md transition-all duration-300 shadow-2xl group"
          >
            {isAr ? <ChevronLeft className="w-6 h-6 transition-transform group-hover:scale-110" /> : <ChevronRight className="w-6 h-6 transition-transform group-hover:scale-110" />}
          </button>

          <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center items-center gap-2.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                onClick={() => go(i)}
                aria-label={L('انتقل إلى الشريحة', 'Go to slide') + ` ${i + 1}`}
                aria-current={i === safeIndex}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === safeIndex ? 'w-10 bg-amber-400 shadow-lg shadow-amber-400/50' : 'w-2.5 bg-white/40 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
