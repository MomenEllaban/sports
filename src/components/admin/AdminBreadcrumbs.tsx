'use client';

import React from 'react';
import { ChevronLeft, Home } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import { ADMIN_ROLES, findAdminNavItem, normalizeAdminPath, type AdminRole } from '@/config/admin-navigation';

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

export default function AdminBreadcrumbs() {
  const pathname = usePathname() || '/admin';
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { data: session } = useSession();
  const rawRole = (session?.user as { role?: unknown } | undefined)?.role;
  const role: AdminRole | undefined = isAdminRole(rawRole) ? rawRole : undefined;
  // The role is part of the lookup: a breadcrumb must not label a page the
  // signed-in user has no permission to open.
  const current = session ? findAdminNavItem(pathname, role) : null;

  if (!current) {
    return (
      <nav aria-label={isAr ? 'مسار التنقل' : 'Breadcrumb'} className="flex items-center gap-1 text-xs text-slate-500">
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
      </nav>
    );
  }

  const groupLabel = isAr ? current.group.labelAr : current.group.labelEn;
  const itemLabel = isAr ? current.item.labelAr : current.item.labelEn;
  const tabLabel = current.tab ? (isAr ? current.tab.labelAr : current.tab.labelEn) : null;
  const itemIsRoot = normalizeAdminPath(pathname) === normalizeAdminPath(current.item.href);

  return (
    <nav aria-label={isAr ? 'مسار التنقل' : 'Breadcrumb'} className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-slate-500">
      <Link href="/admin" className="inline-flex shrink-0 items-center gap-1 hover:text-slate-200" aria-label={isAr ? 'الرئيسية' : 'Home'}>
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{isAr ? 'الرئيسية' : 'Home'}</span>
      </Link>
      <ChevronLeft className="h-3.5 w-3.5 shrink-0 rtl-flip" aria-hidden="true" />
      <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{groupLabel}</span>
      <ChevronLeft className="h-3.5 w-3.5 shrink-0 rtl-flip" aria-hidden="true" />
      {itemIsRoot || !tabLabel ? (
        <span className="max-w-[12rem] truncate font-bold text-slate-300" aria-current="page">{itemLabel}</span>
      ) : (
        <>
          <Link href={current.item.href} className="hidden max-w-[10rem] truncate hover:text-slate-200 sm:inline">{itemLabel}</Link>
          <ChevronLeft className="hidden h-3.5 w-3.5 shrink-0 rtl-flip sm:block" aria-hidden="true" />
          <span className="max-w-[12rem] truncate font-bold text-slate-300" aria-current="page">{tabLabel}</span>
        </>
      )}
    </nav>
  );
}
