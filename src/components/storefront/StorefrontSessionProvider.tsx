'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, ClientApiError } from '@/lib/client-api';
import { useLocale } from 'next-intl';

const WISHLIST_KEY = 'sc:wishlist';
const WISHLIST_EVENT = 'sc:wishlist-changed';

function readGuestWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0))].slice(0, 500);
  } catch {
    return [];
  }
}

function writeGuestWishlist(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify([...new Set(ids)].slice(0, 500)));
    window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
  } catch {
    // Storage can be unavailable in private browsing; memory state still works.
  }
}

export function getWishlist(): string[] {
  return readGuestWishlist();
}

export function setGuestWishlist(ids: string[]): void {
  writeGuestWishlist(ids);
}

export function clearGuestWishlist(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(WISHLIST_KEY); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
}

export interface StorefrontSessionValue {
  authenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  wishlist: string[];
  wishlistLoading: boolean;
  wishlistReady: boolean;
  wishlistError: string;
  toggle: (productId: string) => Promise<boolean>;
  refreshWishlist: () => Promise<void>;
  mergeGuestWishlist: () => Promise<void>;
}

const StorefrontSessionContext = createContext<StorefrontSessionValue | null>(null);

export function useStorefrontSession(): StorefrontSessionValue {
  const value = useContext(StorefrontSessionContext);
  if (!value) throw new Error('useStorefrontSession must be used inside StorefrontSessionProvider');
  return value;
}

/** Single source of truth for every product card, header counter and wishlist page. */
export function useWishlist(): StorefrontSessionValue {
  return useStorefrontSession();
}

export default function StorefrontSessionProvider({
  initialAuthenticated,
  children,
}: {
  initialAuthenticated: boolean;
  children: React.ReactNode;
}) {
  const [authenticated, setAuthenticatedState] = useState(initialAuthenticated);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(true);
  const [wishlistError, setWishlistError] = useState('');
  const isAr = useLocale() === 'ar';
  const L = useCallback((ar: string, en: string) => (isAr ? ar : en), [isAr]);
  const wishlistRef = useRef<string[]>([]);
  const remoteRequestRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    wishlistRef.current = wishlist;
  }, [wishlist]);

  const setAuthenticated = useCallback((value: boolean) => {
    setAuthenticatedState(value);
    if (!value) {
      const local = readGuestWishlist();
      wishlistRef.current = local;
      setWishlist(local);
      setWishlistError('');
      setWishlistLoading(false);
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    if (!authenticated) {
      const local = readGuestWishlist();
      wishlistRef.current = local;
      setWishlist(local);
      setWishlistLoading(false);
      return;
    }
    if (remoteRequestRef.current) return remoteRequestRef.current;

    const request = (async () => {
      setWishlistLoading(true);
      setWishlistError('');
      try {
        const data = await apiRequest<{ productIds?: unknown }>('/api/account/wishlist', {
          cache: 'no-store',
          suppressAuthRedirect: true,
          errorKey: 'wishlist:read',
        });
        const ids = Array.isArray(data.productIds)
          ? data.productIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];
        if (!mountedRef.current) return;
        wishlistRef.current = ids;
        setWishlist(ids);
      } catch (error) {
        if (!mountedRef.current) return;
        if (error instanceof ClientApiError && (error.status === 401 || error.status === 403)) {
          setAuthenticatedState(false);
          const local = readGuestWishlist();
          wishlistRef.current = local;
          setWishlist(local);
        } else {
          setWishlistError(error instanceof Error ? error.message : L('تعذر تحميل قائمة الأمنيات', 'Could not load the wishlist'));
        }
      } finally {
        if (mountedRef.current) setWishlistLoading(false);
      }
    })();

    remoteRequestRef.current = request;
    try {
      await request;
    } finally {
      if (remoteRequestRef.current === request) remoteRequestRef.current = null;
    }
  }, [authenticated, L]);

  useEffect(() => {
    if (!authenticated) {
      const local = readGuestWishlist();
      wishlistRef.current = local;
      setWishlist(local);
      setWishlistLoading(false);
      return;
    }
    void refreshWishlist();
  }, [authenticated, refreshWishlist]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (authenticated || (event.key !== null && event.key !== WISHLIST_KEY)) return;
      const local = readGuestWishlist();
      wishlistRef.current = local;
      setWishlist(local);
    };
    const onLocalChange = () => {
      if (authenticated) return;
      const local = readGuestWishlist();
      wishlistRef.current = local;
      setWishlist(local);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(WISHLIST_EVENT, onLocalChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(WISHLIST_EVENT, onLocalChange);
    };
  }, [authenticated]);

  useEffect(() => {
    setAuthenticatedState(initialAuthenticated);
  }, [initialAuthenticated]);

  const toggle = useCallback(async (productId: string): Promise<boolean> => {
    const current = wishlistRef.current;
    const active = current.includes(productId);
    const next = active ? current.filter((id) => id !== productId) : [...current, productId];
    wishlistRef.current = next;
    setWishlist(next);

    if (!authenticated) {
      writeGuestWishlist(next);
      return !active;
    }

    try {
      await apiRequest('/api/account/wishlist', {
        method: active ? 'DELETE' : 'POST',
        body: JSON.stringify({ productId }),
        suppressAuthRedirect: true,
        errorKey: `wishlist:toggle:${productId}`,
      });
      return !active;
    } catch (error) {
      if (error instanceof ClientApiError && (error.status === 401 || error.status === 403)) {
        // The signed portal cookie expired: preserve the user's visible action
        // locally and let the provider fall back to guest mode.
        writeGuestWishlist(next);
        setAuthenticatedState(false);
        return !active;
      }
      wishlistRef.current = current;
      setWishlist(current);
      setWishlistError(error instanceof Error ? error.message : L('تعذر تحديث قائمة الأمنيات', 'Could not update the wishlist'));
      throw error;
    }
  }, [authenticated, L]);

  const mergeGuestWishlist = useCallback(async () => {
    const guestIds = readGuestWishlist();
    if (guestIds.length === 0) return;
    const data = await apiRequest<{ productIds?: unknown }>('/api/account/wishlist/merge', {
      method: 'POST',
      body: JSON.stringify({ productIds: guestIds }),
      suppressAuthRedirect: true,
      errorKey: 'wishlist:merge',
    });
    const ids = Array.isArray(data.productIds)
      ? data.productIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : guestIds;
    wishlistRef.current = ids;
    setWishlist(ids);
    clearGuestWishlist();
  }, []);

  const value = useMemo<StorefrontSessionValue>(() => ({
    authenticated,
    setAuthenticated,
    wishlist,
    wishlistLoading,
    wishlistReady: !wishlistLoading,
    wishlistError,
    toggle,
    refreshWishlist,
    mergeGuestWishlist,
  }), [authenticated, mergeGuestWishlist, refreshWishlist, setAuthenticated, toggle, wishlist, wishlistError, wishlistLoading]);

  return <StorefrontSessionContext.Provider value={value}>{children}</StorefrontSessionContext.Provider>;
}
