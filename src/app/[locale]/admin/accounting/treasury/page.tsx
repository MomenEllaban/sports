import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  return <AdminPlannedPage titleAr="الخزينة والبنوك" titleEn="Treasury and banks" descriptionAr="المصروفات وCOD متاحان، لكن لا يوجد BankAccount أو TreasuryMovement ledger، ولا يمكن تحميل أرصدة بنكية حقيقية بأمان من هذه الشاشة." descriptionEn="Expenses and COD exist, but there is no bank-account or treasury-movement ledger yet; real balances cannot be safely displayed here." actionHref="/admin/expenses" statusAr="قريبًا — بانتظار schema" statusEn="Coming soon — waiting on the schema" icon="database" />;
}
