import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  return <AdminPlannedPage titleAr="الحضور والانصراف" titleEn="Attendance" descriptionAr="المسار جاهز، لكن لا يوجد نموذج Attendance أو جهاز بصمة مربوط حاليًا. لن يتم عرض حضوارات وهمية؛ seep التوصية في تقرير النظام." descriptionEn="The route is ready, but no attendance or biometric device integration exists. No fake attendance data is shown; see the system report recommendation." actionHref="/admin/employees" status="قريبًا — بانتظار Backend" icon="database" />;
}
