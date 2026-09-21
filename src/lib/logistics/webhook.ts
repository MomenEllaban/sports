import { prisma } from '@/lib/db';
import { transitionOrder } from '@/lib/orders/status';
import type { OrderStatus } from '@prisma/client';

const FORWARD: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/**
 * Shared courier-webhook applier (3.2). Walks the order state machine toward
 * the target so webhooks stay idempotent and never violate transitions:
 * - DELIVERED/SHIPPED/PROCESSING: step forward along the chain.
 * - RETURNED: restocks via transitionOrder (from SHIPPED/DELIVERED), or
 *   CANCELLED (also restocking) when the courier never picked it up.
 * Already-there states return replay:true.
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
    const to: OrderStatus = current === 'SHIPPED' || current === 'DELIVERED' ? 'RETURNED' : 'CANCELLED';
    try {
      await transitionOrder(orderId, to);
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
