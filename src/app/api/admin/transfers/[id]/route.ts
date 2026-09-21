import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { decrementStock, incrementStock, InsufficientStockError } from '@/lib/inventory/service';

// Approve (COMPLETED: moves stock) or reject a transfer
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' | 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const approverId = (session!.user as { id: string }).id;

    if (action === 'reject') {
      const claimed = await prisma.stockTransfer.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', approvedById: approverId },
      });
      if (claimed.count !== 1) {
        return NextResponse.json({ success: false, error: 'Transfer already processed' }, { status: 400 });
      }
      const transfer = await prisma.stockTransfer.findUnique({ where: { id } });
      return NextResponse.json({ success: true, transfer });
    }

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) {
      return NextResponse.json({ success: false, error: 'Transfer not found' }, { status: 404 });
    }
    if (transfer.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Transfer already processed' }, { status: 400 });
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
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient stock in source branch',
            items: [{ productId: e.productId, available: e.available }],
          },
          { status: 400 }
        );
      }
      if (e instanceof Error && e.message === 'TRANSFER_ALREADY_PROCESSED') {
        return NextResponse.json({ success: false, error: 'Transfer already processed' }, { status: 400 });
      }
      throw e;
    }

    const updated = await prisma.stockTransfer.findUnique({ where: { id } });
    return NextResponse.json({ success: true, transfer: updated });
  } catch (e) {
    console.error('Admin transfer action error:', e);
    return NextResponse.json({ success: false, error: 'Failed to process transfer' }, { status: 500 });
  }
}
