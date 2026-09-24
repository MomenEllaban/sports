import { describe, expect, it } from 'vitest';
import { nextOrderStatuses, transitionImpact } from '../../src/lib/orders/transitions.js';

describe('order status transition policy', () => {
  it('only exposes valid next states to the admin selector', () => {
    expect(nextOrderStatuses('PENDING')).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(nextOrderStatuses('DELIVERED')).toEqual(['RETURNED']);
    expect(nextOrderStatuses('CANCELLED')).toEqual([]);
  });

  it('describes stock and fulfillment impact', () => {
    expect(transitionImpact('CANCELLED')).toBe('RESTOCK');
    expect(transitionImpact('SHIPPED')).toBe('FULFILLMENT');
    expect(transitionImpact('CONFIRMED')).toBe('NONE');
  });
});
