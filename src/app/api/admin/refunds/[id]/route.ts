import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { processRefund, RefundError } from '@/lib/refunds/service';
import { captureError } from '@/lib/monitor';

/** Retry a PENDING/FAILED refund (T10 outbox worker + UI button). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    try {
      const result = await processRefund(id);
      return NextResponse.json({ success: result.ok, result });
    } catch (e) {
      const err = e as RefundError & { status?: number };
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }
  } catch (e) {
    captureError('admin/refunds/[id] retry', e);
    return NextResponse.json({ success: false, error: 'تعذر إعادة المحاولة' }, { status: 500 });
  }
}
