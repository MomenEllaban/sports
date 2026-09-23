'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';

type Phase = 'loading' | 'fading' | 'hidden';

export default function Preloader() {
  const t = useTranslations('common');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const [progress, setProgress] = useState(12);
  const [phase, setPhase] = useState<Phase>('loading');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setProgress(100);
      timers.current.push(window.setTimeout(() => setPhase('fading'), 200));
      timers.current.push(window.setTimeout(() => setPhase('hidden'), 700));
    };

    // Smooth the progress bar until the REAL load event fires.
    const bump = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.random() * 14 + 4 : p));
    }, 160);

    if (document.readyState === 'complete') {
      window.setTimeout(finish, 350);
    } else {
      window.addEventListener('load', finish, { once: true });
    }

    // Safety net: never block the UI longer than this on stuck resources.
    const maxWait = window.setTimeout(finish, 8000);

    return () => {
      window.clearInterval(bump);
      window.clearTimeout(maxWait);
      window.removeEventListener('load', finish);
      timers.current.forEach((x) => window.clearTimeout(x));
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div
      role="status"
      aria-busy={phase === 'loading'}
      aria-label={t('loading')}
      className={`pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#1a1512] to-[#2b2320] transition-opacity duration-500 ease-out ${
        phase === 'fading' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ willChange: 'opacity' }}
    >
      {/* Soft radial amber glow behind the logo (inset-0: gradient already fades to transparent; avoids page overflow) */}
      <div
        aria-hidden
        className="champ-glow absolute inset-0"
        style={{
          background:
            'radial-gradient(circle, rgba(245,166,35,0.30) 0%, rgba(245,166,35,0.08) 45%, transparent 70%)',
          willChange: 'opacity',
        }}
      />

      {/* Logo + spinning gradient ring */}
      <div className="relative" style={{ width: 'clamp(180px, 22vmin, 220px)', willChange: 'transform, opacity' }}>
        <div
          aria-hidden
          className="champ-ring absolute -inset-4 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, transparent 70deg, rgba(245,166,35,0.92) 190deg, rgba(255,201,111,0.55) 235deg, transparent 320deg, transparent 360deg)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px))',
            willChange: 'transform',
          }}
        />
        <Image
          src="/logo.avif"
          alt="أبطال الرياضة الإبراهيمية"
          width={960}
          height={822}
          priority
          quality={85}
          sizes="220px"
          className={`relative h-auto w-full rounded-2xl drop-shadow-[0_0_26px_rgba(245,166,35,0.35)] ${
            phase === 'fading' ? 'champ-logo-exit' : 'champ-logo'
          }`}
          style={{ willChange: 'transform, opacity' }}
        />
      </div>

      {/* Thin golden gradient progress bar */}
      <div
        className="relative mt-10 h-1 w-56 overflow-hidden rounded-full bg-amber-500/15 sm:w-64"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full w-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400 transition-transform duration-200 ease-out"
          style={{
            transform: `scaleX(${progress / 100})`,
            transformOrigin: isRtl ? 'right' : 'left',
            willChange: 'transform',
          }}
        />
      </div>

      <p className="mt-4 text-sm font-extrabold tracking-wide text-amber-300">{t('loading')}</p>
      <p className="mt-1 text-[11px] font-semibold text-[#cbd5e1]">{t('appName')}</p>
    </div>
  );
}