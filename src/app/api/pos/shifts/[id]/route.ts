import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole, POS_ROLES } from '@/lib/auth/guards';
import { closeShift, expectedCashFor, ShiftError } from '@/lib/shifts/service';
import { getSetting } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { captureError } from '@/lib/monitor';

/** Close wizard preview: expected cash + shortage tolerance. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;
    const { id } = await params;
    const shift = await prisma.shift.findUnique({ where: { id }, include: { branch: true, cashier: true } });
    const cashierId = (session?.user as { id?: string })?.id;
    const role = session?.user?.role;
    const isPrivileged = role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER' || role === 'FINANCE';
    if (!shift || (!isPrivileged && shift.cashierId !== cashierId)) {
      return apiError('NOT_FOUND', 'الوردية غير موجودة', 404);
    }
    if (shift.status !== 'OPEN') return apiError('CONFLICT', 'الوردية مغلقة بالفعل', 409);
    const expected = await expectedCashFor(shift.id, num(shift.openingFloat));
    const maxShortage = await getSetting<number>('shifts.maxShortage', 50).catch(() => 50);
    const cashRefunds = await prisma.refund.aggregate({
      where: { shiftId: shift.id, status: 'DONE', method: 'CASH' },
      _sum: { amount: true },
    });
    return NextResponse.json({ success: true, expected, openingFloat: num(shift.openingFloat), maxShortage, openedAt: shift.openedAt, cashRefunded: num(cashRefunds._sum.amount) });
  } catch (e) {
    captureError('pos/shifts/[id] GET', e);
    return apiError('INTERNAL_ERROR', 'تعذر جلب الوردية', 500);
  }
}

/** Close a shift: counted cash + mandatory note when over tolerance. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;
    const { id } = await params;
    const cashierId = (session?.user as { id?: string })?.id;
    const role = session?.user?.role;
    if (!cashierId) return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    const isPrivileged = role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER' || role === 'FINANCE';
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift || (!isPrivileged && shift.cashierId !== cashierId)) {
      return apiError('NOT_FOUND', 'الوردية غير موجودة', 404);
    }
    const body = await req.json();
    const maxShortage = await getSetting<number>('shifts.maxShortage', 50).catch(() => 50);
    const closeNote = isPrivileged && shift.cashierId !== cashierId
      ? `[إغلاق إداري بواسطة ${session?.user?.name || role}]: ${body.closeNote || 'تسوية إدارية'}`
      : typeof body.closeNote === 'string' ? body.closeNote : undefined;
    try {
      const r = await closeShift({
        shiftId: id,
        cashierId: shift.cashierId,
        actualCash: Number(body.actualCash),
        closeNote,
        maxShortage,
      });
      return NextResponse.json({ success: true, ...r });
    } catch (e) {
      if (e instanceof ShiftError) return apiError('REQUEST_FAILED', String(e.message), e.status);
      throw e;
    }
  } catch (e) {
    captureError('pos/shifts/[id] POST', e);
    return apiError('INTERNAL_ERROR', 'تعذر إغلاق الوردية', 500);
  }
}
