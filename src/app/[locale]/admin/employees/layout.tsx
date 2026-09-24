import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function EmployeesLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="employees" />{children}</>;
}
