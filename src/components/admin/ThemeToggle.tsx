'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useLocale } from 'next-intl';
import { applyTheme, initialTheme, nextTheme, type ThemeName } from '@/lib/theme';

/**
 * Light / dark control.
 *
 * `variant="switch"` is the pill used in the admin and storefront headers;
 * `variant="icon"` is the compact 44px button the POS uses, where the header is
 * dense and a pill would compete with the keypad. The two are deliberately
 * different shapes: a language control and a theme control must never be
 * mistaken for each other.
 */
export default function ThemeToggle({
  variant = 'switch',
  className = '',
}: {
  variant?: 'switch' | 'icon';
  className?: string;
}) {
  const [theme, setTheme] = useState<ThemeName>('dark');
  const locale = useLocale();
  const isAr = locale === 'ar';

  // Read the theme on mount instead of assuming dark: a light-mode user must not
  // see a dark flash, and the button must not claim a state the DOM lacks.
  useEffect(() => {
    setTheme(initialTheme(document.documentElement, window.localStorage));
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = nextTheme(current);
      applyTheme(next, document.documentElement, window.localStorage);
      return next;
    });
  }, []);

  const isDark = theme === 'dark';
  const label = isDark
    ? isAr
      ? 'التبديل إلى الوضع الفاتح'
      : 'Switch to light mode'
    : isAr
      ? 'التبديل إلى الوضع الداكن'
      : 'Switch to dark mode';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggle}
        title={label}
        aria-label={label}
        aria-pressed={!isDark}
        data-theme-toggle="icon"
        className={`min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 transition-colors hover:border-amber-400/70 hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
      >
        {isDark ? <Moon className="mx-auto h-5 w-5" aria-hidden="true" /> : <Sun className="mx-auto h-5 w-5" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      dir="ltr"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={!isDark}
      data-theme-toggle="switch"
      className={`
        relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
        ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-amber-400 hover:bg-amber-300 border-amber-500'}
        border shadow-inner ${className}
      `}
    >
      {/* Background track icons for rich feedback */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none text-[10px]">
        <Moon className={`w-3 h-3 transition-opacity duration-300 ${isDark ? 'opacity-50 text-slate-400' : 'opacity-0'}`} />
        <Sun className={`w-3 h-3 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-70 text-amber-900'}`} />
      </span>

      {/* Knob */}
      <span
        className={`
          absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out flex items-center justify-center text-xs pointer-events-none
          ${isDark ? 'translate-x-0 bg-slate-300 text-slate-800' : 'translate-x-6 bg-white text-amber-500'}
        `}
      >
        {isDark ? <Moon className="w-2.5 h-2.5 fill-current" aria-hidden="true" /> : <Sun className="w-2.5 h-2.5 fill-current" aria-hidden="true" />}
      </span>
    </button>
  );
}
