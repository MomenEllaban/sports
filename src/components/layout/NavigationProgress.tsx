'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';

const SHOW_DELAY_MS = 140;
const MAX_DURATION_MS = 10000;

/**
 * Branded top-progress bar for client-side navigations.
 *
 * - Appears only after SHOW_DELAY_MS so instant (prefetched / cached) route
 *   transitions never flash the bar.
 * - Completes as soon as the destination route, search params or locale change.
 * - Fails safe with MAX_DURATION_MS so it can never get stuck on screen.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const search = searchParams?.toString() ?? '';

  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);

  const running = useRef(false);
  const showTimer = useRef<number | null>(null);
  const trickleTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const maxTimer = useRef<number | null>(null);

  const clearAll = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (trickleTimer.current) window.clearInterval(trickleTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (maxTimer.current) window.clearTimeout(maxTimer.current);
    showTimer.current = null;
    trickleTimer.current = null;
    hideTimer.current = null;
    maxTimer.current = null;
  }, []);

  const complete = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    clearAll();
    setValue(100);
    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      setValue(0);
    }, 260);
  }, [clearAll]);

  const begin = useCallback(() => {
    if (running.current) return;
    running.current = true;
    clearAll();
    setValue(0);
    showTimer.current = window.setTimeout(() => {
      setVisible(true);
      setValue(10);
      trickleTimer.current = window.setInterval(() => {
        setValue((v) => (v >= 92 ? v : Math.min(92, v + Math.max(0.6, (92 - v) * 0.12))));
      }, 200);
    }, SHOW_DELAY_MS);
    maxTimer.current = window.setTimeout(complete, MAX_DURATION_MS);
  }, [clearAll, complete]);

  // Finish the bar as soon as the navigation actually resolves.
  useEffect(() => {
    complete();
  }, [pathname, search, locale, complete]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      begin();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [begin]);

  useEffect(() => clearAll, [clearAll]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[10000] h-[3px]">
      <div
        className="h-full rounded-e-full bg-gradient-to-r from-blue-500 via-amber-400 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.65)]"
        style={{
          width: `${value}%`,
          opacity: visible ? 1 : 0,
          transition: 'width 220ms ease-out, opacity 220ms ease-out',
        }}
      />
    </div>
  );
}
