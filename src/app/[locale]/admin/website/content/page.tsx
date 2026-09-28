import React from 'react';
import { getLocale } from 'next-intl/server';
import { requirePageRole } from '@/lib/auth/require-page';
import WebsiteContentManager from '@/components/admin/WebsiteContentManager';
import { DEFAULT_ANNOUNCEMENT, readAnnouncement, readHeroBanners } from '@/lib/website/cms';
import { Link } from '@/i18n/routing';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminWebsiteContentPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  // Read through the same helpers the storefront uses, so the editor shows
  // exactly what a visitor will see (including the sanitising and fallbacks).
  const [announcement, banners] = await Promise.all([
    readAnnouncement(),
    readHeroBanners(isAr ? 'ar' : 'en'),
  ]);
  const activeBanners = banners.filter((b) => b.isActive).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100">
            {isAr ? 'محتوى المتجر (Store CMS)' : 'Storefront Content (CMS)'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'ما تحفظه هنا يظهر مباشرة في الصفحة الرئيسية للمتجر — البنرات وشريط الإعلانات'
              : 'What you save here appears on the storefront homepage — hero slides and the announcement bar'}
          </p>
        </div>

        <Link
          href="/"
          target="_blank"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {isAr ? 'معاينة المتجر' : 'Preview storefront'}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-bold text-blue-300">
          {isAr
            ? `${activeBanners} شريحة نشطة من ${banners.length}`
            : `${activeBanners} active of ${banners.length} slides`}
        </span>
        <span
          className={`rounded-full border px-3 py-1 font-bold ${
            announcement.enabled
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-700 bg-slate-800 text-slate-400'
          }`}
        >
          {announcement.enabled
            ? isAr
              ? 'شريط الإعلانات مفعّل'
              : 'Announcement bar is on'
            : isAr
              ? 'شريط الإعلانات معطّل'
              : 'Announcement bar is off'}
        </span>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <WebsiteContentManager
          initialAnnouncement={announcement}
          initialBanners={banners}
        />
      </div>

      <p className="text-[11px] text-slate-500">
        {isAr
          ? `الافتراضي: "${DEFAULT_ANNOUNCEMENT.textAr}". الروابط يجب أن تكون داخلية تبدأ بـ / ، مثل /catalog`
          : `Default: "${DEFAULT_ANNOUNCEMENT.textEn}". Links must be internal and start with / , e.g. /catalog`}
      </p>
    </>
  );
}
