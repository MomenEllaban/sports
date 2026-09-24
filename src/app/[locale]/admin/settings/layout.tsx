import React from 'react';
import AdminSectionTabs from '@/components/admin/AdminSectionTabs';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <><AdminSectionTabs section="settings" />{children}</>;
}
