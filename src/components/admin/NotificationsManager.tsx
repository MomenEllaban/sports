'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { apiFetch } from './ui';

interface NotifRow {
  id: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsManager({ notifications }: { notifications: NotifRow[] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const [error, setError] = useState('');

  const markOne = async (id: string) => {
    setError('');
    try {
      await apiFetch(`/api/admin/notifications/${id}`, 'PATCH', {});
      router.refresh();
    } catch {
      setError(t('operationFailed'));
    }
  };

  const markAll = async () => {
    setError('');
    try {
      await apiFetch('/api/admin/notifications/read-all', 'POST', {});
      router.refresh();
    } catch {
      setError(t('operationFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={markAll} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all">
          {t('markAllRead')}
        </button>
      </div>

      {error && <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>}

      {notifications.length === 0 ? (
        <div className="text-center text-xs text-slate-500 py-12">{t('noData')}</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 rounded-2xl border flex justify-between items-center gap-3 text-xs ${n.isRead ? 'bg-slate-900/50 border-slate-800/60' : 'bg-slate-900 border-blue-500/40'}`}>
              <div className="space-y-1">
                <div className="font-bold text-slate-100 flex items-center gap-2">
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                  {isAr ? n.titleAr : n.titleEn}
                </div>
                <div className="text-slate-400">{isAr ? n.messageAr : n.messageEn}</div>
              </div>
              {!n.isRead && (
                <button onClick={() => markOne(n.id)} className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-400 hover:text-white text-[11px] font-bold transition-all">
                  {t('markRead')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
