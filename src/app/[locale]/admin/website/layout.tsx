import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="website-content" />{children}</>;
}
