import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import {
  approveReturn, rejectReturn, cancelReturn, receiveReturn,
  linkExchangeSale, ReturnError,
} from '@/lib/returns/service';
import { captureError } from '@/lib/monitor';

/** RMA transitions: action ∈ approve|reject|cancel|receive|link-exchange. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: string; reason?: string; lines?: Array<{ returnItemId: string; condition: string; disposition: string }>;
      refundMethod?: string; exchangeSaleId?: string;
    };
    const actorId = (session?.user as { id?: string })?.id;
    try {
      switch (body.action) {
        case 'approve': {
          const r = await approveReturn(id, actorId);
          return NextResponse.json({ success: true, return: r });
        }
        case 'reject': {
          const r = await rejectReturn(id, actorId, body.reason);
          return NextResponse.json({ success: true, return: r });
        }
        case 'cancel': {
          const r = await cancelReturn(id, actorId);
          return NextResponse.json({ success: true, return: r });
        }
        case 'receive': {
          const r = await receiveReturn(id, actorId, body.lines || [], { refundMethod: body.refundMethod });
          return NextResponse.json({ success: true, ...r });
        }
        case 'link-exchange': {
          if (!body.exchangeSaleId) return NextResponse.json({ success: false, error: 'exchangeSaleId مطلوب' }, { status: 400 });
          await linkExchangeSale(id, body.exchangeSaleId, actorId);
          return NextResponse.json({ success: true });
        }
        default:
          return NextResponse.json({ success: false, error: 'action غير صالح' }, { status: 400 });
      }
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }
  } catch (e) {
    captureError('admin/returns/[id]', e);
    return NextResponse.json({ success: false, error: 'تعذر التنفيذ' }, { status: 500 });
  }
}
