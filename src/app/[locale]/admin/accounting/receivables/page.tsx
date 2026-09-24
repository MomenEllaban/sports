import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  return <AdminPlannedPage titleAr="ذمم العملاء والموردين" titleEn="Receivables and payables" descriptionAr="تحتاج الوحدة إلى Aging buckets وdue dates/reminders ومصدر تسوية موحد. لم يتم احتساب أرقام تقديرية من بيانات غير مكتملة." descriptionEn="This module needs aging buckets, due dates and a unified settlement source. No estimates are calculated from incomplete data." actionHref="/admin/accounting" status="قريبًا — بانتظار ledger" icon="database" />;
}
