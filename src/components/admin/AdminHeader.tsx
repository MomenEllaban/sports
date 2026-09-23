'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { Bell, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from '@/i18n/routing';
import ThemeToggle from './ThemeToggle';
import { LocaleSwitcher } from '@/components/ui/foundation';
import { useTranslations } from 'next-intl';

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

export default function AdminHeader() {
  const { data: session } = useSession();
  const locale = useLocale();
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
      .catch(() => { /* silent: badge stays hidden on error */ });
    fetch('/api/admin/settings/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.success) setMissingSetup(d.missingCount);
      })
      .catch(() => { /* silent: banner stays hidden on error */ });
    return () => { cancelled = true; };
  }, []);

  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  const roleLabel = role ? (isAr ? ROLE_LABELS_AR[role] ?? role : ROLE_LABELS_EN[role] ?? role) : '';

  const name =
    session?.user?.name || (isAr ? 'المدير العام' : 'General Manager');
  const email = session?.user?.email || '';

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
      {/* Role Label */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200">
          <UserRound className="w-4 h-4 text-amber-400" />
          <span>{roleLabel || (isAr ? 'لوحة التحكم' : 'Dashboard')}</span>
        </div>
      </div>

      {/* Notifications & User Session Actions */}
      <div className="flex items-center gap-4 text-xs">
        {missingSetup !== null && missingSetup > 0 && (
          <Link
            href="/admin/settings/setup"
            className="min-h-[44px] flex items-center gap-1.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{tSetup('banner')}: {missingSetup}</span>
          </Link>
        )}
        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30 font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>{isAr ? 'منظومة الضرائب ETA مقفلة' : 'ETA tax system (disabled)'}</span>
        </div>

        {/* Notifications Bell */}
        <Link
          href="/admin/notifications"
          className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Language (F0 §1.3) */}
        <LocaleSwitcher />

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
          <div className="text-right hidden sm:block">
            <div className="font-bold text-slate-100">{name}</div>
            <div className="text-[10px] text-slate-400">{email}</div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/30"
            title={isAr ? 'تسجيل الخروج' : 'Sign out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
