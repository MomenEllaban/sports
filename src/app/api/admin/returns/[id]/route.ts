import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { scopedBranchIds } from '@/lib/auth/branch-scope';
import {
  approveReturn, rejectReturn, cancelReturn, receiveReturn,
  linkExchangeSale, ReturnError,
} from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';

const RECEIVE_ACTIONS = new Set(['approve', 'reject', 'cancel', 'receive', 'link-exchange']);

/** RMA transitions: action ∈ approve | reject | cancel | receive | link-exchange. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string; reason?: string; lines?: Array<{ returnItemId: string; condition: string; disposition: string }>;
      refundMethod?: string; exchangeSaleId?: string;
    };
    if (!body.action || !RECEIVE_ACTIONS.has(body.action)) {
      return apiError('VALIDATION_ERROR', `Action must be one of: ${[...RECEIVE_ACTIONS].join(', ')}`, 400);
    }
    const actorId = (session?.user as { id?: string })?.id;
    // Every transition below re-checks branch scope inside the service, so a
    // branch manager cannot action another branch's case by guessing the id.
    const allowedBranchIds = scopedBranchIds(session);
    try {
      switch (body.action) {
        case 'approve': {
          const r = await approveReturn(id, actorId, allowedBranchIds);
          return NextResponse.json({ success: true, return: r });
        }
        case 'reject': {
          const r = await rejectReturn(id, actorId, body.reason, allowedBranchIds);
          return NextResponse.json({ success: true, return: r });
        }
        case 'cancel': {
          const r = await cancelReturn(id, actorId, allowedBranchIds);
          return NextResponse.json({ success: true, return: r });
        }
        case 'receive': {
          const r = await receiveReturn(id, actorId, body.lines || [], {
            refundMethod: body.refundMethod,
            allowedBranchIds,
          });
          return NextResponse.json({ success: true, ...r });
        }
        case 'link-exchange': {
          if (!body.exchangeSaleId) return apiError('VALIDATION_ERROR', 'exchangeSaleId is required', 400);
          await linkExchangeSale(id, body.exchangeSaleId, actorId, allowedBranchIds);
          return NextResponse.json({ success: true });
        }
        default:
          return apiError('VALIDATION_ERROR', 'Unsupported action', 400);
      }
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('admin/returns/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to apply the return action', 500);
  }
}
