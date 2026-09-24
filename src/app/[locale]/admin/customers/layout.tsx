import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="customers" />{children}</>;
}
