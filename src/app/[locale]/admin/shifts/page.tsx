import React from 'react';
import { getLocale } from 'next-intl/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requirePageRole } from '@/lib/auth/require-page';
import ShiftsManager, { type ShiftRow } from '@/components/admin/ShiftsManager';

export const dynamic = 'force-dynamic';

export default async function AdminShiftsPage() {
  await requirePageRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
  const isAr = (await getLocale()) === 'ar';

  const [shifts, branches] = await Promise.all([
    prisma.shift.findMany({
      orderBy: { openedAt: 'desc' },
      take: 100,
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        cashier: { select: { id: true, name: true, email: true } },
        _count: { select: { sales: true } },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameEn: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const initialShifts: ShiftRow[] = shifts.map((s) => ({
    id: s.id,
    cashierId: s.cashierId,
    cashierName: s.cashier?.name || (isAr ? 'كاشير غير محدد' : 'Unassigned cashier'),
    cashierEmail: s.cashier?.email || '',
    branchId: s.branchId,
    branchName: s.branch?.name || (isAr ? 'فرع غير محدد' : 'Unassigned branch'),
    branchNameEn: s.branch?.nameEn || s.branch?.name || (isAr ? 'فرع غير محدد' : 'Unassigned branch'),
    status: s.status as 'OPEN' | 'CLOSED',
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt ? s.closedAt.toISOString() : null,
    openingFloat: num(s.openingFloat),
    expectedCash: num(s.expectedCash),
    actualCash: num(s.actualCash),
    difference: num(s.difference),
    openNote: s.openNote,
    closeNote: s.closeNote,
    salesCount: s._count.sales,
  }));

  return <ShiftsManager initialShifts={initialShifts} branches={branches} />;
}
