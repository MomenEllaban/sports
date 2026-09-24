import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="reports" />{children}</>;
}
