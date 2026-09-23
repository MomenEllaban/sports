'use client';

import React from 'react';
import { useLocale } from 'next-intl';

export function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.44 19.65L5.27 16.61L5.07 16.29C4.24 14.97 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67ZM8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7 8.5 7 9.74C7 10.98 7.9 12.18 8.03 12.35C8.16 12.52 9.8 15.05 12.31 16.14C12.91 16.4 13.38 16.55 13.74 16.67C14.34 16.86 14.89 16.83 15.32 16.77C15.8 16.7 16.8 16.17 17.01 15.58C17.22 15 17.22 14.5 17.15 14.39C17.09 14.28 16.92 14.22 16.66 14.09C16.4 13.96 15.13 13.33 14.89 13.25C14.66 13.16 14.49 13.12 14.32 13.37C14.15 13.62 13.67 14.19 13.52 14.36C13.37 14.53 13.22 14.55 12.96 14.42C12.7 14.29 11.87 14.02 10.88 13.14C10.11 12.45 9.59 11.6 9.46 11.38C9.33 11.16 9.45 11.04 9.58 10.91C9.7 10.79 9.84 10.6 9.97 10.45C10.1 10.3 10.14 10.19 10.23 10.01C10.31 9.84 10.27 9.69 10.21 9.56C10.14 9.44 9.63 8.18 9.42 7.67C9.21 7.16 9 7.23 8.84 7.22L8.53 7.33Z" />
    </svg>
  );
}

export default function WhatsAppButton() {
  const locale = useLocale();
  const isAr = locale === 'ar';

  const defaultMsg = isAr
    ? 'مرحباً، أود الاستفسار عن منتجات أبطال الرياضة بالإسكندرية'
    : 'Hello, I would like to inquire about Sports Champions Alexandria products';

  const whatsappUrl = `https://wa.me/201224226876?text=${encodeURIComponent(defaultMsg)}`;

  return (
    <aside
      aria-label={isAr ? 'زر واتساب للتواصل السريع' : 'WhatsApp quick contact button'}
      className="fixed bottom-6 left-6 z-40 flex items-center group pointer-events-auto"
    >
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isAr ? 'تواصل معنا على واتساب: 01224226876' : 'Chat with us on WhatsApp: 01224226876'}
        title={isAr ? 'تواصل معنا على واتساب: 01224226876' : 'Chat on WhatsApp: 01224226876'}
        className="relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300 border border-emerald-400/40"
      >
        {/* Pulsing ring indicator */}
        <span className="absolute -top-1 -end-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-300 border-2 border-slate-950" />
        </span>

        <WhatsAppIcon className="w-6 h-6 shrink-0" />
        <div className="flex flex-col text-start">
          <span className="text-[11px] font-bold leading-tight">
            {isAr ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
          </span>
          <span dir="ltr" className="text-xs font-black tracking-wider tabular-nums leading-tight">
            0122 422 6876
          </span>
        </div>
      </a>
    </aside>
  );
}
