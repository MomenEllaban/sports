'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Megaphone, X } from 'lucide-react';
import type { AnnouncementSettings } from '@/lib/website/cms';

const DISMISS_KEY = 'cms-announcement-dismissed';

/**
 * Top announcement strip. The admin copy promises it shows on every storefront
 * page, so it is mounted once in the storefront layout rather than per page.
 *
 * Dismissal is per tab session (sessionStorage, not localStorage) so the strip
 * returns on the next visit instead of disappearing forever after one click.
 */
export default function AnnouncementBar({ announcement }: { announcement: AnnouncementSettings }) {
  const isAr = useLocale() === 'ar';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const text = isAr ? announcement.textAr : announcement.textEn;
  const [dismissed, setDismissed] = useState(true);

  // Read the dismissal flag after mount so the bar never flashes in and out on
  // first paint for someone who already closed it.
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === announcement.textEn + announcement.textAr);
    } catch {
      setDismissed(false);
    }
  }, [announcement.textAr, announcement.textEn]);

  if (!announcement.enabled || dismissed || !text) return null;

  const body = (
    <>
      <Megaphone className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{text}</span>
      {announcement.link && (
        <span className="hidden sm:inline opacity-80 font-black whitespace-nowrap">
          {L('اعرف المزيد', 'Learn more')} →
        </span>
      )}
    </>
  );

  return (
    <div className="relative z-50 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white text-xs font-bold">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 min-h-[36px]">
        {announcement.link ? (
          <Link href={announcement.link} className="flex items-center gap-2 min-w-0 hover:underline">
            {body}
          </Link>
        ) : (
          <div className="flex items-center gap-2 min-w-0">{body}</div>
        )}
        <button
          onClick={() => {
            setDismissed(true);
            try {
              sessionStorage.setItem(DISMISS_KEY, announcement.textEn + announcement.textAr);
            } catch {
              /* private mode: the bar simply returns on the next page */
            }
          }}
          aria-label={L('إخفاء شريط الإعلانات', 'Dismiss announcement')}
          className="absolute end-2 p-1 rounded-md hover:bg-white/15 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
