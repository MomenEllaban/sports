import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function SupplierReturnsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  return <AdminPlannedPage titleAr="مرتجعات الموردين" titleEn="Supplier returns" descriptionAr="يوجد endpoint لاسترداد أصناف أمر شراء، لكن لا توجد شاشة دورة حياة مستقلة للطلب والخصم من المورد. ستُضاف بعد تثبيت PurchaseReturn schema." descriptionEn="A purchase-order return endpoint exists, but there is no independent return lifecycle screen or supplier credit workflow. It will follow the PurchaseReturn schema." actionHref="/admin/purchasing" statusAr="جزئي — API أولية" statusEn="Partial — preliminary API" icon="database" />;
}
