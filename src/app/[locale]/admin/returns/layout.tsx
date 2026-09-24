import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="returns" />{children}</>;
}
