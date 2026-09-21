import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export class CouponError extends Error {
  status = 400;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface CouponQuote {
  id: string;
  code: string;
  kind: 'PERCENT' | 'FIXED';
  value: number;
  cap: number;
  amount: number;
}

/** Validate a coupon code against an order subtotal (no writes). */
export async function quoteCoupon(code: string, subtotal: number): Promise<CouponQuote> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new CouponError(400, 'أدخل كود الخصم');
  const c = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!c || !c.isActive) throw new CouponError(404, 'كود الخصم غير صالح');
  const now = new Date();
  if (c.startsAt && c.startsAt > now) throw new CouponError(400, 'الكود لم يبدأ بعد');
  if (c.endsAt && c.endsAt < now) throw new CouponError(400, 'انتهت صلاحية الكود');
  if (num(c.minTotal) > subtotal) {
    throw new CouponError(400, `الكود يتطلب حداً أدنى ${num(c.minTotal).toLocaleString()} ج.م`);
  }
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) {
    throw new CouponError(400, 'تم استنفاد استخدامات الكود');
  }
  const kind = c.kind === 'FIXED' ? 'FIXED' : 'PERCENT';
  const raw = kind === 'PERCENT' ? (subtotal * num(c.value)) / 100 : num(c.value);
  const capped = num(c.capAmount) > 0 ? Math.min(raw, num(c.capAmount)) : raw;
  const amount = Math.round(Math.min(capped, subtotal) * 100) / 100;
  return { id: c.id, code: c.code, kind, value: num(c.value), cap: num(c.capAmount), amount };
}

/**
 * Atomically consume one usage inside the caller's transaction.
 * The conditional update is the exactly-once lock (limit races safe).
 */
export async function consumeCoupon(
  tx: Tx,
  couponId: string,
  use: { orderId?: string; saleId?: string; customerId?: string | null; amount: number }
): Promise<void> {
  const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
  if (!coupon || !coupon.isActive) throw new CouponError(400, 'كود الخصم غير صالح');
  if (coupon.usageLimit !== null) {
    const claimed = await tx.coupon.updateMany({
      where: { id: couponId, usedCount: { lt: coupon.usageLimit } },
      data: { usedCount: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new CouponError(400, 'تم استنفاد استخدامات الكود');
  } else {
    await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
  }
  await tx.couponUse.create({
    data: {
      couponId,
      orderId: use.orderId,
      saleId: use.saleId,
      customerId: use.customerId,
      amount: Math.round(use.amount * 100) / 100,
    },
  });
}

/** Atomically redeem loyalty points (conditional decrement — no overdraft). */
export async function redeemPoints(
  tx: Tx,
  customerId: string,
  points: number
): Promise<void> {
  if (points <= 0) return;
  const updated = await tx.customer.updateMany({
    where: { id: customerId, loyaltyPoints: { gte: points } },
    data: { loyaltyPoints: { decrement: points } },
  });
  if (updated.count !== 1) throw new CouponError(400, 'رصيد النقاط لا يكفي');
}
