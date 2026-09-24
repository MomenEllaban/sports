import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function PurchasingLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="purchasing" />{children}</>;
}
