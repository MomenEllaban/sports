import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import { executeRefund, recordManualRefund, assertReturnBranchAccess, ReturnError } from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';
import { prisma } from '@/lib/db';

/** Retry a PENDING/FAILED refund, or record a manual settlement. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; gatewayRef?: string; proofImage?: string };
    const allowedBranchIds = scopedBranchIds(session);
    try {
      // Paying money out is the most sensitive action in the returns flow, so
      // the branch check happens before the claim, not after.
      const rf = await prisma.refund.findUnique({
        where: { id },
        select: { returnId: true, status: true, amount: true },
      });
      if (!rf) return apiError('NOT_FOUND', 'Refund not found', 404);
      await assertReturnBranchAccess(rf.returnId, allowedBranchIds);

      if (body.action === 'manual') {
        const r = await recordManualRefund(
          id,
          (session?.user as { id?: string })?.id,
          String(body.gatewayRef || ''),
          body.proofImage,
          allowedBranchIds,
        );
        return NextResponse.json({ success: true, refund: r });
      }
      const result = await executeRefund(id);
      return NextResponse.json({ success: result.ok, result });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('admin/returns/refunds/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process the refund', 500);
  }
}
