import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
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

  return intlMiddleware(req);
}

export const config = {
  // Match all pathnames except API routes and static assets so
  // prefix-less URLs (default locale) are rewritten with locale
  matcher: ['/', '/(ar|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
