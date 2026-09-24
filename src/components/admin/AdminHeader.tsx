'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, LogOut, Menu, ShieldCheck, UserRound } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import ThemeToggle from './ThemeToggle';
import { LocaleSwitcher } from '@/components/ui/foundation';
import AdminCommandPalette from './AdminCommandPalette';

const ROLE_LABELS_AR: Record<string, string> = {
  SUPER_ADMIN: 'المدير العام',
  BRANCH_MANAGER: 'مدير فرع',
  FINANCE: 'مدير الحسابات',
  STAFF: 'موظف',
  CASHIER: 'كاشير',
};

const ROLE_LABELS_EN: Record<string, string> = {
  SUPER_ADMIN: 'General Manager',
  BRANCH_MANAGER: 'Branch Manager',
  FINANCE: 'Finance Manager',
  STAFF: 'Staff',
  CASHIER: 'Cashier',
};

export default function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const locale = useLocale();
  const pathname = usePathname() || '/admin';
  const tSetup = useTranslations('setup');
  const isAr = locale === 'ar';
  const [unreadCount, setUnreadCount] = useState(0);
  const [missingSetup, setMissingSetup] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.success) setUnreadCount(d.unreadCount);
      })
      .catch(() => { /* badge stays hidden on error */ });
    fetch('/api/admin/settings/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.success) setMissingSetup(d.missingCount);
      })
      .catch(() => { /* setup badge stays hidden on error */ });
    return () => { cancelled = true; };
  }, [pathname]);

  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  const roleLabel = role ? (isAr ? ROLE_LABELS_AR[role] ?? role : ROLE_LABELS_EN[role] ?? role) : '';
  const name = session?.user?.name || (isAr ? 'المدير العام' : 'General Manager');
  const email = session?.user?.email || '';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 sm:px-6" aria-label={isAr ? 'ترويسة لوحة التحكم' : 'Admin header'}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 lg:hidden"
          aria-label={isAr ? 'فتح قائمة التنقل' : 'Open navigation menu'}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="hidden min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-200 sm:flex">
          <UserRound className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="truncate">{roleLabel || (isAr ? 'لوحة التحكم' : 'Dashboard')}</span>
        </div>
        <AdminCommandPalette />
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs sm:gap-4">
        {missingSetup !== null && missingSetup > 0 && (
          <Link href="/admin/settings/setup" className="hidden min-h-10 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 font-bold text-amber-300 lg:inline-flex" title={tSetup('banner')}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{tSetup('banner')}: {missingSetup}</span>
          </Link>
        )}
        <div className="hidden min-h-10 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 font-bold text-emerald-400 xl:flex" title={isAr ? 'الربط الفعلي بمصلحة الضرائب غير مفعّل بعد' : 'Live ETA integration is not enabled yet'}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>{isAr ? 'ETA — تحتاج إعداد' : 'ETA — setup required'}</span>
        </div>

        <Link href="/admin/notifications" className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100" aria-label={isAr ? 'مركز التنبيهات' : 'Notification center'}>
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 && <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </Link>

        <ThemeToggle />
        <LocaleSwitcher />

        <div className="hidden min-w-0 items-center gap-3 border-r border-slate-800 pr-4 lg:flex">
          <div className="min-w-0 text-start">
            <div className="truncate font-bold text-slate-100">{name}</div>
            <div className="truncate text-[10px] text-slate-400" dir="ltr">{email}</div>
          </div>
          <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/20 text-rose-400 transition hover:bg-rose-500 hover:text-white" title={isAr ? 'تسجيل الخروج' : 'Sign out'} aria-label={isAr ? 'تسجيل الخروج' : 'Sign out'}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/20 text-rose-400 transition hover:bg-rose-500 hover:text-white lg:hidden" title={isAr ? 'تسجيل الخروج' : 'Sign out'} aria-label={isAr ? 'تسجيل الخروج' : 'Sign out'}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
