'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const locale = useLocale();
  const isAr = locale === 'ar';

  useEffect(() => {
    // Read saved preference
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      setIsDark(false);
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      setIsDark(true);
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      // Dark mode
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      // Light mode
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      type="button"
      dir="ltr"
      onClick={toggle}
      title={isDark ? (isAr ? 'تفعيل الوضع الفاتح' : 'Switch to light mode') : (isAr ? 'تفعيل الوضع الداكن' : 'Switch to dark mode')}
      aria-label={isDark ? (isAr ? 'تفعيل الوضع الفاتح' : 'Switch to light mode') : (isAr ? 'تفعيل الوضع الداكن' : 'Switch to dark mode')}
      className={`
        relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-300 shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
        ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-amber-400 hover:bg-amber-300 border-amber-500'}
        border shadow-inner
      `}
    >
      {/* Background track icons for rich feedback */}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none text-[10px]">
        <Moon className={`w-3 h-3 transition-opacity duration-300 ${isDark ? 'opacity-50 text-slate-400' : 'opacity-0'}`} />
        <Sun className={`w-3 h-3 transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-70 text-amber-900'}`} />
      </span>

      {/* Knob */}
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md transition-transform duration-300 ease-in-out flex items-center justify-center text-xs pointer-events-none
          ${isDark ? 'translate-x-0 bg-slate-300 text-slate-800' : 'translate-x-6 bg-white text-amber-500'}
        `}
      >
        {isDark ? (
          <Moon className="w-2.5 h-2.5 fill-current" />
        ) : (
          <Sun className="w-2.5 h-2.5 fill-current" />
        )}
      </span>
    </button>
  );
}
