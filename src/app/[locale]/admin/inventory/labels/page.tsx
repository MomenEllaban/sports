import React from 'react';
import { getLocale } from 'next-intl/server';
import { requirePageRole } from '@/lib/auth/require-page';
import LabelsClient from '@/components/admin/LabelsClient';

export const dynamic = 'force-dynamic';

export default async function LabelsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  // Products are fetched on demand from /api/admin/labels/search instead of
  // sending up to 2000 rows to the browser to filter client-side.
  return (
    <>
      <div className="border-b border-slate-800 pb-4 print:hidden">
        <h1 className="text-2xl font-black text-slate-100">
          {isAr ? 'طباعة ملصقات الباركود' : 'Print barcode labels'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAr
            ? 'يتم استخدام كود GS1 إن وجد، وإلا الباركود المسجل. EAN-8 وEAN-13 للأرقام الطويلة، وCODE128 لبقية الأكواد غير الرقمية.'
            : 'Uses the GS1 code when present, otherwise the stored barcode. EAN-8/EAN-13 for retail digit codes, CODE128 for anything else (including GTIN-14 and alphanumeric codes).'}
        </p>
      </div>
      <LabelsClient />
    </>
  );
}
