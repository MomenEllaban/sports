import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import NotificationsManager from '@/components/admin/NotificationsManager';
import { prisma } from '@/lib/db';
import { Bell } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE', 'BRANCH_MANAGER', 'CASHIER', 'STAFF');
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const serializable = notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
              <Bell className="w-6 h-6 text-rose-400" />
              مركز الإشعارات والتنبيهات
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">سجل إشعارات الطلبات الجديدة، النواقص، وتحديثات مصلحة الضرائب</p>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <NotificationsManager notifications={serializable} />
          </div>
        </main>
      </div>
    </div>
  );
}
