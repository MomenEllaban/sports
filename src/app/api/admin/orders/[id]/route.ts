import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { OrderStatus } from '@prisma/client';
import { transitionOrder, OrderTransitionError } from '@/lib/orders/status';

const ORDER_STATUSES = Object.values(OrderStatus);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { orderStatus, paymentStatus, expectedFromStatus } = body;

    if (paymentStatus) {
      return NextResponse.json(
        { success: false, error: 'لا يتم تغيير حالة الدفع من مسار حالة الطلب؛ استخدم التسوية أو webhook' },
        { status: 400 },
      );
    }

    let order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (!canAccessBranch(session, order.branchId)) {
      return NextResponse.json({ success: false, error: 'الطلب خارج نطاق فروعك' }, { status: 403 });
    }

    // Order status goes through the state machine (T08). Direct RETURNED is
    // closed: all returns flow through the single Return Service (T-RMA).
    if (orderStatus) {
      if (!ORDER_STATUSES.includes(orderStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid order status' }, { status: 400 });
      }
      if (orderStatus === 'RETURNED') {
        return NextResponse.json(
          { success: false, error: 'استخدم مسار المرتجعات (/admin/returns) بدلاً من قلب الحالة مباشرة' },
          { status: 400 }
        );
      }
      try {
        const actorId = (session?.user as { id?: string } | undefined)?.id;
        await transitionOrder(
          id,
          orderStatus as OrderStatus,
          actorId,
          expectedFromStatus && Object.values(OrderStatus).includes(expectedFromStatus)
            ? expectedFromStatus as OrderStatus
            : undefined,
        );
      } catch (e) {
        const err = e as OrderTransitionError & { status?: number };
        return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
      }
      order = await prisma.order.findUniqueOrThrow({ where: { id } });
    }
    if (!orderStatus) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('Admin order update error:', e);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}
