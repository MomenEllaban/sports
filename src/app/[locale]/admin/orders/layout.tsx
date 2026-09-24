import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="orders" />{children}</>;
}
