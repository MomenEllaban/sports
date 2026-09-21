'use client';

import { useLinkStatus } from 'next/link';

/**
 * Tiny inline activity indicator that only lives inside a <Link>.
 * Reserves its own space (opacity, not display) so the label never shifts.
 */
export default function NavPending({ className = '' }: { className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent transition-opacity duration-150 ${
        pending ? 'animate-spin opacity-80' : 'opacity-0'
      } ${className}`}
    />
  );
}
