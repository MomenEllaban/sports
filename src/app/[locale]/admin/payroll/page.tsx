import React from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import PayrollManager from '@/components/admin/PayrollManager';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminPayrollPage() {
  const [employees, runs] = await Promise.all([
    prisma.employee.findMany({ include: { branch: true } }),
    prisma.payrollRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { employee: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />

        <main className="p-6 space-y-6 overflow-y-auto">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black text-slate-100">Ù…Ø±ØªØ¨Ø§Øª Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ† ÙˆØ§Ù„Ø¹Ù…ÙˆÙ„Ø§Øª (Payroll System)</h1>
            <p className="text-xs text-slate-400 mt-0.5">Ø¥Ø¯Ø§Ø±Ø© Ø£Ø¬ÙˆØ± Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ† Ø¨Ø§Ù„ÙØ±ÙˆØ¹ ÙˆØ§Ù„Ù†Ø³Ø¨ Ø§Ù„Ù…Ø¤ÙˆÙŠØ© Ù…Ù† Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª (Commissions)</p>
          </div>

          {/* Employees List */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-100">ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„ ÙˆÙ…Ø³ØªØ­Ù‚Ø§Øª Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù</th>
                    <th className="p-3">Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ</th>
                    <th className="p-3">Ø§Ù„ÙØ±Ø¹</th>
                    <th className="p-3">Ø§Ù„Ø±Ø§ØªØ¨ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ</th>
                    <th className="p-3">Ù†Ø³Ø¨Ø© Ø§Ù„Ø¹Ù…ÙˆÙ„Ø©</th>
                    <th className="p-3">Ø§Ù„Ø­Ø§Ù„Ø©</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-900/50">
                      <td className="p-3 font-bold text-slate-100">{emp.name}</td>
                      <td className="p-3 text-slate-300">{emp.roleTitle}</td>
                      <td className="p-3 text-slate-400">{emp.branch.name}</td>
                      <td className="p-3 font-black text-emerald-400">{emp.salary.toLocaleString()} Ø¬.Ù…</td>
                      <td className="p-3 font-bold text-amber-400">{(emp.commissionRate * 100).toFixed(0)}% Ù…Ù† Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Ù†Ø´Ø·</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 animate-fade-up">
            <PayrollManager runs={runs} />
          </div>
        </main>
      </div>
    </div>
  );
}
