import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { transitionOrder, OrderTransitionError } from '@/lib/orders/status';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;

    const existing = await prisma.order.findUnique({ where: { id }, select: { branchId: true, orderStatus: true } });
    if (!existing) return apiError('NOT_FOUND', 'Order not found', 404);
    if (!canAccessBranch(session, existing.branchId)) {
      return apiError('FORBIDDEN', 'الطلب خارج نطاق فروعك', 403);
    }

    try {
      const result = await transitionOrder(
        id,
        'CANCELLED',
        session?.user?.id,
        existing.orderStatus,
      );
      return NextResponse.json({ success: true, ...result });
    } catch (err) {
      const transitionError = err as OrderTransitionError & { status?: number };
      return apiError('REQUEST_FAILED', String(transitionError.message), transitionError.status || 400);
    }
  } catch (error) {
    captureError('api/admin/orders/[id]/cancel', error);
    return apiError('INTERNAL_ERROR', 'Failed to cancel order', 500);
  }
}
