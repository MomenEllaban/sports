import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AbandonedCartsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  return <AdminPlannedPage titleAr="السلات المتروكة" titleEn="Abandoned carts" descriptionAr="السلة الحالية العميلة محفوظة في متصفح المستخدم فقط ولا يوجد event store على السيرفر، لذلك لا يمكن عرض Recovery funnel أو إرسال رابط استرجاع قبل إضافة CartSession/Event." descriptionEn="The current cart is browser-local and has no server event store, so recovery funnels and reminders cannot be shown before adding CartSession/Event models." actionHref="/admin/coupons" status="قريبًا — بانتظار instrumentation" icon="database" />;
}
