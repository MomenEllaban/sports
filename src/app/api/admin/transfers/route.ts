import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { nextDocumentNumber } from '@/lib/documents';

// Create a stock transfer request (PENDING)
export async function POST(req: Request) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const body = await req.json();
    const { fromBranchId, toBranchId, items, notes } = body;

    if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
      return apiError('VALIDATION_ERROR', 'Select two different branches', 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return apiError('VALIDATION_ERROR', 'Add at least one item', 400);
    }
    for (const it of items) {
      if (!it.productId || !Number.isInteger(it.quantity) || it.quantity <= 0) {
        return apiError('VALIDATION_ERROR', 'Invalid item quantity', 400);
      }
    }

    const actorId = (session!.user as { id: string }).id;
    const transferNumber = await prisma.$transaction((tx) => nextDocumentNumber(tx, 'TRF'));
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromBranchId,
        toBranchId,
        requestedById: actorId,
        notes: notes || null,
        status: 'PENDING',
        items: { create: items.map((it: { productId: string; quantity: number }) => ({ productId: it.productId, quantity: it.quantity })) },
      },
      include: { items: true },
    });

    void writeAudit({
      actorId,
      action: 'transfer.requested',
      entity: 'StockTransfer',
      entityId: transfer.id,
      branchId: fromBranchId,
      metadata: {
        transferNumber,
        toBranchId,
        itemCount: transfer.items.length,
        totalQuantity: transfer.items.reduce((sum: number, it: { quantity: number }) => sum + it.quantity, 0),
      },
    });

    return NextResponse.json({ success: true, transfer });
  } catch (e) {
    captureError('api/admin/transfers', e);
    return apiError('INTERNAL_ERROR', 'Failed to create transfer', 500);
  }
}
