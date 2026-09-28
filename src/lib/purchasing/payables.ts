import { money } from '@/lib/pricing';

/**
 * How a supplier payment is treated when settling an order.
 *
 * Attributed  - the payment names the order it settles. This is the only form
 *               that makes a per-invoice balance exact.
 * Unattributed - an advance, a deposit, or a credit note with no order chosen.
 *               It is real cash out, so it belongs in the supplier's total
 *               column, but it cannot be credited to one invoice.
 */
export interface PaymentAllocation {
  /** Decimal already converted with `num()`. */
  amount: number;
  /** ISO timestamp, oldest first, so allocation is deterministic. */
  createdAt: string;
  purchaseOrderId: string | null;
}

export interface OrderForAllocation {
  id: string;
  totalAmount: number;
}

/**
 * Splits each payment between "settles a specific order" and "not attributable".
 *
 * The old invoice page did neither: it summed every payment ever made to a
 * supplier and applied that same total to each of the supplier's orders
 * independently, so one 2000 payment against a 1000 and a 2000 order reported
 * both as fully paid and overstated cash paid by 1000. Attribution is now
 * explicit, and the remainder is surfaced instead of being smeared.
 */
export function splitPayments(payments: PaymentAllocation[]): {
  attributed: Map<string, number>;
  unattributedTotal: number;
  attributedTotal: number;
} {
  const attributed = new Map<string, number>();
  let unattributedTotal = 0;

  // Oldest first: when several payments touch the same order, the earliest
  // cash is treated as settling it, which is the usual accounting convention.
  const ordered = [...payments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const payment of ordered) {
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) continue;
    if (payment.purchaseOrderId) {
      attributed.set(
        payment.purchaseOrderId,
        money((attributed.get(payment.purchaseOrderId) ?? 0) + payment.amount),
      );
    } else {
      unattributedTotal = money(unattributedTotal + payment.amount);
    }
  }

  let attributedTotal = 0;
  for (const value of attributed.values()) attributedTotal = money(attributedTotal + value);

  return { attributed, unattributedTotal, attributedTotal };
}

/** Cash already booked against one order, never more than the order total. */
export function paidForOrder(
  order: OrderForAllocation,
  attributed: Map<string, number>,
): number {
  const booked = attributed.get(order.id) ?? 0;
  return money(Math.min(Math.max(0, order.totalAmount), booked));
}

export type PaymentState = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function paymentStateFor(paid: number, total: number): PaymentState {
  if (total <= 0) return 'UNPAID';
  if (paid <= 0) return 'UNPAID';
  // A cent of rounding must not leave a settled invoice looking open.
  return money(paid) >= money(total) ? 'PAID' : 'PARTIALLY_PAID';
}

/**
 * What is still owed on an order.
 *
 * Uses the proportional share of what was actually received rather than the
 * full order total, because undelivered lines are not yet a payable: a PO for
 * 100 units with 40 received commits the branch to 40 units' worth until the
 * rest arrives. Lines cancelled by a supplier return are already excluded,
 * since a return lowers `quantityReceived`.
 */
export function receivedValueOf(
  order: { totalAmount: number },
  items: Array<{ quantityOrdered: number; quantityReceived: number; unitCost: number }>,
): number {
  if (items.length === 0) return 0;
  const orderedValue = items.reduce(
    (sum, item) => sum + item.quantityOrdered * item.unitCost,
    0,
  );
  if (orderedValue <= 0) return money(order.totalAmount);
  const receivedValue = items.reduce(
    (sum, item) => sum + Math.min(item.quantityReceived, item.quantityOrdered) * item.unitCost,
    0,
  );
  return money((receivedValue / orderedValue) * order.totalAmount);
}

/** Outstanding balance for one order, clamped at zero. */
export function outstandingFor(committed: number, paid: number): number {
  return money(Math.max(0, committed - paid));
}
