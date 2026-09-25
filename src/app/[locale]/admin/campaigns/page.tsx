import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  return <AdminPlannedPage titleAr="الحملات والرسائل التسويقية" titleEn="Marketing campaigns and messages" descriptionAr="لم يتم بناء Campaign/Segment/Dispatch ledger بعد، لذلك لا توجد بيانات تجريبية أو أزرار مضللة. يمكن ربطه لاحقًا بم nanopayments وWhatsApp templates." descriptionEn="Campaign, segment, and dispatch ledgers are not implemented yet; no mock data or misleading actions are exposed." actionHref="/admin/coupons" statusAr="قريبًا — بانتظار schema" statusEn="Coming soon — waiting on the schema" icon="database" />;
}
