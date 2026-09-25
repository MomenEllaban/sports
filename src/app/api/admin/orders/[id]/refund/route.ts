import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import {
  requestReturn, approveReturn, receiveReturn, executeRefund, ReturnError,
} from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';

/**
 * Full-order admin refund (T-RMA single path): builds a complete RMA case
 * (REQUESTED→APPROVED→RECEIVED→REFUND_PENDING) through the Return Service,
 * then executes the payout. Replaces the legacy direct transition.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown; amount?: unknown };
    const actorId = (session?.user as { id?: string })?.id;
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return apiError('NOT_FOUND', 'Order not found', 404);
    try {
      const { request, replay } = await requestReturn({
        orderId: id,
        channel: 'ADMIN',
        items: order.items.map((i) => ({ refId: i.id, productId: i.productId, quantity: i.quantity, reasonCode: 'OTHER' })),
        customerPhone: order.guestPhone,
        notes: typeof body.reason === 'string' ? body.reason : undefined,
        clientRequestId: `admin-full-${id}`,
        actorId,
        actorRole: session?.user?.role as string,
      });
      if (!replay) {
        await approveReturn(request.id, actorId);
        const fresh = await prisma.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
        await receiveReturn(request.id, actorId, fresh.items.map((ri) => ({
          returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK',
        })), {});
      }
      const full = await prisma.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { refunds: true } });
      const refundRow = full.refunds[0];
      const result = refundRow ? await executeRefund(refundRow.id).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'failed' })) : { ok: false as const, error: 'no refund' };
      return NextResponse.json({
        success: true,
        refund: refundRow ? { id: refundRow.id, status: refundRow.status, amount: refundRow.amount } : null,
        result,
      });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('admin/orders/[id]/refund', e);
    return apiError('INTERNAL_ERROR', 'تعذر طلب الاسترداد', 500);
  }
}
