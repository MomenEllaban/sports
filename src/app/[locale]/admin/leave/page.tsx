import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function LeavePage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  return <AdminPlannedPage titleAr="السلف والجزاءات والإجازات" titleEn="Advances, penalties and leave" descriptionAr="ستحتاج هذه الوحدة إلى ledger مستقل مرتبط بـ PayrollItem لتفادي خلط السلف مع الراتب. لم يتم إضافة نماذج أو حسابات مكررة حتى الآن." descriptionEn="This module needs a dedicated ledger linked to payroll items so advances are not mixed with salary. No duplicate models or calculations were added yet." actionHref="/admin/payroll" statusAr="قريبًا — قرار schema مطلوب" statusEn="Coming soon — schema decision pending" icon="database" />;
}
