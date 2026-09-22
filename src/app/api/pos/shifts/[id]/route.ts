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
    const shift = await prisma.shift.findUnique({ where: { id } });
    const cashierId = (session?.user as { id?: string })?.id;
    if (!shift || shift.cashierId !== cashierId) return NextResponse.json({ success: false, error: 'الوردية غير موجودة' }, { status: 404 });
    if (shift.status !== 'OPEN') return NextResponse.json({ success: false, error: 'الوردية مغلقة بالفعل' }, { status: 409 });
    const expected = await expectedCashFor(shift.id, num(shift.openingFloat));
    const maxShortage = await getSetting<number>('shifts.maxShortage', 50).catch(() => 50);
    const cashRefunds = await prisma.refund.aggregate({
      where: { shiftId: shift.id, status: 'DONE', method: 'CASH' },
      _sum: { amount: true },
    });
    return NextResponse.json({ success: true, expected, openingFloat: num(shift.openingFloat), maxShortage, openedAt: shift.openedAt, cashRefunded: num(cashRefunds._sum.amount) });
  } catch (e) {
    captureError('pos/shifts/[id] GET', e);
    return NextResponse.json({ success: false, error: 'تعذر جلب الوردية' }, { status: 500 });
  }
}

/** Close a shift: counted cash + mandatory note when over tolerance. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;
    const { id } = await params;
    const cashierId = (session?.user as { id?: string })?.id;
    if (!cashierId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const maxShortage = await getSetting<number>('shifts.maxShortage', 50).catch(() => 50);
    try {
      const r = await closeShift({
        shiftId: id,
        cashierId,
        actualCash: Number(body.actualCash),
        closeNote: typeof body.closeNote === 'string' ? body.closeNote : undefined,
        maxShortage,
      });
      return NextResponse.json({ success: true, ...r });
    } catch (e) {
      if (e instanceof ShiftError) return NextResponse.json({ success: false, error: e.message }, { status: e.status });
      throw e;
    }
  } catch (e) {
    captureError('pos/shifts/[id] POST', e);
    return NextResponse.json({ success: false, error: 'تعذر إغلاق الوردية' }, { status: 500 });
  }
}
