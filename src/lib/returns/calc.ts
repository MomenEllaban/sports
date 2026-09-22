import { money, num } from '../pricing';

/**
 * Returns quote engine (T-RMA §2.3) — PURE, Decimal-only via num()/money().
 * Line refund = paid unit price AFTER proportional discount allocation,
 * + its 14% VAT share. Remainder pennies land on the last line so line sums
 * equal the order totals exactly. No floating point.
 */

export type ReasonCode =
  | 'SIZE_ISSUE' | 'DEFECTIVE' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED' | 'CHANGED_MIND' | 'OTHER';

export const OUR_FAULT: ReasonCode[] = ['DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED'];

export interface QuoteLineInput {
  productId: string;
  unitPrice: number;
  quantity: number; // sold
  returnedQty: number; // requested now (already-returned excluded by caller)
}

export interface ReturnQuoteInput {
  lines: QuoteLineInput[];
  /** Total discount granted on the order (coupon + loyalty + PIN). */
  orderDiscount: number;
  vatRate: number;
  deliveryFee: number;
  deliveryPaid: boolean;
  /** ALWAYS | FULL_RETURN_OR_OUR_FAULT | NEVER */
  deliveryPolicy: string;
  fullReturn: boolean;
  ourFault: boolean;
  /** Restocking fee % applied only to CHANGED_MIND lines (0 = off). */
  restockingFeePct: number;
  changedMind: boolean;
  /** Already refunded on this order (absolute cap guard). */
  alreadyRefunded: number;
  /** Actually paid total (cap reference). */
  paidTotal: number;
}

export interface QuotedLine {
  productId: string;
  returnedQty: number;
  gross: number;
  discountShare: number;
  net: number;
  vat: number;
  fee: number;
  refund: number;
}

export interface ReturnQuote {
  lines: QuotedLine[];
  itemsTotal: number;
  deliveryRefund: number;
  restockingFee: number;
  total: number;
}

/** Proportionally allocate orderDiscount across gross line values (pennies → last line). */
export function allocateDiscount(gross: number[], discount: number): number[] {
  const total = gross.reduce((s, g) => s + g, 0);
  if (total <= 0 || discount <= 0) return gross.map(() => 0);
  const capped = Math.min(discount, total);
  const out = new Array<number>(gross.length).fill(0);
  let assigned = 0;
  for (let i = 0; i < gross.length; i++) {
    if (i === gross.length - 1) {
      out[i] = money(capped - assigned);
    } else {
      out[i] = money((capped * gross[i]) / total);
      assigned = money(assigned + out[i]);
    }
  }
  return out;
}

export function quoteReturn(input: ReturnQuoteInput): ReturnQuote {
  const vatRate = input.vatRate >= 0 && input.vatRate <= 1 ? input.vatRate : 0.14;
  const gross = input.lines.map((l) => money(num(l.unitPrice) * l.returnedQty));
  const shares = allocateDiscount(gross, num(input.orderDiscount) * (gross.reduce((s, g) => s + g, 0) / Math.max(1, grossTotal(input))));
  const lines: QuotedLine[] = input.lines.map((l, i) => {
    const g = gross[i];
    const share = Math.min(shares[i], g);
    const net = money(g - share);
    const vat = money(net * vatRate);
    const fee = input.changedMind && input.restockingFeePct > 0 ? money(((net + vat) * input.restockingFeePct) / 100) : 0;
    return {
      productId: l.productId,
      returnedQty: l.returnedQty,
      gross: g,
      discountShare: share,
      net,
      vat,
      fee,
      refund: money(net + vat - fee),
    };
  });
  const itemsTotal = money(lines.reduce((s, l) => s + l.refund, 0));
  const restockingFee = money(lines.reduce((s, l) => s + l.fee, 0));

  let deliveryRefund = 0;
  if (input.deliveryPaid && num(input.deliveryFee) > 0) {
    if (input.deliveryPolicy === 'ALWAYS') deliveryRefund = num(input.deliveryFee);
    else if (input.deliveryPolicy === 'FULL_RETURN_OR_OUR_FAULT' && (input.fullReturn || input.ourFault)) {
      deliveryRefund = num(input.deliveryFee);
    }
  }
  deliveryRefund = money(deliveryRefund);

  let total = money(itemsTotal + deliveryRefund);
  // Absolute cap: never refund more than actually paid (minus prior refunds).
  const cap = money(Math.max(0, num(input.paidTotal) - num(input.alreadyRefunded)));
  if (total > cap) {
    // Trim from delivery first, then proportionally from lines (last-line remainder).
    let over = money(total - cap);
    const trimDel = Math.min(deliveryRefund, over);
    deliveryRefund = money(deliveryRefund - trimDel);
    over = money(over - trimDel);
    if (over > 0 && lines.length > 0) {
      const base = lines.reduce((s, l) => s + l.refund, 0);
      let assigned = 0;
      lines.forEach((l, i) => {
        if (i === lines.length - 1) {
          const trim = money(Math.min(l.refund, over - assigned));
          l.refund = money(l.refund - trim);
        } else {
          const trim = money(Math.min(l.refund, (over * l.refund) / base));
          l.refund = money(l.refund - trim);
          assigned = money(assigned + trim);
        }
      });
    }
    total = money(lines.reduce((s, l) => s + l.refund, 0) + deliveryRefund);
  }
  return { lines, itemsTotal: money(lines.reduce((s, l) => s + l.refund, 0)), deliveryRefund, restockingFee, total };
}

function grossTotal(input: ReturnQuoteInput): number {
  // Full-order gross (sold, not just returned) for proportional allocation.
  return input.lines.reduce((s, l) => s + money(num(l.unitPrice) * l.quantity), 0);
}

/** Sum of already-returned qty per line ref (for over-return guards). */
export function sumReturnedQty(items: Array<{ refId: string | null; productId: string; quantity: number }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const key = it.refId || `p:${it.productId}`;
    m.set(key, (m.get(key) || 0) + it.quantity);
  }
  return m;
}
