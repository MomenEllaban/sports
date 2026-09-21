import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { requestRefund, processRefund, RefundError } from '@/lib/refunds/service';
import { captureError } from '@/lib/monitor';

/**
 * Request a refund (T10 wizard confirm): order → RETURNED + restock in one
 * transaction, then best-effort gateway processing (retried via outbox).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown; amount?: unknown };
    const actorId = (session?.user as { id?: string })?.id;
    let request;
    try {
      request = await requestRefund(
        id,
        actorId,
        typeof body.reason === 'string' ? body.reason : undefined,
        body.amount === undefined ? undefined : Number(body.amount)
      );
    } catch (e) {
      const err = e as RefundError & { status?: number };
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }
    // Best-effort immediate processing; failures stay PENDING/FAILED for retry.
    const result = await processRefund(request.id).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'failed' }));
    return NextResponse.json({ success: true, refund: { id: request.id, status: request.status, amount: request.amount }, result });
  } catch (e) {
    captureError('admin/orders/[id]/refund', e);
    return NextResponse.json({ success: false, error: 'تعذر طلب الاسترداد' }, { status: 500 });
  }
}
