import React from 'react';
import { requirePageRole } from '@/lib/auth/require-page';
import NewReturnClient from '@/components/admin/NewReturnClient';

export const dynamic = 'force-dynamic';

export default async function NewReturnPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER');
  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100">طلب مرتجع جديد</h1>
        <p className="text-xs text-slate-400 mt-0.5">ابحث بالطلب أو فاتورة POS ثم حدد الأصناف والأسباب</p>
      </div>
      <NewReturnClient />
    </>
  );
}
