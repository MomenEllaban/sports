import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="products" />{children}</>;
}
