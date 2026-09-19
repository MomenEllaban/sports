import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import EmployeesManager from '@/components/admin/EmployeesManager';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesPage() {
  const [employees, branches] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branch: { select: { id: true, name: true, nameEn: true } } },
    }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div>
            <h1 className="text-2xl font-black text-slate-100">Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ† ÙˆØ§Ù„ÙƒØ§Ø¯Ø± Ø§Ù„ÙˆØ¸ÙŠÙÙŠ</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Ø¥Ø¶Ø§ÙØ© ÙˆØªØ¹Ø¯ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ† Ù„ÙƒÙ„ ÙØ±Ø¹ â€” Ø§Ù„Ø±Ø§ØªØ¨ ÙˆØ§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ ÙˆÙ†Ø³Ø¨Ø© Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©
            </p>
          </div>

          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden p-4 animate-fade-up">
            <EmployeesManager employees={employees} branches={branches} />
          </div>
        </main>
      </div>
    </div>
  );
}
