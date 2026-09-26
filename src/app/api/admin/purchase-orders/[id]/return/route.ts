import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { canAccessBranch } from '@/lib/auth/branch-scope';
import { decrementStock, InsufficientStockError } from '@/lib/inventory/service';
import { captureError } from '@/lib/monitor';

/**
 * Supplier return: send received goods back to the vendor. Decrements the
 * branch stock with a PURCHASE_RETURN ledger row referencing the PO, and
 * reduces the received quantity so the PO stops claiming stock we no longer hold.
 * Partial returns are allowed and repeatable.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { productId?: unknown; quantity?: unknown; reason?: unknown } | null;
    if (!body) return apiError('VALIDATION_ERROR', 'A JSON body is required', 400);
    const productId = String(body.productId ?? '');
    const qty = Math.floor(Number(body.quantity));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!productId || !Number.isInteger(qty) || qty <= 0) {
      return apiError('VALIDATION_ERROR', 'A product and a positive whole quantity are required', 400);
    }
    if (!reason) {
      return apiError('VALIDATION_ERROR', 'A return reason is required', 400);
    }
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) return apiError('NOT_FOUND', 'Purchase order not found', 404);
    if (!canAccessBranch(session, po.branchId)) {
      return apiError('FORBIDDEN', 'This purchase order belongs to a branch outside your assignment', 403);
    }
    const item = po.items.find((i) => i.productId === productId);
    if (!item) {
      return apiError('VALIDATION_ERROR', 'This product is not on the purchase order', 400);
    }
    if (item.quantityReceived < qty) {
      return apiError('VALIDATION_ERROR', 'The quantity exceeds what was received for this product', 400, undefined, {
        received: item.quantityReceived,
      });
    }
    const actorId = (session?.user as { id?: string })?.id;
    try {
      await prisma.$transaction(async (tx) => {
        // Conditional decrement on quantityReceived is the exactly-once lock:
        // two concurrent returns cannot both pass the check above.
        const claimed = await tx.purchaseOrderItem.updateMany({
          where: { id: item.id, quantityReceived: { gte: qty } },
          data: { quantityReceived: { decrement: qty } },
        });
        if (claimed.count !== 1) {
          throw new ReturnQuantityError();
        }
        await decrementStock(tx, {
          branchId: po.branchId,
          productId,
          quantity: qty,
          type: 'PURCHASE_RETURN',
          referenceId: po.poNumber,
          notes: `Supplier return: ${reason.slice(0, 400)}`,
          createdById: actorId,
        });
        await tx.auditLog.create({
          data: {
            actorId: actorId ?? null,
            action: 'po.return',
            entity: 'PurchaseOrder',
            entityId: id,
            branchId: po.branchId,
            metadata: JSON.stringify({ poNumber: po.poNumber, productId, quantity: qty, reason }),
          },
        });
      }, { maxWait: 10000, timeout: 20000 });
    } catch (e) {
      if (e instanceof ReturnQuantityError) {
        return apiError('CONFLICT', 'The received quantity changed concurrently, reload and retry', 409);
      }
      if (e instanceof InsufficientStockError) {
        return apiError('VALIDATION_ERROR', `On-hand stock (${e.available}) does not cover this return`, 400, undefined, {
          items: [{ productId: e.productId, available: e.available }],
        });
      }
      throw e;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('admin/purchase-orders/[id]/return', e);
    return apiError('INTERNAL_ERROR', 'Could not record the supplier return', 500);
  }
}

class ReturnQuantityError extends Error {
  constructor() {
    super('Received quantity changed concurrently');
  }
}
