/**
 * CENTRAL MONEY MATH (T09) — single source of truth. All totals, VAT, discounts
 * and loyalty go through here; never duplicate this logic.
 *
 * VAT SEMANTICS (DECISION NEEDED — kept from current code, see T00):
 * Prices are VAT-EXCLUSIVE base amounts; 14% VAT is ADDED on top:
 *   total = (subtotal - discount) + 14% + deliveryFee
 * Every amount is rounded to 2 decimals at each step (consistent rounding).
 */

export const VAT_RATE = 0.14;

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

/** Round to 2 decimals (single rounding rule). */
export function money(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/**
 * API boundary rule (T10): money leaves Prisma as Decimal. Convert to plain
 * number at the boundary (JSON responses, client props, arithmetic). Never do
 * arithmetic directly on Decimal values.
 */
export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function lineTotal(unitPrice: number, quantity: number): number {
  return money(unitPrice * quantity);
}

export function linesSubtotal(lines: PricedLine[]): number {
  return money(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
}

/** Clamp discount into [0, subtotal]. */
export function clampDiscount(discount: number, subtotal: number): number {
  if (!Number.isFinite(discount) || discount < 0) return 0;
  return money(Math.min(discount, Math.max(0, subtotal)));
}

export function vatAmount(net: number, rate: number = VAT_RATE): number {
  return money(Math.max(0, net) * rate);
}

export interface TotalsInput {
  lines: PricedLine[];
  discount?: number;
  deliveryFee?: number;
  vatRate?: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  deliveryFee: number;
  total: number;
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = linesSubtotal(input.lines);
  const discount = clampDiscount(input.discount ?? 0, subtotal);
  const net = money(Math.max(0, subtotal - discount));
  const vat = vatAmount(net, input.vatRate ?? VAT_RATE);
  const deliveryFee = money(Math.max(0, input.deliveryFee ?? 0));
  const total = money(net + vat + deliveryFee);
  return { subtotal, discount, net, vat, deliveryFee, total };
}

/** Loyalty: 1 point per `perEgp` EGP of total (default from settings: 10). */
export function loyaltyEarned(total: number, perEgp = 10): number {
  if (!Number.isFinite(total) || total <= 0 || perEgp <= 0) return 0;
  return Math.floor(total / perEgp);
}

// ── T16 unified discount pipeline ──────────────────────────
// Fixed order: coupon → loyalty → manager/PIN. Stacking rules from Settings
// decide whether loyalty/PIN survive alongside a coupon. The combined total
// is capped at maxTotalPct of subtotal (trimmed in reverse priority).

export interface StackCoupon {
  kind: 'PERCENT' | 'FIXED';
  value: number;
  cap: number; // 0 = no cap
}

export interface StackLoyalty {
  points: number;
  rate: number; // EGP per point
  maxPct: number; // cap of (remaining) base, 0..100
}

export interface DiscountStack {
  coupon?: StackCoupon | null;
  loyalty?: StackLoyalty | null;
  pin?: number; // manager/PIN amount (already authorized)
  maxTotalPct: number; // 0..100
  allowCouponLoyalty: boolean;
  allowCouponPin: boolean;
}

export interface StackResult {
  couponDiscount: number;
  loyaltyDiscount: number;
  pointsUsed: number;
  pinDiscount: number;
  totalDiscount: number;
}

export function couponAmount(subtotal: number, c: StackCoupon): number {
  if (subtotal <= 0) return 0;
  const raw = c.kind === 'PERCENT' ? (subtotal * Math.max(0, c.value)) / 100 : Math.max(0, c.value);
  const capped = c.cap > 0 ? Math.min(raw, c.cap) : raw;
  return money(Math.min(capped, subtotal));
}

export function computeStackDiscount(subtotal: number, stack: DiscountStack): StackResult {
  const base = money(Math.max(0, subtotal));
  const capTotal = money((base * Math.min(100, Math.max(0, stack.maxTotalPct))) / 100);

  let couponDiscount = stack.coupon ? couponAmount(base, stack.coupon) : 0;
  let loyaltyDiscount = 0;
  let pointsUsed = 0;
  const loyaltyAllowed = !stack.coupon || stack.allowCouponLoyalty || couponDiscount === 0;
  if (stack.loyalty && stack.loyalty.points > 0 && stack.loyalty.rate > 0 && loyaltyAllowed) {
    const afterCoupon = money(base - couponDiscount);
    const maxByPct = money((afterCoupon * Math.min(100, Math.max(0, stack.loyalty.maxPct))) / 100);
    loyaltyDiscount = money(Math.min(stack.loyalty.points * stack.loyalty.rate, maxByPct, afterCoupon));
    pointsUsed = Math.min(stack.loyalty.points, Math.round((loyaltyDiscount / stack.loyalty.rate) * 100) / 100);
    pointsUsed = Math.floor(pointsUsed);
    loyaltyDiscount = money(Math.min(loyaltyDiscount, pointsUsed * stack.loyalty.rate));
  }
  let pinDiscount = clampDiscount(stack.pin ?? 0, money(base - couponDiscount - loyaltyDiscount));
  const pinAllowed = !stack.coupon || stack.allowCouponPin || couponDiscount === 0;
  if (!pinAllowed) pinDiscount = 0;

  // Enforce the combined cap in reverse priority: pin → loyalty → coupon.
  let total = money(couponDiscount + loyaltyDiscount + pinDiscount);
  if (total > capTotal) {
    let over = money(total - capTotal);
    const trimPin = Math.min(pinDiscount, over);
    pinDiscount = money(pinDiscount - trimPin);
    over = money(over - trimPin);
    if (over > 0) {
      const trimLoy = Math.min(loyaltyDiscount, over);
      loyaltyDiscount = money(loyaltyDiscount - trimLoy);
      over = money(over - trimLoy);
      if (loyaltyDiscount === 0) pointsUsed = 0;
      else pointsUsed = Math.floor(money(loyaltyDiscount / (stack.loyalty?.rate || 1)));
    }
    if (over > 0) couponDiscount = money(couponDiscount - Math.min(couponDiscount, over));
    total = money(couponDiscount + loyaltyDiscount + pinDiscount);
  }
  return { couponDiscount, loyaltyDiscount, pointsUsed, pinDiscount, totalDiscount: total };
}

export interface StackedTotals extends Totals {
  couponDiscount: number;
  loyaltyDiscount: number;
  pointsUsed: number;
  pinDiscount: number;
  totalDiscount: number;
}

/** Totals through the unified pipeline (VAT on the discounted net). */
export function computeStackedTotals(input: TotalsInput & { stack: DiscountStack }): StackedTotals {
  const subtotal = linesSubtotal(input.lines);
  const s = computeStackDiscount(subtotal, input.stack);
  const base = computeTotals({ lines: input.lines, discount: s.totalDiscount, deliveryFee: input.deliveryFee, vatRate: input.vatRate });
  return { ...base, totalDiscount: s.totalDiscount, couponDiscount: s.couponDiscount, loyaltyDiscount: s.loyaltyDiscount, pointsUsed: s.pointsUsed, pinDiscount: s.pinDiscount };
}
