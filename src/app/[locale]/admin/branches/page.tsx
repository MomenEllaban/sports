import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import BranchManager from '@/components/admin/BranchManager';
import { prisma } from '@/lib/db';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminBranchesPage() {
  await requirePageRole('SUPER_ADMIN');
  const branches = await prisma.branch.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100">إدارة الفروع ونقاط البيع</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              إنشاء فرع يولّد أرصدة مخزون صفرية لكل الأصناف تلقائياً — التعطيل محظور أثناء وجود مخزون
            </p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <BranchManager branches={branches} />
          </div>
        </main>
      </div>
    </div>
  );
}
