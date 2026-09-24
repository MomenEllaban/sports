import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="accounting" />{children}</>;
}
