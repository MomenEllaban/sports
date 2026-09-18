import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

// Receive goods for a PO: adds stock + audit logs, marks RECEIVED when fully received
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { received } = body as { received: Array<{ itemId: string; quantity: number }> };

    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) {
      return NextResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 });
    }
    if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
      return NextResponse.json({ success: false, error: 'Purchase order already closed' }, { status: 400 });
    }
    if (!Array.isArray(received) || received.length === 0) {
      return NextResponse.json({ success: false, error: 'No received quantities' }, { status: 400 });
    }

    const actorId = (session!.user as { id: string }).id;

    for (const r of received) {
      const qty = Math.floor(Number(r.quantity) || 0);
      if (qty <= 0) continue;
      const item = po.items.find((i) => i.id === r.itemId);
      if (!item) continue;
      const addQty = Math.min(qty, item.quantityOrdered - item.quantityReceived);
      if (addQty <= 0) continue;

      await prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { quantityReceived: item.quantityReceived + addQty },
      });

      const inv = await prisma.branchInventory.findUnique({
        where: { branchId_productId: { branchId: po.branchId, productId: item.productId } },
      });
      if (inv) {
        const newQty = inv.stockQuantity + addQty;
        await prisma.branchInventory.update({
          where: { branchId_productId: { branchId: po.branchId, productId: item.productId } },
          data: { stockQuantity: newQty },
        });
        await prisma.inventoryLog.create({
          data: {
            branchId: po.branchId,
            productId: item.productId,
            type: 'RESTOCK',
            changeQuantity: addQty,
            previousQuantity: inv.stockQuantity,
            newQuantity: newQty,
            referenceId: po.poNumber,
            createdById: actorId,
          },
        });
      } else {
        await prisma.branchInventory.create({
          data: { branchId: po.branchId, productId: item.productId, stockQuantity: addQty, lowStockThreshold: 5 },
        });
        await prisma.inventoryLog.create({
          data: {
            branchId: po.branchId,
            productId: item.productId,
            type: 'RESTOCK',
            changeQuantity: addQty,
            previousQuantity: 0,
            newQuantity: addQty,
            referenceId: po.poNumber,
            createdById: actorId,
          },
        });
      }
    }

    const refreshed = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    const fullyReceived = refreshed!.items.every((i) => i.quantityReceived >= i.quantityOrdered);
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: fullyReceived ? 'RECEIVED' : 'SUBMITTED' },
    });

    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (e) {
    console.error('Admin PO receive error:', e);
    return NextResponse.json({ success: false, error: 'Failed to receive goods' }, { status: 500 });
  }
}
