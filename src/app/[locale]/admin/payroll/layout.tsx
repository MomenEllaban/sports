import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="payroll" />{children}</>;
}
