'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Bell, MapPin, LogOut, ShieldCheck, User } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default function AdminHeader() {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
      {/* Branch Selector Display */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200">
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>فرع الإبراهيمية الرئيسي (92 شارع عمر لطفى)</span>
        </div>
      </div>

      {/* Notifications & User Session Actions */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30 font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>منظومة الضرائب ETA: جاهزة</span>
        </div>

        {/* Notifications Bell */}
        <Link
          href="/admin/notifications"
          className="relative p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            2
          </span>
        </Link>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
          <div className="text-right hidden sm:block">
            <div className="font-bold text-slate-100">
              {session?.user?.name || 'أحمد الإبراهيمي'}
            </div>
            <div className="text-[10px] text-slate-400">
              {session?.user?.email || 'admin@sportschampions.eg'}
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white transition-all border border-rose-500/30"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
