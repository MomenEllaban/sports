import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { incrementStock } from '@/lib/inventory/service';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { writeAudit } from '@/lib/audit';

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
    const body = (await req.json().catch(() => null)) as { received?: unknown } | null;
    const received = body?.received;

    if (!Array.isArray(received) || received.length === 0) {
      return apiError('VALIDATION_ERROR', 'No received quantities', 400);
    }

    // Shape-validate before the transaction. The old loop `continue`d past
    // anything it did not like, so a typo in an itemId or a zero quantity
    // reported success while nothing was actually received.
    const lines: Array<{ itemId: string; quantity: number }> = [];
    for (const entry of received) {
      const itemId = (entry as { itemId?: unknown })?.itemId;
      const rawQty = Number((entry as { quantity?: unknown })?.quantity);
      if (typeof itemId !== 'string' || !itemId.trim()) {
        return apiError('VALIDATION_ERROR', 'Each line needs an itemId', 400);
      }
      if (!Number.isFinite(rawQty) || rawQty <= 0) {
        return apiError('VALIDATION_ERROR', 'Each line needs a quantity greater than zero', 400);
      }
      lines.push({ itemId: itemId.trim(), quantity: Math.floor(rawQty) });
    }
    if (lines.some((line) => line.quantity <= 0)) {
      return apiError('VALIDATION_ERROR', 'Quantities must be whole numbers', 400);
    }

    const actorId = (session!.user as { id: string }).id;

    // ONE transaction: item receipts + stock + logs + status. The conditional
    // quantityReceived update is the lock so concurrent receives cannot double-count.
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
      if (!po) throw new PoError(404, 'Purchase order not found');
      if (!canAccessBranch(session, po.branchId)) throw new PoError(403, 'Purchase order is outside your branch scope');
      if (po.status === 'DRAFT') throw new PoError(409, 'Cannot receive a draft purchase order');
      if (po.status === 'CANCELLED' || po.status === 'RECEIVED') {
        throw new PoError(400, 'Purchase order already closed');
      }

      let receivedAnything = false;
      const clamped: Array<{ itemId: string; requested: number; booked: number }> = [];

      for (const line of lines) {
        const item = po.items.find((i) => i.id === line.itemId);
        if (!item) {
          throw new PoError(400, `Line ${line.itemId} is not part of this purchase order`);
        }
        const remaining = item.quantityOrdered - item.quantityReceived;
        const addQty = Math.min(line.quantity, remaining);
        // Over-receipt is clamped rather than rejected so a supplier delivering
        // extra on one line does not block the whole receipt, but the amount
        // actually booked is reported back.
        if (addQty !== line.quantity) {
          clamped.push({ itemId: line.itemId, requested: line.quantity, booked: addQty });
        }
        if (addQty <= 0) continue;
        receivedAnything = true;

        const claimed = await tx.purchaseOrderItem.updateMany({
          where: { id: item.id, quantityReceived: item.quantityReceived },
          data: { quantityReceived: item.quantityReceived + addQty },
        });
        if (claimed.count !== 1) throw new PoError(409, 'Purchase order changed concurrently, retry');

        await incrementStock(tx, {
          branchId: po.branchId,
          productId: item.productId,
          quantity: addQty,
          type: 'PURCHASE',
          referenceId: po.poNumber,
          createdById: actorId,
        });
      }

      if (!receivedAnything) {
        throw new PoError(409, 'Every line on this order is already fully received');
      }

      const refreshed = await tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
      const fullyReceived = refreshed.items.every((i) => i.quantityReceived >= i.quantityOrdered);
      // A part-received order is a real, payable state: goods are in the branch
      // but the order is not closed. It used to fall back to SUBMITTED, which
      // left the UI with a status it could not represent and no partial badge.
      const purchaseOrder = await tx.purchaseOrder.update({
        where: { id },
        data: { status: fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });
      // Returned so the audit entry can name the PO and the resulting
      // quantities without re-querying outside the transaction.
      return {
        purchaseOrder,
        clamped,
        audit: {
          poNumber: po.poNumber,
          branchId: po.branchId,
          status: purchaseOrder.status,
          received: refreshed.items.map((i) => ({ productId: i.productId, received: i.quantityReceived, ordered: i.quantityOrdered })),
        },
      };
    }, { maxWait: 10000, timeout: 20000 });

    const updated = result.purchaseOrder;

    // Receiving goods increases stock and settles what the supplier delivered,
    // so the quantities are recorded against the PO number.
    void writeAudit({
      actorId,
      action: 'purchase_order.received',
      entity: 'PurchaseOrder',
      entityId: id,
      branchId: result.audit.branchId,
      metadata: result.audit,
    });

    return NextResponse.json({ success: true, purchaseOrder: updated, clamped: result.clamped });
  } catch (e) {
    if (e instanceof PoError) {
      return apiError('REQUEST_FAILED', String(e.message), e.status);
    }
    captureError('api/admin/purchase-orders/[id]/receive', e);
    return apiError('INTERNAL_ERROR', 'Failed to receive goods', 500);
  }
}
