import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect all admin routes (both /admin/... and /en/admin/...) except login
  const isAdminRoute = /^(\/(ar|en))?\/admin(\/|$)/.test(pathname);
  const isLoginRoute = pathname.includes('/admin/login');

  if (isAdminRoute && !isLoginRoute) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const locale = pathname.startsWith('/en') ? 'en' : 'ar';
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = locale === 'en' ? '/en/admin/login' : '/admin/login';
      loginUrl.searchParams.set('callbackUrl', pathname);
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
