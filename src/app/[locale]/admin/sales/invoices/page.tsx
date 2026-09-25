import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function SalesInvoicesPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  return <AdminPlannedPage titleAr="عروض الأسعار والفواتير" titleEn="Quotes and invoices" descriptionAr="المسار محجوز لتWorkflow lifecycle لعروض الأسعار والفواتير، وسيحتاج Quote وInvoice Payment ledger قبل تفعيل التحرير." descriptionEn="Reserved for the quote and invoice lifecycle; a quote model and payment ledger are required before editing can be enabled." actionHref="/admin/orders" statusAr="قريبًا — بدون Backend وهمي" statusEn="Coming soon — no mock backend" />;
}
