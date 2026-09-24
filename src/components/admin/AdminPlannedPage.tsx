import React from 'react';
import AdminEmptyState from './AdminEmptyState';

export default function AdminPlannedPage({
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  actionHref = '/admin',
  status = 'قريبًا — بنية المسار جاهزة',
  icon = 'construction',
}: {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  actionHref?: string;
  status?: string;
  icon?: 'construction' | 'database' | 'shield';
}) {
  return <AdminEmptyState titleAr={titleAr} titleEn={titleEn} descriptionAr={descriptionAr} descriptionEn={descriptionEn} actionHref={actionHref} status={status} icon={icon} />;
}
