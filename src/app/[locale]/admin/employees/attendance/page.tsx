import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function EmployeeAttendancePage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  return <AdminPlannedPage titleAr="الحضور والانصراف" titleEn="Employee attendance" descriptionAr="لا توجد بيانات حضور أو مصدر تسجيل (biometric/manual) حتى الآن. تم إبقاء المسار واضحًا كـ Empty State، مع اقتراح AttendanceSession في التقرير." descriptionEn="There is no attendance data or recording source yet. The route remains an explicit empty state; AttendanceSession is proposed in the report." actionHref="/admin/employees" status="قريبًا — بانتظار Backend" icon="database" />;
}
