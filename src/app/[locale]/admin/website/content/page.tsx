import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';
import { parseStored } from '@/lib/settings-registry';
import WebsiteContentManager, {
  AnnouncementSettings,
  HeroBanner,
} from '@/components/admin/WebsiteContentManager';

export const dynamic = 'force-dynamic';

export default async function AdminWebsiteContentPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';

  const [announcementRow, bannersRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'cms.announcement' } }),
    prisma.setting.findUnique({ where: { key: 'cms.heroBanners' } }),
  ]);

  const defaultAnnouncement: AnnouncementSettings = {
    enabled: true,
    textAr: 'شحن مجاني على جميع الطلبات فوق 1000 جنيه لفترة محدودة!',
    textEn: 'Free shipping on all orders over 1000 EGP for a limited time!',
    link: '/products',
  };

  const initialAnnouncement = announcementRow
    ? (parseStored(announcementRow.value, defaultAnnouncement).value as AnnouncementSettings)
    : defaultAnnouncement;

  const parsedBanners = bannersRow ? (parseStored(bannersRow.value, []).value as HeroBanner[]) : [];
  const initialBanners = Array.isArray(parsedBanners) ? parsedBanners : [];

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'البنرات ومحتوى المتجر (Store Banners & CMS)' : 'Store Banners & CMS Content'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'تخصيص بنرات الواجهة الرئيسية، أشرطة الإعلانات الترويجية، وأزرار الشراء المباشرة'
            : 'Customize storefront hero banners, promotional announcement bars, and direct shopping CTAs'}
        </p>
      </div>

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-6 animate-fade-up">
        <WebsiteContentManager
          initialAnnouncement={initialAnnouncement}
          initialBanners={initialBanners}
        />
      </div>
    </>
  );
}
