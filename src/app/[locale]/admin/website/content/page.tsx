import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function WebsiteContentPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  return <AdminPlannedPage titleAr="البنارات والصفحات" titleEn="Banners and content pages" descriptionAr="لا يوجد CMS أو Banner model في قاعدة البيانات حتى الآن. المتجر يعرض محتوى ثابتًا/مهيأًا، ولذلك يبقى المسار empty state واضحًا بدل إنشاء محتوى وهمي." descriptionEn="There is no CMS or banner model yet. The storefront uses seeded/static content, so this route remains an explicit empty state rather than fake content." actionHref="/" statusAr="قريبًا — بانتظار CMS" statusEn="Coming soon — waiting on the CMS" icon="database" />;
}
