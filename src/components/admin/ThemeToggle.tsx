'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Read saved preference
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
      setIsDark(false);
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
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
      onClick={toggle}
      title={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
      className={`
        relative w-12 h-6 rounded-full transition-all duration-300 flex items-center
        ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-amber-400 hover:bg-amber-500'}
        border ${isDark ? 'border-slate-600' : 'border-amber-500'}
      `}
    >
      {/* Knob */}
      <span
        className={`absolute w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center text-xs
          ${isDark ? 'translate-x-0.5 bg-slate-300' : 'translate-x-6 bg-white'}
        `}
      >
        {isDark ? (
          <Moon className="w-2.5 h-2.5 text-slate-700" />
        ) : (
          <Sun className="w-2.5 h-2.5 text-amber-600" />
        )}
      </span>
    </button>
  );
}
