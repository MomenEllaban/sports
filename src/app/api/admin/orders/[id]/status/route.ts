import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
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
      return apiError('VALIDATION_ERROR', 'Invalid order status transition', 400);
    }
    if (String(body.toStatus) === 'RETURNED') {
      return apiError('VALIDATION_ERROR', 'استخدم مسار المرتجعات بدلاً من تغيير الحالة مباشرة', 400);
    }

    const existing = await prisma.order.findUnique({ where: { id }, select: { branchId: true } });
    if (!existing) return apiError('NOT_FOUND', 'Order not found', 404);
    if (!canAccessBranch(session, existing.branchId)) {
      return apiError('FORBIDDEN', 'الطلب خارج نطاق فروعك', 403);
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
      return apiError('REQUEST_FAILED', String(transitionError.message), transitionError.status || 400);
    }
  } catch (error) {
    captureError('api/admin/orders/[id]/status', error);
    return apiError('INTERNAL_ERROR', 'Failed to update order status', 500);
  }
}
