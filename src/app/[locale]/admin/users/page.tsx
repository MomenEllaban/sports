import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import UsersManager from '@/components/admin/UsersManager';
import { prisma } from '@/lib/db';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        branchIds: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex dir-rtl">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
                <ShieldCheck className="w-7 h-7 text-blue-500" />
                Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ† ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Ø¥Ø¯Ø§Ø±Ø© Ø­Ø³Ø§Ø¨Ø§Øª Ù…ÙˆØ¸ÙÙŠ Ø§Ù„ÙØ±ÙˆØ¹ØŒ Ø§Ù„ÙƒØ§Ø´ÙŠØ±ØŒ Ø§Ù„Ù…Ø­Ø§Ø³Ø¨ÙŠÙ†ØŒ ÙˆØ§Ù„Ù…Ø¯ÙŠØ±ÙŠÙ† ÙˆØªÙˆØ²ÙŠØ¹ Ø§Ù„Ø£Ø¯ÙˆØ§Ø±
              </p>
            </div>
            <span className="px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-xs">
              Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª: {users.length}
            </span>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 animate-fade-up">
            <UsersManager
              users={users.map((u) => ({
                ...u,
                createdAt: u.createdAt.toISOString(),
              }))}
              branches={branches}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
