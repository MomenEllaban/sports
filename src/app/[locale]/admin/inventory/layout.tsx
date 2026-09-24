import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="inventory" />{children}</>;
}
