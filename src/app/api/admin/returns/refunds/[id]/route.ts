import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { executeRefund, recordManualRefund, ReturnError } from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';

/** Retry a PENDING/FAILED refund, or record a manual settlement. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; gatewayRef?: string; proofImage?: string };
    try {
      if (body.action === 'manual') {
        const r = await recordManualRefund(id, (session?.user as { id?: string })?.id, String(body.gatewayRef || ''), body.proofImage);
        return NextResponse.json({ success: true, refund: r });
      }
      const result = await executeRefund(id);
      return NextResponse.json({ success: result.ok, result });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }
  } catch (e) {
    captureError('admin/returns/refunds/[id]', e);
    return NextResponse.json({ success: false, error: 'تعذر التنفيذ' }, { status: 500 });
  }
}
