import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
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
      return apiError('VALIDATION_ERROR', 'لا يتم تغيير حالة الدفع من مسار حالة الطلب؛ استخدم التسوية أو webhook', 400);
    }

    let order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return apiError('NOT_FOUND', 'Order not found', 404);
    }
    if (!canAccessBranch(session, order.branchId)) {
      return apiError('FORBIDDEN', 'الطلب خارج نطاق فروعك', 403);
    }

    // Order status goes through the state machine (T08). Direct RETURNED is
    // closed: all returns flow through the single Return Service (T-RMA).
    if (orderStatus) {
      if (!ORDER_STATUSES.includes(orderStatus)) {
        return apiError('VALIDATION_ERROR', 'Invalid order status', 400);
      }
      if (orderStatus === 'RETURNED') {
        return apiError('VALIDATION_ERROR', 'استخدم مسار المرتجعات (/admin/returns) بدلاً من قلب الحالة مباشرة', 400);
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
        return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
      }
      order = await prisma.order.findUniqueOrThrow({ where: { id } });
    }
    if (!orderStatus) {
      return apiError('VALIDATION_ERROR', 'Nothing to update', 400);
    }

    return NextResponse.json({ success: true, order });
  } catch (e) {
    captureError('api/admin/orders/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to update order', 500);
  }
}
