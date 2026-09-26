import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';
import { requiredSecret } from './lib/env-guard';

const intlMiddleware = createMiddleware(routing);
const authSecret = requiredSecret('NEXTAUTH_SECRET', 'dev-insecure-nextauth-secret');

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Retrieve auth token once for reuse
  const token = await getToken({ req, secret: authSecret });

  // Arabic is the explicit default entry point. Keep query/hash parameters.
  if (pathname === '/') {
    const arabicUrl = req.nextUrl.clone();
    arabicUrl.pathname = '/ar';
    return NextResponse.redirect(arabicUrl, 307);
  }

  // 1. Detect and cleanly redirect any repeated locale prefixes (e.g. /en/en/admin -> /en/admin)
  const repeatedLocaleMatch = pathname.match(/^\/(ar|en)(?:\/(ar|en))+(\/.*)?$/);
  if (repeatedLocaleMatch) {
    const finalLocale = repeatedLocaleMatch[2] || repeatedLocaleMatch[1];
    const rest = repeatedLocaleMatch[3] || '';
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.pathname = (finalLocale === 'en' ? `/en${rest}` : rest) || '/';
    return NextResponse.redirect(cleanUrl, 308);
  }

  // 2. Protect all admin routes (both /admin/... and /en/admin/...) except login
  const isAdminRoute = /^(\/(ar|en))?\/admin(\/|$)/.test(pathname);
  const isLoginRoute = pathname.includes('/admin/login');

  if (isAdminRoute && !isLoginRoute) {
    if (!token) {
      console.warn(`Unauthorized admin access attempt to ${pathname}`);
      const locale = pathname.startsWith('/en') ? 'en' : 'ar';
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = locale === 'en' ? '/en/admin/login' : '/admin/login';
      const cleanCallback = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, '') || '/admin';
      loginUrl.searchParams.set('callbackUrl', cleanCallback);
      return NextResponse.redirect(loginUrl);
    }
    const role = (token as any).role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      console.warn(`Forbidden admin access for role ${role} to ${pathname}`);
      const locale = pathname.startsWith('/en') ? 'en' : 'ar';
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = locale === 'en' ? '/en' : '/';
      return NextResponse.redirect(homeUrl);
    }
  }

  // 3. Protect POS terminal pages: CASHIER, BRANCH_MANAGER, SUPER_ADMIN only (T03).
  const isPosRoute = /^(\/(ar|en))?\/pos(\/|$)/.test(pathname);
  if (isPosRoute) {
    // Token already retrieved earlier; using shared token variable
    const locale = pathname.startsWith('/en') ? 'en' : 'ar';
    if (!token) {
      console.warn(`Unauthorized POS access attempt to ${pathname}`);
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = locale === 'en' ? '/en/admin/login' : '/admin/login';
      const cleanCallback = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, '') || '/pos';
      loginUrl.searchParams.set('callbackUrl', cleanCallback);
      return NextResponse.redirect(loginUrl);
    }
    const role = token.role;
    if (role !== 'CASHIER' && role !== 'BRANCH_MANAGER' && role !== 'SUPER_ADMIN') {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = locale === 'en' ? '/en' : '/';
      return NextResponse.redirect(homeUrl);
    }
  }
  // 4. Protect POS API routes: enforce same RBAC for /api/pos/* endpoints.
  const isPosApiRoute = pathname.startsWith('/api/pos');
  if (isPosApiRoute) {
    if (!token) {
      console.warn(`Unauthorized POS API access attempt to ${pathname}`);
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const role = token.role;
    if (role !== 'CASHIER' && role !== 'BRANCH_MANAGER' && role !== 'SUPER_ADMIN') {
      console.warn(`Forbidden POS API access for role ${role} to ${pathname}`);
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Match all relevant pathnames, including POS API routes, while excluding other API routes and static assets.
  matcher: [
    '/',
    '/(ar|en)/:path*',
    '/api/pos/:path*', // Include POS API endpoints for middleware protection
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
