export const ORDER_TRANSITION_VALUES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;

export type OrderTransitionValue = (typeof ORDER_TRANSITION_VALUES)[number];

/**
 * Client-safe source of truth for the order state machine. Keep this file free
 * of Prisma imports so the admin table and server routes cannot drift.
 */
export const ORDER_TRANSITIONS: Record<OrderTransitionValue, readonly OrderTransitionValue[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export function isOrderStatus(value: string): value is OrderTransitionValue {
  return (ORDER_TRANSITION_VALUES as readonly string[]).includes(value);
}

export function nextOrderStatuses(value: string): readonly OrderTransitionValue[] {
  return isOrderStatus(value) ? ORDER_TRANSITIONS[value] : [];
}

export function transitionImpact(value: string): 'RESTOCK' | 'FULFILLMENT' | 'NONE' {
  if (value === 'CANCELLED') return 'RESTOCK';
  if (['SHIPPED', 'DELIVERED'].includes(value)) return 'FULFILLMENT';
  return 'NONE';
}
