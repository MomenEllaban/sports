import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Regression guard for the POS 404s.
 *
 * `localePrefix: 'always'` makes next-intl rewrite every unprefixed path to
 * `/{locale}{path}`. The POS API endpoints were matched by the middleware, so
 * `/api/pos/products` was rewritten to `/ar/api/pos/products` — a URL with no
 * route behind it — and every POS call answered 404 while `/api/admin/*` (which
 * the matcher excludes) worked fine.
 *
 * These tests assert the behaviour, not the source text: a POS API request must
 * come back untouched, while a page request must still be rewritten by next-intl.
 */
const tokenHolder = globalThis as Record<string, unknown>;

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(async () => tokenHolder.__token ?? null),
}));

const { default: middleware, config } = await import('../../src/middleware.js');

function request(path: string) {
  return new NextRequest(new URL(path, 'https://sports.test'), { headers: { cookie: 'session=test' } });
}

function rewriteOf(res: Awaited<ReturnType<typeof middleware>>) {
  return res.headers.get('x-middleware-rewrite');
}

describe('POS API routes are never rewritten by next-intl', () => {
  beforeEach(() => {
    tokenHolder.__token = { role: 'CASHIER' };
  });

  it('keeps /api/pos/* in the matcher, since RBAC is enforced there', () => {
    expect(config.matcher).toContain('/api/pos/:path*');
  });

  it('passes an authenticated POS product request through untouched', async () => {
    const res = await middleware(request('/api/pos/products'));
    expect(res.status).toBe(200);
    expect(rewriteOf(res)).toBeNull();
  });

  it('passes an authenticated POS shift request through untouched', async () => {
    const res = await middleware(request('/api/pos/shifts'));
    expect(res.status).toBe(200);
    expect(rewriteOf(res)).toBeNull();
  });

  it('does not add a locale prefix to any API path', async () => {
    for (const path of ['/api/pos/sale', '/api/pos/shifts/abc', '/api/pos/customer']) {
      const res = await middleware(request(path));
      expect(rewriteOf(res)).toBeNull();
    }
  });

  it('still rejects an anonymous POS API call with 401', async () => {
    tokenHolder.__token = null;
    const res = await middleware(request('/api/pos/products'));
    expect(res.status).toBe(401);
  });

  it('still rejects a non-POS role on the POS API with 403', async () => {
    tokenHolder.__token = { role: 'FINANCE' };
    const res = await middleware(request('/api/pos/products'));
    expect(res.status).toBe(403);
  });

  it('still lets next-intl handle an unprefixed page', async () => {
    // The contrast that proves the API branch is what changed: the POS *page*
    // is still handed to next-intl, only the API stops being rewritten.
    const res = await middleware(request('/pos'));
    expect(res.headers.get('location')).toContain('/ar/pos');
  });
});
