import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { captureError } from '@/lib/monitor';

/** List refund requests (T10) for the orders screen / reports. */
export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const rows = await prisma.refundRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { order: { select: { orderNumber: true, paymentMethod: true, branchId: true } } },
    });
    return NextResponse.json({
      success: true,
      refunds: rows.map((r) => ({ ...r, amount: num(r.amount) })),
    });
  } catch (e) {
    captureError('admin/refunds GET', e);
    return NextResponse.json({ success: false, error: 'تعذر جلب الاستردادات' }, { status: 500 });
  }
}
