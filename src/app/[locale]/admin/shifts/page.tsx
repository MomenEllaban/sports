import React from 'react';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { Clock3 } from 'lucide-react';
import { requirePageRole } from '@/lib/auth/require-page';
import { DataTable } from '@/components/ui/foundation';

export const dynamic = 'force-dynamic';

export default async function AdminShiftsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const shifts = await prisma.shift.findMany({
    orderBy: { openedAt: 'desc' },
    take: 50,
    include: { branch: true, cashier: true, _count: { select: { sales: true } } },
  });
  const rows = shifts.map((s) => ({
    id: s.id,
    cashier: s.cashier.name,
    branch: s.branch.name,
    status: s.status,
    openedAt: s.openedAt.toLocaleString('ar-EG'),
    sales: s._count.sales,
    expected: num(s.expectedCash),
    actual: num(s.actualCash),
    diff: num(s.difference),
  }));

  return (
    <>
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
          <Clock3 className="w-6 h-6 text-amber-400" />
          تقرير الورديات والدرج
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">فتح/إغلاق، المتوقع مقابل المعدود، والفروق — أحدث 50 وردية</p>
      </div>
      <DataTable
        rows={rows}
        emptyTitle="لا توجد ورديات بعد"
        emptyHint="أول وردية تُفتح من شاشة الكاشير (POS) ستظهر هنا."
        columns={[
          { key: 'cashier', header: 'الكاشير', render: (r) => <span className="font-bold text-slate-200">{r.cashier}</span> },
          { key: 'branch', header: 'الفرع', render: (r) => r.branch },
          { key: 'status', header: 'الحالة', render: (r) => (
            <span className={`px-2 py-0.5 rounded-lg font-bold ${r.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              {r.status === 'OPEN' ? 'مفتوحة' : 'مغلقة'}
            </span>
          )},
          { key: 'sales', header: 'فواتير', render: (r) => r.sales },
          { key: 'expected', header: 'المتوقع', render: (r) => `${r.expected.toLocaleString()} ج.م` },
          { key: 'actual', header: 'المعدود', render: (r) => `${r.actual.toLocaleString()} ج.م` },
          { key: 'diff', header: 'الفرق', render: (r) => (
            <span className={`font-black ${r.diff < 0 ? 'text-rose-400' : r.diff > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}
            </span>
          )},
          { key: 'openedAt', header: 'الفتح', hideOnMobile: true, render: (r) => <span className="text-slate-400">{r.openedAt}</span> },
        ]}
      />
    </>
  );
}
