import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { money, linesSubtotal, clampDiscount, vatAmount, computeTotals, loyaltyEarned, VAT_RATE } from '../../src/lib/pricing.js';

const lineArb = fc.record({
  unitPrice: fc.integer({ min: 0, max: 100000 }),
  quantity: fc.integer({ min: 0, max: 100 }),
});

describe('pricing module (T09)', () => {
  it('matches legacy formulas on known values (no behavior change)', () => {
    // legacy: Math.round(sub*0.14*100)/100 ; total = net + vat + fee
    const t = computeTotals({
      lines: [{ unitPrice: 350, quantity: 1 }, { unitPrice: 1450, quantity: 1 }],
      discount: 0,
      deliveryFee: 30,
    });
    expect(t.subtotal).toBe(1800);
    expect(t.vat).toBe(252);
    expect(t.total).toBe(2082);
    expect(VAT_RATE).toBe(0.14);
  });

  it('discount clamped to [0, subtotal]; totals never negative', () => {
    expect(clampDiscount(-5, 100)).toBe(0);
    expect(clampDiscount(NaN, 100)).toBe(0);
    expect(clampDiscount(500, 100)).toBe(100);
    const t = computeTotals({ lines: [{ unitPrice: 100, quantity: 1 }], discount: 9999 });
    expect(t.total).toBeGreaterThanOrEqual(0);
    expect(t.net).toBe(0);
  });

  it('loyalty rule: 1 point per 10 EGP', () => {
    expect(loyaltyEarned(500)).toBe(50);
    expect(loyaltyEarned(9.99)).toBe(0);
    expect(loyaltyEarned(-5)).toBe(0);
  });

  it('property: total == net + vat + fee; line sums consistent', () => {
    fc.assert(
      fc.property(
        fc.array(lineArb, { maxLength: 10 }),
        fc.integer({ min: 0, max: 50000 }),
        fc.integer({ min: 0, max: 500 }),
        (lines, discount, fee) => {
          const t = computeTotals({ lines, discount, deliveryFee: fee });
          expect(t.total).toBe(money(t.net + t.vat + t.deliveryFee));
          expect(t.subtotal).toBe(linesSubtotal(lines));
          expect(t.total).toBeGreaterThanOrEqual(0);
          expect(t.discount).toBeLessThanOrEqual(t.subtotal);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: vat is 14% of net (exclusive semantics)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), (net) => {
        expect(vatAmount(net)).toBe(money(net * 0.14));
      }),
      { numRuns: 200 }
    );
  });
});
