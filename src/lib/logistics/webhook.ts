import { prisma } from '@/lib/db';
import { transitionOrder } from '@/lib/orders/status';
import { requestReturn, approveReturn, receiveReturn } from '@/lib/returns/service';
import type { OrderStatus } from '@prisma/client';

const FORWARD: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/**
 * Shared courier-webhook applier (3.2 + T-RMA). Walks the order state machine
 * toward the target so webhooks stay idempotent and never violate transitions:
 * - DELIVERED/SHIPPED/PROCESSING: step forward along the chain.
 * - RETURNED: opens an AUTO_COURIER RMA (auto-approved + received, RESTOCK)
 *   through the single Return Service instead of flipping status directly.
 *   Already-there states return replay:true.
 */
export async function applyCourierStatus(
  orderId: string,
  target: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'RETURNED'
): Promise<{ replay: boolean; orderStatus: OrderStatus }> {
  const fresh = async () => prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  let current = (await fresh()).orderStatus as OrderStatus;
  if (current === target) return { replay: true, orderStatus: current };
  if (current === 'CANCELLED' || current === 'RETURNED') {
    return { replay: true, orderStatus: current };
  }

  if (target === 'RETURNED') {
    if (current !== 'SHIPPED' && current !== 'DELIVERED') {
      try {
        await transitionOrder(orderId, 'CANCELLED');
      } catch {
        /* concurrent change: report current */
      }
      return { replay: false, orderStatus: (await fresh()).orderStatus as OrderStatus };
    }
    try {
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      const { request } = await requestReturn({
        orderId,
        channel: 'AUTO_COURIER',
        items: order.items.map((i) => ({ refId: i.id, productId: i.productId, quantity: i.quantity, reasonCode: 'OTHER' })),
        customerPhone: order.guestPhone,
        notes: 'مرتجع شركة شحن تلقائي',
        clientRequestId: `courier-${orderId}`,
      });
      await approveReturn(request.id, undefined);
      const withItems = await prisma.returnRequest.findUniqueOrThrow({ where: { id: request.id }, include: { items: true } });
      await receiveReturn(request.id, undefined, withItems.items.map((ri) => ({
        returnItemId: ri.id, condition: 'GOOD', disposition: 'RESTOCK',
      })), {});
    } catch {
      return { replay: true, orderStatus: (await fresh()).orderStatus as OrderStatus };
    }
    return { replay: false, orderStatus: (await fresh()).orderStatus as OrderStatus };
  }

  const targetIdx = FORWARD.indexOf(target);
  let guard = 0;
  while (guard++ < 6) {
    current = (await fresh()).orderStatus as OrderStatus;
    if (current === target) return { replay: guard > 1, orderStatus: current };
    const curIdx = FORWARD.indexOf(current);
    if (curIdx === -1 || curIdx >= targetIdx) {
      return { replay: true, orderStatus: current };
    }
    const next = FORWARD[curIdx + 1] as OrderStatus;
    try {
      await transitionOrder(orderId, next);
    } catch {
      return { replay: true, orderStatus: (await fresh()).orderStatus as OrderStatus };
    }
  }
  return { replay: true, orderStatus: (await fresh()).orderStatus as OrderStatus };
}
