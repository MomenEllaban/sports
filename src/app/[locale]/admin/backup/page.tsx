import React from 'react';
import AdminPlannedPage from '@/components/admin/AdminPlannedPage';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function BackupPage() {
  await requirePageRole('SUPER_ADMIN');
  return <AdminPlannedPage titleAr="النسخ الاحتياطي" titleEn="Backup and restore" descriptionAr="التشغيل التلقائي أو استعادة قاعدة البيانات عملية حساسة ولا يتم تفعيلها من المتصفح. يوصى بربط job خارجي موثق مع retention وencryption واختبار restore دوري." descriptionEn="Automated database backup and restore is sensitive and should not be triggered from the browser. Use a documented external job with retention, encryption, and periodic restore tests." actionHref="/admin/settings" status="لاحقًا — عملية تشغيلية" icon="database" />;
}
