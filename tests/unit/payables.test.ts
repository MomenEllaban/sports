import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  splitPayments,
  paidForOrder,
  paymentStateFor,
  receivedValueOf,
  outstandingFor,
} from '../../src/lib/purchasing/payables.js';
import { money } from '../../src/lib/pricing.js';

const items = (unitCost: number, ordered: number, received: number) => [
  { unitCost, quantityOrdered: ordered, quantityReceived: received },
];

describe('supplier payment attribution', () => {
  it('keeps a payment booked against the order it names', () => {
    const { attributed, unattributedTotal } = splitPayments([
      { amount: 500, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po1' },
    ]);
    expect(attributed.get('po1')).toBe(500);
    expect(unattributedTotal).toBe(0);
  });

  it('does not smear one payment across a supplier\'s other orders', () => {
    // The original defect: a 2000 payment to a supplier with a 1000 order and a
    // 2000 order was applied to both, so both read as settled and the reported
    // cash exceeded what was actually paid by 1000.
    const { attributed, attributedTotal } = splitPayments([
      { amount: 2000, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po2' },
    ]);
    expect(paidForOrder({ id: 'po1', totalAmount: 1000 }, attributed)).toBe(0);
    expect(paidForOrder({ id: 'po2', totalAmount: 2000 }, attributed)).toBe(2000);
    expect(attributedTotal).toBe(2000);
  });

  it('reports an advance separately instead of crediting an invoice', () => {
    const { attributed, unattributedTotal, attributedTotal } = splitPayments([
      { amount: 300, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: null },
      { amount: 700, createdAt: '2026-01-02T00:00:00.000Z', purchaseOrderId: 'po1' },
    ]);
    expect(attributed.get('po1')).toBe(700);
    expect(unattributedTotal).toBe(300);
    // Cash actually left the business, and the two columns add up to it.
    expect(attributedTotal + unattributedTotal).toBe(1000);
  });

  it('sums several payments naming the same order', () => {
    const { attributed } = splitPayments([
      { amount: 100.5, createdAt: '2026-01-02T00:00:00.000Z', purchaseOrderId: 'po1' },
      { amount: 249.5, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po1' },
    ]);
    expect(attributed.get('po1')).toBe(350);
  });

  it('ignores non-positive and non-finite amounts', () => {
    const { attributed, unattributedTotal, attributedTotal } = splitPayments([
      { amount: 0, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po1' },
      { amount: -50, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po1' },
      { amount: NaN, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po1' },
    ]);
    expect(attributed.size).toBe(0);
    expect(unattributedTotal).toBe(0);
    expect(attributedTotal).toBe(0);
  });

  it('never lets booked cash exceed the order total', () => {
    const { attributed } = splitPayments([
      { amount: 5000, createdAt: '2026-01-01T00:00:00.000Z', purchaseOrderId: 'po1' },
    ]);
    expect(paidForOrder({ id: 'po1', totalAmount: 1000 }, attributed)).toBe(1000);
  });
});

describe('committed value of a purchase order', () => {
  it('commits nothing while no goods have arrived', () => {
    expect(receivedValueOf({ totalAmount: 1000 }, items(10, 100, 0))).toBe(0);
  });

  it('commits the full order once everything is received', () => {
    expect(receivedValueOf({ totalAmount: 1000 }, items(10, 100, 100))).toBe(1000);
  });

  it('commits only the received share part-way through', () => {
    expect(receivedValueOf({ totalAmount: 1000 }, items(10, 100, 40))).toBe(400);
  });

  it('weights each line by its own unit cost', () => {
    const twoLines = [
      { unitCost: 10, quantityOrdered: 100, quantityReceived: 0 },
      { unitCost: 50, quantityOrdered: 20, quantityReceived: 20 },
    ];
    // Ordered value is 1000 + 1000 = 2000; received is only the 1000 of line 2.
    expect(receivedValueOf({ totalAmount: 2000 }, twoLines)).toBe(1000);
  });

  it('treats an over-received line as fully received', () => {
    expect(receivedValueOf({ totalAmount: 1000 }, items(10, 100, 130))).toBe(1000);
  });

  it('falls back to the order total when the lines carry no value', () => {
    expect(receivedValueOf({ totalAmount: 750 }, items(0, 10, 5))).toBe(750);
    expect(receivedValueOf({ totalAmount: 750 }, [])).toBe(0);
  });
});

describe('invoice balance', () => {
  it('reports the remainder as outstanding', () => {
    expect(outstandingFor(1000, 250)).toBe(750);
    expect(outstandingFor(1000, 1000)).toBe(0);
  });

  it('never reports a negative balance after an overpayment', () => {
    expect(outstandingFor(1000, 1200)).toBe(0);
  });

  it('derives payment state from paid versus committed', () => {
    expect(paymentStateFor(0, 1000)).toBe('UNPAID');
    expect(paymentStateFor(250, 1000)).toBe('PARTIALLY_PAID');
    expect(paymentStateFor(1000, 1000)).toBe('PAID');
  });

  it('does not leave a settled invoice open over a cent of rounding', () => {
    expect(paymentStateFor(1000, 999.99)).toBe('PAID');
  });

  it('treats a zero commitment as unpaid rather than settled', () => {
    expect(paymentStateFor(0, 0)).toBe('UNPAID');
  });
});

describe('payables invariants', () => {
  const amount = fc.integer({ min: 0, max: 1_000_000 }).map((cents) => cents / 100);

  it('outstanding is never negative and never exceeds the commitment', () => {
    fc.assert(
      fc.property(amount, amount, (committed, paid) => {
        const due = outstandingFor(committed, paid);
        expect(due).toBeGreaterThanOrEqual(0);
        expect(due).toBeLessThanOrEqual(committed);
      }),
    );
  });

  it('a fully paid commitment is exactly settled', () => {
    fc.assert(
      fc.property(amount, (total) => {
        // Zero committed means nothing is deliverable yet, so it is reported as
        // unpaid rather than settled (see the zero-commitment case below).
        if (total <= 0) return;
        expect(paymentStateFor(total, total)).toBe('PAID');
        expect(outstandingFor(total, total)).toBe(0);
      }),
    );
  });

  it('an unpaid commitment is never reported as settled', () => {
    fc.assert(
      fc.property(amount, (total) => {
        if (total > 0) expect(paymentStateFor(0, total)).toBe('UNPAID');
      }),
    );
  });

  it('attributed plus unattributed cash never exceeds the amount paid', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(amount, fc.boolean()), { maxLength: 25 }),
        (entries) => {
          const payments = entries.map(([value, attributed], i) => ({
            amount: value,
            createdAt: new Date(2026, 0, i + 1).toISOString(),
            purchaseOrderId: attributed ? 'po1' : null,
          }));
          const { attributedTotal, unattributedTotal } = splitPayments(payments);
          // Compare in integer cents. Each bucket is already rounded by the
          // implementation, but adding two floats reintroduces drift
          // (9734.33 + 6154.17 + 499.19 = 16387.690000000002).
          const cents = (v: number) => Math.round(v * 100);
          const sum = entries.reduce((s, [v]) => money(s + v), 0);
          expect(cents(attributedTotal) + cents(unattributedTotal)).toBeLessThanOrEqual(cents(sum));
        },
      ),
    );
  });

  it('committed value stays within the order total for any receipt pattern', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 500 }), (ordered, received) => {
        const total = ordered * 10;
        const committed = receivedValueOf({ totalAmount: total }, items(10, ordered, received));
        expect(committed).toBeGreaterThanOrEqual(0);
        expect(committed).toBeLessThanOrEqual(total);
      }),
    );
  });
});
