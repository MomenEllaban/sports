import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';
import { requiredSecret } from './lib/env-guard';

const intlMiddleware = createMiddleware(routing);
const authSecret = requiredSecret('NEXTAUTH_SECRET', 'dev-insecure-nextauth-secret');

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
    const token = await getToken({ req, secret: authSecret });
    if (!token) {
      const locale = pathname.startsWith('/en') ? 'en' : 'ar';
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = locale === 'en' ? '/en/admin/login' : '/admin/login';
      // Strip any locale prefix so next-intl's router does not double-prefix callbackUrl
      const cleanCallback = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, '') || '/admin';
      loginUrl.searchParams.set('callbackUrl', cleanCallback);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Protect POS terminal pages: CASHIER, BRANCH_MANAGER, SUPER_ADMIN only (T03).
  const isPosRoute = /^(\/(ar|en))?\/pos(\/|$)/.test(pathname);
  if (isPosRoute) {
    const token = (await getToken({ req, secret: authSecret })) as {
      role?: string;
    } | null;
    const locale = pathname.startsWith('/en') ? 'en' : 'ar';
    if (!token) {
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

  return intlMiddleware(req);
}

export const config = {
  // Match all pathnames except API routes and static assets so
  // prefix-less URLs (default locale) are rewritten with locale
  matcher: ['/', '/(ar|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
