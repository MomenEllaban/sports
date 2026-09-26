import React from 'react';
import AttendancePage from '../../attendance/page';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function EmployeeAttendancePage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  return <AttendancePage />;
}
