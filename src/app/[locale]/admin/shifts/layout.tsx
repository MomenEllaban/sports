import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function ShiftsLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="shifts" />{children}</>;
}
