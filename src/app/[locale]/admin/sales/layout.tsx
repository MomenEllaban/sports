import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminSectionTabs section="sales-invoices" />
      {children}
    </>
  );
}
