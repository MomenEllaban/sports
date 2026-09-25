import React from 'react';
import { getLocale } from 'next-intl/server';
import { requirePageRole } from '@/lib/auth/require-page';
import NewReturnClient from '@/components/admin/NewReturnClient';

export const dynamic = 'force-dynamic';

export default async function NewReturnPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  const isAr = (await getLocale()) === 'ar';
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">{isAr ? 'طلب مرتجع جديد' : 'New return request'}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{isAr ? 'ابحث بالطلب أو فاتورة POS ثم حدد الأصناف والأسباب' : 'Search by order or POS sale, then select items and reasons'}</p>
      </div>
      <NewReturnClient />
    </>
  );
}
