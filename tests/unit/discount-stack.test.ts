import { describe, it, expect } from 'vitest';
import { computeStackDiscount, computeStackedTotals, couponAmount } from '../../src/lib/pricing.js';

const BASE = { maxTotalPct: 30, allowCouponLoyalty: true, allowCouponPin: false };

describe('discount stacking matrix (T16)', () => {
  it('coupon percent with cap', () => {
    expect(couponAmount(1000, { kind: 'PERCENT', value: 10, cap: 0 })).toBe(100);
    expect(couponAmount(1000, { kind: 'PERCENT', value: 50, cap: 200 })).toBe(200);
    expect(couponAmount(100, { kind: 'FIXED', value: 500, cap: 0 })).toBe(100);
  });

  it('coupon alone flows to totals with VAT on net', () => {
    const t = computeStackedTotals({
      lines: [{ unitPrice: 1000, quantity: 1 }],
      vatRate: 0.14,
      stack: { ...BASE, coupon: { kind: 'PERCENT', value: 10, cap: 0 } },
    });
    expect(t.couponDiscount).toBe(100);
    expect(t.totalDiscount).toBe(100);
    expect(t.vat).toBe(126); // 14% of 900
    expect(t.total).toBe(1026);
  });

  it('loyalty capped by maxPct and balance', () => {
    const s = computeStackDiscount(1000, {
      ...BASE,
      loyalty: { points: 500, rate: 1, maxPct: 20 },
    });
    expect(s.loyaltyDiscount).toBe(200);
    expect(s.pointsUsed).toBe(200);
  });

  it('coupon + loyalty stack when allowed', () => {
    const s = computeStackDiscount(1000, {
      ...BASE,
      coupon: { kind: 'FIXED', value: 100, cap: 0 },
      loyalty: { points: 100, rate: 1, maxPct: 20 },
    });
    expect(s.couponDiscount).toBe(100);
    expect(s.loyaltyDiscount).toBe(100); // 20% of nothing? of remainder 900 -> 180 cap, 100 points -> 100
    expect(s.totalDiscount).toBe(200);
  });

  it('loyalty dropped when coupon forbids stacking', () => {
    const s = computeStackDiscount(1000, {
      ...BASE,
      allowCouponLoyalty: false,
      coupon: { kind: 'FIXED', value: 100, cap: 0 },
      loyalty: { points: 100, rate: 1, maxPct: 20 },
    });
    expect(s.couponDiscount).toBe(100);
    expect(s.loyaltyDiscount).toBe(0);
    expect(s.pointsUsed).toBe(0);
  });

  it('PIN dropped with coupon by default (allowCouponPin=false)', () => {
    const s = computeStackDiscount(1000, {
      ...BASE,
      coupon: { kind: 'FIXED', value: 100, cap: 0 },
      pin: 150,
    });
    expect(s.pinDiscount).toBe(0);
    const allowed = computeStackDiscount(1000, {
      ...BASE,
      allowCouponPin: true,
      coupon: { kind: 'FIXED', value: 100, cap: 0 },
      pin: 150,
    });
    expect(allowed.pinDiscount).toBe(150);
  });

  it('combined cap trims in reverse priority (pin first)', () => {
    const s = computeStackDiscount(1000, {
      maxTotalPct: 10, allowCouponLoyalty: true, allowCouponPin: true,
      coupon: { kind: 'FIXED', value: 60, cap: 0 },
      loyalty: { points: 60, rate: 1, maxPct: 100 },
      pin: 60,
    });
    expect(s.totalDiscount).toBe(100);
    expect(s.pinDiscount).toBe(0);
    expect(s.loyaltyDiscount).toBe(40);
    expect(s.couponDiscount).toBe(60);
  });

  it('empty stack = zero discount, plain totals', () => {
    const t = computeStackedTotals({ lines: [{ unitPrice: 500, quantity: 2 }], vatRate: 0.14, stack: { ...BASE } });
    expect(t.totalDiscount).toBe(0);
    expect(t.total).toBe(1140);
  });
});
