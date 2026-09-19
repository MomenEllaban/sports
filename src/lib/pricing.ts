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
