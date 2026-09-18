import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { prisma } from '@/lib/db';
import { Bell, AlertTriangle, ShoppingBag, ShieldAlert } from 'lucide-react';

export const revalidate = 10;

export default async function AdminNotificationsPage() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
                <Bell className="w-6 h-6 text-rose-400" />
                مركز الإشعارات والتنبيهات
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                سجل إشعارات الطلبات الجديدة، النواقص، وتحديثات مصلحة الضرائب
              </p>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            {notifications.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-12">
                لا توجد إشعارات جديدة حالياً.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-100">{n.titleAr}</div>
                      <div className="text-slate-400">{n.messageAr}</div>
                    </div>
                    <span className="text-[10px] text-slate-500">{n.createdAt.toLocaleTimeString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
