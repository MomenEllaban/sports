import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole, POS_ROLES } from '@/lib/auth/guards';
import { getOpenShift, openShift, ShiftError } from '@/lib/shifts/service';
import { getSetting } from '@/lib/settings';
import { captureError } from '@/lib/monitor';

/** Current open shift (or null) for the POS gate. */
export async function GET() {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;
    const cashierId = (session?.user as { id?: string })?.id;
    if (!cashierId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const shift = await getOpenShift(cashierId);
    if (!shift) return NextResponse.json({ success: true, shift: null });
    return NextResponse.json({
      success: true,
      shift: { id: shift.id, branchId: shift.branchId, branchName: shift.branch.name, openedAt: shift.openedAt, openingFloat: num(shift.openingFloat) },
    });
  } catch (e) {
    captureError('pos/shifts GET', e);
    return NextResponse.json({ success: false, error: 'تعذر جلب الوردية' }, { status: 500 });
  }
}

/** Open a shift (wizard step 1): branch + counted opening float. */
export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole(...POS_ROLES);
    if (error) return error;
    const cashierId = (session?.user as { id?: string })?.id;
    if (!cashierId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const role = session!.user?.role;
    let branchId = typeof body.branchId === 'string' ? body.branchId : null;
    if (role === 'CASHIER') {
      const me = await prisma.user.findUnique({ where: { id: cashierId } });
      branchId = me?.branchId || null;
    }
    if (!branchId) return NextResponse.json({ success: false, error: 'حدد الفرع أولاً' }, { status: 422 });
    const fallbackFloat = await getSetting<number>('shifts.openingFloat', 500).catch(() => 500);
    const openingFloat = body.openingFloat === undefined ? fallbackFloat : Number(body.openingFloat);
    try {
      const shift = await openShift({ branchId, cashierId, openingFloat, openNote: typeof body.openNote === 'string' ? body.openNote : undefined });
      return NextResponse.json({ success: true, shift: { id: shift.id, branchId: shift.branchId, openedAt: shift.openedAt, openingFloat: num(shift.openingFloat) } });
    } catch (e) {
      if (e instanceof ShiftError) return NextResponse.json({ success: false, error: e.message }, { status: e.status });
      throw e;
    }
  } catch (e) {
    captureError('pos/shifts POST', e);
    return NextResponse.json({ success: false, error: 'تعذر فتح الوردية' }, { status: 500 });
  }
}
