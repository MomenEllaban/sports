import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { incrementStock } from '@/lib/inventory/service';
import { canAccessBranch } from '@/lib/auth/branch-scope';

class PoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Receive goods for a PO: adds stock + audit logs, marks RECEIVED when fully received
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { received } = body as { received: Array<{ itemId: string; quantity: number }> };

    if (!Array.isArray(received) || received.length === 0) {
      return NextResponse.json({ success: false, error: 'No received quantities' }, { status: 400 });
    }

    const actorId = (session!.user as { id: string }).id;

    // ONE transaction: item receipts + stock + logs + status. The conditional
    // quantityReceived update is the lock so concurrent receives cannot double-count.
    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
      if (!po) throw new PoError(404, 'Purchase order not found');
      if (!canAccessBranch(session, po.branchId)) throw new PoError(403, 'Purchase order is outside your branch scope');
      if (po.status === 'DRAFT') throw new PoError(409, 'Cannot receive a draft purchase order');
      if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
        throw new PoError(400, 'Purchase order already closed');
      }

      for (const r of received) {
        const qty = Math.floor(Number(r.quantity) || 0);
        if (qty <= 0) continue;
        const item = po.items.find((i) => i.id === r.itemId);
        if (!item) continue;
        const addQty = Math.min(qty, item.quantityOrdered - item.quantityReceived);
        if (addQty <= 0) continue;

        const claimed = await tx.purchaseOrderItem.updateMany({
          where: { id: item.id, quantityReceived: item.quantityReceived },
          data: { quantityReceived: item.quantityReceived + addQty },
        });
        if (claimed.count !== 1) throw new PoError(409, 'Purchase order changed concurrently, retry');

        await incrementStock(tx, {
          branchId: po.branchId,
          productId: item.productId,
          quantity: addQty,
          type: 'RESTOCK',
          referenceId: po.poNumber,
          createdById: actorId,
        });
      }

      const refreshed = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
      const fullyReceived = refreshed.items.every((i) => i.quantityReceived >= i.quantityOrdered);
      return tx.purchaseOrder.update({
        where: { id },
        data: { status: fullyReceived ? 'RECEIVED' : 'SUBMITTED' },
      });
    }, { maxWait: 10000, timeout: 20000 });

    return NextResponse.json({ success: true, purchaseOrder: updated });
  } catch (e) {
    if (e instanceof PoError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    console.error('Admin PO receive error:', e);
    return NextResponse.json({ success: false, error: 'Failed to receive goods' }, { status: 500 });
  }
}
