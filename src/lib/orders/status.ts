import { prisma } from '@/lib/db';
import { incrementStock } from '@/lib/inventory/service';
import type { OrderStatus } from '@prisma/client';
import { ORDER_TRANSITIONS as CLIENT_ORDER_TRANSITIONS } from './transitions';

type S = OrderStatus;

export const ORDER_TRANSITIONS: Record<S, S[]> = CLIENT_ORDER_TRANSITIONS as unknown as Record<S, S[]>;

/**
 * Allowed order transitions (T08, documented single source of truth).
 * Terminal: CANCELLED, RETURNED. Cancel/return triggers exactly-once restock.
 */
export function canTransition(from: S, to: S): boolean {
  return (ORDER_TRANSITIONS[from] || []).includes(to);
}

export function isRestockingStatus(to: S): boolean {
  return to === 'CANCELLED' || to === 'RETURNED';
}

export class OrderTransitionError extends Error {
  status = 400;
}

/**
 * Transition an order's status. For CANCELLED/RETURNED the branch stock is
 * restocked in the SAME transaction via the inventory service (RETURN logs,
 * reference = order number, acting user recorded).
 * Exactly-once: the status row itself is the lock — conditional updateMany
 * wins for exactly one writer; losers and repeats get 0 rows -> error.
 */
export async function transitionOrder(
  orderId: string,
  to: S,
  actingUserId?: string,
  expectedFrom?: S
): Promise<{ orderNumber: string; from: S; to: S }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) {
    const e = new OrderTransitionError(`Order not found`) as OrderTransitionError & { status: number };
    e.status = 404;
    throw e;
  }
  const from = order.orderStatus as S;
  if (expectedFrom && expectedFrom !== from) {
    const e = new OrderTransitionError(`Order changed concurrently (expected ${expectedFrom}, now ${from})`);
    e.status = 409;
    throw e;
  }
  if (from === to) {
    throw new OrderTransitionError(`Order is already ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new OrderTransitionError(`Invalid transition ${from} -> ${to}`);
  }

  if (!isRestockingStatus(to)) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, orderStatus: from },
        data: { orderStatus: to },
      });
      if (updated.count !== 1) {
        throw new OrderTransitionError(`Order changed concurrently (now not ${from})`);
      }
      await tx.auditLog.create({
        data: {
          actorId: actingUserId || null,
          action: 'order.status_changed',
          entity: 'Order',
          entityId: orderId,
          branchId: order.branchId,
          metadata: JSON.stringify({ from, to }),
        },
      });
    }, { maxWait: 10000, timeout: 20000 });
    return { orderNumber: order.orderNumber, from, to };
  }

  // Cancel/return: claim + restock atomically. The conditional update is the
  // exactly-once lock (parallel losers get count 0); a crash rolls everything back.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, orderStatus: from },
      data: { orderStatus: to },
    });
    if (claimed.count !== 1) {
      throw new OrderTransitionError(`Order changed concurrently (now not ${from})`);
    }
    for (const item of order.items) {
      await incrementStock(tx, {
        branchId: order.branchId,
        productId: item.productId,
        quantity: item.quantity,
        type: 'RETURN',
        referenceId: order.orderNumber,
        createdById: actingUserId,
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actingUserId || null,
        action: 'order.status_changed',
        entity: 'Order',
        entityId: orderId,
        branchId: order.branchId,
        metadata: JSON.stringify({ from, to, restocked: true }),
      },
    });
  }, { maxWait: 10000, timeout: 20000 });

  return { orderNumber: order.orderNumber, from, to };
}
