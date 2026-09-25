import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { decrementStock, incrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { writeAudit } from '@/lib/audit';

// Approve (COMPLETED: moves stock) or reject a transfer
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' | 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return apiError('VALIDATION_ERROR', 'Invalid action', 400);
    }

    const approverId = (session!.user as { id: string }).id;

    if (action === 'reject') {
      const claimed = await prisma.stockTransfer.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', approvedById: approverId },
      });
      if (claimed.count !== 1) {
        return apiError('VALIDATION_ERROR', 'Transfer already processed', 400);
      }
      const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
      void writeAudit({
        actorId: approverId,
        action: 'transfer.rejected',
        entity: 'StockTransfer',
        entityId: id,
        branchId: transfer?.fromBranchId ?? null,
        metadata: { transferNumber: transfer?.transferNumber, toBranchId: transfer?.toBranchId },
      });
      return NextResponse.json({ success: true, transfer });
    }

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) {
      return apiError('NOT_FOUND', 'Transfer not found', 404);
    }
    if (transfer.status !== 'PENDING') {
      return apiError('VALIDATION_ERROR', 'Transfer already processed', 400);
    }

    // ONE transaction: claim the transfer + move stock + audit logs. The
    // conditional status claim is the exactly-once lock; stock uses the
    // race-safe inventory service, so a crash or concurrent approval rolls back.
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.stockTransfer.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'COMPLETED', approvedById: approverId },
        });
        if (claimed.count !== 1) {
          throw new Error('TRANSFER_ALREADY_PROCESSED');
        }
        for (const item of transfer.items) {
          await decrementStock(tx, {
            branchId: transfer.fromBranchId,
            productId: item.productId,
            quantity: item.quantity,
            type: 'TRANSFER',
            referenceId: transfer.transferNumber,
            createdById: approverId,
          });
          await incrementStock(tx, {
            branchId: transfer.toBranchId,
            productId: item.productId,
            quantity: item.quantity,
            type: 'TRANSFER',
            referenceId: transfer.transferNumber,
            createdById: approverId,
          });
        }
      }, { maxWait: 10000, timeout: 20000 });
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        return apiError('VALIDATION_ERROR', 'Insufficient stock in source branch', 400, undefined, { items: [{ productId: e.productId, available: e.available }] });
      }
      if (e instanceof Error && e.message === 'TRANSFER_ALREADY_PROCESSED') {
        return apiError('VALIDATION_ERROR', 'Transfer already processed', 400);
      }
      throw e;
    }

    const updated = await prisma.stockTransfer.findUnique({ where: { id } });
    // Stock physically moved between branches, so this is the entry that
    // matters for reconciling branch balances after the fact.
    void writeAudit({
      actorId: approverId,
      action: 'transfer.completed',
      entity: 'StockTransfer',
      entityId: id,
      branchId: transfer.fromBranchId,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromBranchId: transfer.fromBranchId,
        toBranchId: transfer.toBranchId,
        itemCount: transfer.items.length,
        totalQuantity: transfer.items.reduce((sum, it) => sum + it.quantity, 0),
      },
    });
    return NextResponse.json({ success: true, transfer: updated });
  } catch (e) {
    captureError('api/admin/transfers/[id]', e);
    return apiError('INTERNAL_ERROR', 'Failed to process transfer', 500);
  }
}
