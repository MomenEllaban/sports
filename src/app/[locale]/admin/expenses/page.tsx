import React from 'react';
import ExpensesManager from '@/components/admin/ExpensesManager';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import { WalletCards } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminExpensesPage() {
  await requirePageRole('SUPER_ADMIN', 'FINANCE');
  const [expenses, branches] = await Promise.all([
    prisma.expense.findMany({ orderBy: { createdAt: 'desc' }, include: { branch: true } }),
    prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, nameEn: true } }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-100"><WalletCards className="h-6 w-6 text-rose-400" />المصروفات والإيرادات</h1>
          <p className="mt-1 text-xs text-slate-400">تسجيل المصروفات التشغيلية لكل فرع مع تعديل وحذف محاسبي.</p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-xs font-bold text-slate-300">{expenses.length} قيد</span>
      </div>
      <section className="glass-panel rounded-3xl border border-slate-800 p-4 sm:p-6">
        <ExpensesManager expenses={expenses.map((e) => ({ ...e, amount: num(e.amount) }))} branches={branches} />
      </section>
    </>
  );
}
