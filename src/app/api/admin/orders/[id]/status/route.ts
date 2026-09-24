import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { transitionOrder, OrderTransitionError } from '@/lib/orders/status';
import { isOrderStatus, type OrderTransitionValue } from '@/lib/orders/transitions';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = await req.json() as { toStatus?: unknown; expectedFromStatus?: unknown };

    if (!isOrderStatus(String(body.toStatus)) || !isOrderStatus(String(body.expectedFromStatus))) {
      return NextResponse.json({ success: false, error: 'Invalid order status transition' }, { status: 400 });
    }
    if (String(body.toStatus) === 'RETURNED') {
      return NextResponse.json(
        { success: false, error: 'استخدم مسار المرتجعات بدلاً من تغيير الحالة مباشرة' },
        { status: 400 },
      );
    }

    const existing = await prisma.order.findUnique({ where: { id }, select: { branchId: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (!canAccessBranch(session, existing.branchId)) {
      return NextResponse.json({ success: false, error: 'الطلب خارج نطاق فروعك' }, { status: 403 });
    }

    try {
      const result = await transitionOrder(
        id,
        String(body.toStatus) as OrderTransitionValue,
        session?.user?.id,
        String(body.expectedFromStatus) as OrderTransitionValue,
      );
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      const transitionError = error as OrderTransitionError & { status?: number };
      return NextResponse.json(
        { success: false, error: transitionError.message },
        { status: transitionError.status || 400 },
      );
    }
  } catch (error) {
    console.error('Admin order status update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update order status' }, { status: 500 });
  }
}
