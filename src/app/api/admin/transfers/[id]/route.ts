import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

// Approve (COMPLETED: moves stock) or reject a transfer
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { action } = body; // 'approve' | 'reject'

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

    const approverId = (session!.user as { id: string }).id;

    if (action === 'reject') {
      const updated = await prisma.stockTransfer.update({
        where: { id },
        data: { status: 'REJECTED', approvedById: approverId },
      });
      return NextResponse.json({ success: true, transfer: updated });
    }

    if (action !== 'approve') {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    // Verify source stock first
    for (const item of transfer.items) {
      const inv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: transfer.fromBranchId, productId: item.productId } },
      });
      if (!inv || inv.stockQuantity < item.quantity) {
        return NextResponse.json({ success: false, error: 'Insufficient stock in source branch' }, { status: 400 });
      }
    }

    // Move stock + audit logs
    for (const item of transfer.items) {
      const fromInv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: transfer.fromBranchId, productId: item.productId } },
      });
      const toInv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: transfer.toBranchId, productId: item.productId } },
      });

      const fromNew = fromInv!.stockQuantity - item.quantity;
      await prisma.branchInventory.update({
        where: { branchId_productId: { branchId: transfer.fromBranchId, productId: item.productId } },
        data: { stockQuantity: fromNew },
      });
      await prisma.inventoryLog.create({
        data: {
          branchId: transfer.fromBranchId,
          productId: item.productId,
          type: 'TRANSFER',
          changeQuantity: -item.quantity,
          previousQuantity: fromInv!.stockQuantity,
          newQuantity: fromNew,
          referenceId: transfer.transferNumber,
          createdById: approverId,
        },
      });

      if (toInv) {
        const toNew = toInv.stockQuantity + item.quantity;
        await prisma.branchInventory.update({
          where: { branchId_productId: { branchId: transfer.toBranchId, productId: item.productId } },
          data: { stockQuantity: toNew },
        });
        await prisma.inventoryLog.create({
          data: {
            branchId: transfer.toBranchId,
            productId: item.productId,
            type: 'TRANSFER',
            changeQuantity: item.quantity,
            previousQuantity: toInv.stockQuantity,
            newQuantity: toNew,
            referenceId: transfer.transferNumber,
            createdById: approverId,
          },
        });
      } else {
        await prisma.branchInventory.create({
          data: { branchId: transfer.toBranchId, productId: item.productId, stockQuantity: item.quantity, lowStockThreshold: 5 },
        });
        await prisma.inventoryLog.create({
          data: {
            branchId: transfer.toBranchId,
            productId: item.productId,
            type: 'TRANSFER',
            changeQuantity: item.quantity,
            previousQuantity: 0,
            newQuantity: item.quantity,
            referenceId: transfer.transferNumber,
            createdById: approverId,
          },
        });
      }
    }

    const updated = await prisma.stockTransfer.update({
      where: { id },
      data: { status: 'COMPLETED', approvedById: approverId },
    });
    return NextResponse.json({ success: true, transfer: updated });
  } catch (e) {
    console.error('Admin transfer action error:', e);
    return NextResponse.json({ success: false, error: 'Failed to process transfer' }, { status: 500 });
  }
}
