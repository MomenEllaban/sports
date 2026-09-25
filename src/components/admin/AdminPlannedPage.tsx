import React from 'react';
import AdminEmptyState from './AdminEmptyState';

export default async function AdminPlannedPage({
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  actionHref = '/admin',
  statusAr = 'قريبًا — بنية المسار جاهزة',
  statusEn = 'Coming soon — route scaffold ready',
  icon = 'construction',
}: {
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  actionHref?: string;
  statusAr?: string;
  statusEn?: string;
  icon?: 'construction' | 'database' | 'shield';
}) {
  return <AdminEmptyState titleAr={titleAr} titleEn={titleEn} descriptionAr={descriptionAr} descriptionEn={descriptionEn} actionHref={actionHref} statusAr={statusAr} statusEn={statusEn} icon={icon} />;
}
