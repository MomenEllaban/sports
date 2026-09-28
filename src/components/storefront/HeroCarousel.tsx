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
  const sectionRef = useRef<HTMLElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const isReducedMotion = useRef(false);
  const rafId = useRef<number | null>(null);

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

  // Track prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotion.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      isReducedMotion.current = e.matches;
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Reset 3D tilt whenever slide index changes
  useEffect(() => {
    if (tiltRef.current) {
      tiltRef.current.style.transition = 'transform 0.4s ease-out';
      tiltRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';
    }
  }, [safeIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (isReducedMotion.current) return;
    // Don't calculate or apply tilt on touch/coarse pointers (prevents any mobile performance hit)
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;

    const el = sectionRef.current;
    if (!el || !tiltRef.current) return;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Relative mouse position normalized from -1 to 1
    const normX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const normY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    // Gentle, non-intrusive tilt angles (±2.5deg) and subtle counter-depth shift (±8px)
    const rotX = -normY * 2.5;
    const rotY = normX * 3.5;
    const transX = -normX * 8;
    const transY = -normY * 8;

    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (tiltRef.current) {
        tiltRef.current.style.transition = 'transform 0.15s ease-out';
        tiltRef.current.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translate3d(${transX.toFixed(1)}px, ${transY.toFixed(1)}px, 0)`;
      }
    });
  };

  const handleMouseLeave = () => {
    setPaused(false);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (tiltRef.current) {
      tiltRef.current.style.transition = 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
      tiltRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)';
    }
  };

  if (count === 0) return null;

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label={L('عروض المتجر', 'Store offers')}
      className="relative overflow-hidden bg-[#020617] border-b border-slate-800"
      onMouseEnter={() => setPaused(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
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
                  {/* Subtle 3D-tiltable image container with overflow padding */}
                  <div
                    ref={active ? tiltRef : undefined}
                    className="absolute -inset-4 will-change-transform pointer-events-none"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Plain <img> on purpose: image URLs are admin-supplied */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner.imageUrl}
                      alt=""
                      aria-hidden="true"
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={i === 0 ? 'high' : 'auto'}
                      className={`w-full h-full object-cover transition-transform duration-[7000ms] ease-out motion-reduce:transform-none motion-reduce:transition-none ${
                        active ? 'scale-108' : 'scale-100'
                      }`}
                    />
                  </div>

                  {/* Directional scrim: concentrated exclusively on the copy/text side and smoothly fading to transparent */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: isAr
                        ? 'linear-gradient(to left, rgba(2, 6, 23, 0.85) 0%, rgba(2, 6, 23, 0.55) 28%, rgba(2, 6, 23, 0.15) 55%, transparent 75%)'
                        : 'linear-gradient(to right, rgba(2, 6, 23, 0.85) 0%, rgba(2, 6, 23, 0.55) 28%, rgba(2, 6, 23, 0.15) 55%, transparent 75%)',
                    }}
                  />
                  {/* Soft bottom grounding scrim for pagination indicators and seam */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#020617]/70 via-[#020617]/15 to-transparent pointer-events-none" />
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
                    className={`text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] ${
                      active ? 'animate-fade-up stagger-1' : ''
                    }`}
                  >
                    {title}
                  </h1>

                  {subtitle ? (
                    <p
                      className={`text-base sm:text-lg font-medium leading-relaxed max-w-xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] opacity-95 ${
                        active ? 'animate-fade-up stagger-2' : ''
                      }`}
                      style={{ color: '#ffffff' }}
                    >
                      {subtitle}
                    </p>
                  ) : null}

                  {banner.ctaLink && cta ? (
                    <div className={`pt-2 flex flex-wrap items-center gap-3 sm:gap-4 ${active ? 'animate-fade-up stagger-3' : ''}`}>
                      {/* Primary CTA: High-contrast athletic blue with vibrant glow */}
                      <Link
                        href={banner.ctaLink}
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2.5 px-7 py-3.5 sm:px-8 sm:py-4 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-400 hover:via-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-extrabold text-sm sm:text-base transition-all duration-300 shadow-xl shadow-blue-500/40 hover:shadow-blue-400/60 hover:-translate-y-0.5 active:translate-y-0 border border-blue-400/50 hover:border-blue-300 ring-2 ring-blue-500/20 group"
                      >
                        <ShoppingCart className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                        <span className="text-white font-black" style={{ color: '#ffffff' }}>{cta}</span>
                      </Link>

                      {/* Secondary CTA: Crisp high-contrast frosted glass */}
                      <Link
                        href="/catalog"
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-2 px-6 py-3.5 sm:px-7 sm:py-4 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/10 text-white font-extrabold text-sm sm:text-base border-2 border-white/60 hover:border-white backdrop-blur-md shadow-lg shadow-black/20 hover:shadow-white/10 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 group"
                      >
                        <span className="text-white font-extrabold" style={{ color: '#ffffff' }}>
                          {isAr ? 'تصفح كل التشكيلات' : 'Explore Collections'}
                        </span>
                        {isAr ? (
                          <ChevronLeft className="w-4 h-4 text-white transition-transform duration-300 group-hover:-translate-x-1" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-1" />
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
