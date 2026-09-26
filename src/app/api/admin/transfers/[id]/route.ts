import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { assertTransferBranchAccess } from '@/lib/inventory/transfers';
import { applyTransferAction, allowedTransferActions, TransferError } from '@/lib/inventory/transfers';

/**
 * One action per call: approve | reject | cancel | ship | receive.
 * Each maps to a single transition in `src/lib/inventory/transfers.ts`, which
 * owns the branch check, the compare-and-swap and the stock movements.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      action?: unknown;
      reason?: unknown;
      lines?: unknown;
    } | null;
    if (!body || typeof body.action !== 'string') {
      return apiError('VALIDATION_ERROR', 'An action is required', 400);
    }

    const lines = Array.isArray(body.lines)
      ? body.lines.map((raw) => {
          const l = raw as { itemId?: unknown; quantityReceived?: unknown };
          return { itemId: String(l?.itemId ?? ''), quantityReceived: Number(l?.quantityReceived) };
        })
      : undefined;

    const transfer = await applyTransferAction(session, id, body.action, {
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      lines,
    });

    return NextResponse.json({ success: true, transfer });
  } catch (e) {
    if (e instanceof TransferError) {
      return apiError(e.code, e.message, e.status, undefined, e.details);
    }
    captureError('api/admin/transfers/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process transfer', 500);
  }
}

/** Detail read: the receiving UI needs the outstanding per-line quantities. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER', 'FINANCE');
    if (error) return error;
    const { id } = await params;
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: { select: { sku: true, nameAr: true, nameEn: true } } },
          orderBy: { product: { sku: 'asc' } },
        },
      },
    });
    if (!transfer) return apiError('NOT_FOUND', 'Transfer not found', 404);
    assertTransferBranchAccess(session, transfer.fromBranchId, transfer.toBranchId);
    return NextResponse.json({
      success: true,
      transfer,
      availableActions: allowedTransferActions(
        transfer.status,
        transfer.requestedById === (session?.user as { id?: string } | undefined)?.id,
      ),
    });
  } catch (e) {
    if (e instanceof TransferError) {
      return apiError(e.code, e.message, e.status, undefined, e.details);
    }
    captureError('api/admin/transfers/[id] GET', e);
    return apiError('INTERNAL_ERROR', 'Failed to load transfer', 500);
  }
}
