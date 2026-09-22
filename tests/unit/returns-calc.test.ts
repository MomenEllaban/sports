import { describe, it, expect } from 'vitest';
import { allocateDiscount, quoteReturn } from '../../src/lib/returns/calc.js';

const line = (unitPrice: number, quantity: number, returnedQty: number) => ({ productId: `p-${unitPrice}`, unitPrice, quantity, returnedQty });

describe('returns calc (T-RMA)', () => {
  it('allocateDiscount splits pennies to the last line and sums exactly', () => {
    const shares = allocateDiscount([100, 100, 100], 100);
    expect(shares.reduce((s, x) => s + x, 0)).toBe(100);
    expect(shares).toEqual([33.33, 33.33, 33.34]);
    expect(allocateDiscount([50], 999)).toEqual([50]); // capped at gross
    expect(allocateDiscount([0, 0], 10)).toEqual([0, 0]);
  });

  it('full return with discount + VAT reconciles to paid total', () => {
    // Sold 2×500, coupon 100 → paid (900 + 126 VAT) = 1026.
    const q = quoteReturn({
      lines: [line(500, 2, 2)],
      orderDiscount: 100, vatRate: 0.14,
      deliveryFee: 0, deliveryPaid: false, deliveryPolicy: 'FULL_RETURN_OR_OUR_FAULT',
      fullReturn: true, ourFault: false, restockingFeePct: 0, changedMind: false,
      alreadyRefunded: 0, paidTotal: 1026,
    });
    expect(q.total).toBe(1026);
    expect(q.lines[0].discountShare).toBe(100);
    expect(q.lines[0].vat).toBe(126);
  });

  it('partial return allocates discount proportionally', () => {
    // 1×1000 + 1×500 = 1500 gross, discount 150 (10%). Return only the 1000 line.
    const q = quoteReturn({
      lines: [line(1000, 1, 1), line(500, 1, 0)],
      orderDiscount: 150, vatRate: 0.14,
      deliveryFee: 0, deliveryPaid: false, deliveryPolicy: 'FULL_RETURN_OR_OUR_FAULT',
      fullReturn: false, ourFault: false, restockingFeePct: 0, changedMind: false,
      alreadyRefunded: 0, paidTotal: 1629,
    });
    const l = q.lines[0];
    expect(l.discountShare).toBe(100); // 1000/1500 of 150
    expect(l.refund).toBe(1026); // (1000-100)*1.14
    expect(q.lines[1].refund).toBe(0);
  });

  it('delivery refunded only when full or our fault', () => {
    const base = {
      lines: [line(500, 1, 1)],
      orderDiscount: 0, vatRate: 0.14,
      deliveryFee: 30, deliveryPaid: true,
      alreadyRefunded: 0, paidTotal: 600,
      restockingFeePct: 0, changedMind: false,
    };
    const partial = quoteReturn({ ...base, deliveryPolicy: 'FULL_RETURN_OR_OUR_FAULT', fullReturn: false, ourFault: false });
    expect(partial.deliveryRefund).toBe(0);
    const fault = quoteReturn({ ...base, deliveryPolicy: 'FULL_RETURN_OR_OUR_FAULT', fullReturn: false, ourFault: true });
    expect(fault.deliveryRefund).toBe(30);
    const full = quoteReturn({ ...base, deliveryPolicy: 'FULL_RETURN_OR_OUR_FAULT', fullReturn: true, ourFault: false });
    expect(full.deliveryRefund).toBe(30);
    const never = quoteReturn({ ...base, deliveryPolicy: 'NEVER', fullReturn: true, ourFault: true });
    expect(never.deliveryRefund).toBe(0);
    const unpaid = quoteReturn({ ...base, deliveryPolicy: 'ALWAYS', deliveryPaid: false, fullReturn: true, ourFault: false });
    expect(unpaid.deliveryRefund).toBe(0);
  });

  it('restocking fee only on CHANGED_MIND', () => {
    const base = {
      lines: [line(1000, 1, 1)],
      orderDiscount: 0, vatRate: 0.14,
      deliveryFee: 0, deliveryPaid: false, deliveryPolicy: 'NEVER',
      fullReturn: true, ourFault: false, alreadyRefunded: 0, paidTotal: 1140,
    };
    const off = quoteReturn({ ...base, restockingFeePct: 10, changedMind: false });
    expect(off.restockingFee).toBe(0);
    expect(off.total).toBe(1140);
    const on = quoteReturn({ ...base, restockingFeePct: 10, changedMind: true });
    expect(on.restockingFee).toBe(114); // 10% of 1140
    expect(on.total).toBe(1026);
  });

  it('absolute cap trims to paid-minus-refunded', () => {
    const q = quoteReturn({
      lines: [line(1000, 1, 1)],
      orderDiscount: 0, vatRate: 0.14,
      deliveryFee: 30, deliveryPaid: true, deliveryPolicy: 'ALWAYS',
      fullReturn: true, ourFault: false, restockingFeePct: 0, changedMind: false,
      alreadyRefunded: 1000, paidTotal: 1170,
    });
    expect(q.total).toBe(170); // 1170 - 1000
  });

  it('multiple partial returns on one line stay consistent', () => {
    const first = quoteReturn({
      lines: [line(300, 3, 1)],
      orderDiscount: 90, vatRate: 0.14,
      deliveryFee: 0, deliveryPaid: false, deliveryPolicy: 'NEVER',
      fullReturn: false, ourFault: false, restockingFeePct: 0, changedMind: false,
      alreadyRefunded: 0, paidTotal: 923.4,
    });
    // 900 gross, 90 discount → line share 30; (300-30)*1.14 = 307.8
    expect(first.lines[0].refund).toBe(307.8);
    const second = quoteReturn({
      lines: [line(300, 3, 2)],
      orderDiscount: 90, vatRate: 0.14,
      deliveryFee: 0, deliveryPaid: false, deliveryPolicy: 'NEVER',
      fullReturn: false, ourFault: false, restockingFeePct: 0, changedMind: false,
      alreadyRefunded: first.total, paidTotal: 923.4,
    });
    expect(second.lines[0].refund).toBe(615.6);
    expect(first.total + second.total).toBeLessThanOrEqual(923.41);
  });
});
