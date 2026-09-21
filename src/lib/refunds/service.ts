import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { transitionOrder, OrderTransitionError } from '@/lib/orders/status';
import { submitEtaCreditNote } from '@/lib/eta';
import { getPaymobConfig } from '@/lib/payments/paymob-config';
import { paymobAuthToken } from '@/lib/payments/paymob';
import { getFawryConfig } from '@/lib/payments/fawry-config';
import { dispatchNotification } from '@/lib/notifications';
import { writeAudit } from '@/lib/audit';
import type { PaymentMethod } from '@prisma/client';

export class RefundError extends Error {
  status = 400;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type FetchFn = typeof fetch;

const MANUAL_METHODS: PaymentMethod[] = ['COD', 'CASH', 'CARD', 'INSTAPAY', 'VODAFONE_CASH', 'KASHIER'];

/**
 * Step 1 (inside one transaction): order → RETURNED (atomic restock via the
 * state machine) + refund outbox row PENDING. Money moves later (step 2).
 * Exactly-once: RefundRequest.orderId is unique; state machine is conditional.
 */
export async function requestRefund(orderId: string, actorId: string | undefined, reason?: string, amount?: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new RefundError(404, 'الطلب غير موجود');
  if (order.paymentStatus === 'REFUNDED') throw new RefundError(409, 'الطلب مسترد بالفعل');
  if (order.orderStatus !== 'DELIVERED') throw new RefundError(400, 'الاسترداد متاح للطلبات المسلَّمة فقط');
  const existing = await prisma.refundRequest.findUnique({ where: { orderId } });
  if (existing) throw new RefundError(409, 'يوجد طلب استرداد لهذا الطلب بالفعل');
  const refundAmount = amount !== undefined ? Math.round(amount * 100) / 100 : num(order.totalAmount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > num(order.totalAmount)) {
    throw new RefundError(400, 'مبلغ الاسترداد غير صالح');
  }
  try {
    await transitionOrder(orderId, 'RETURNED', actorId);
  } catch (e) {
    const err = e as OrderTransitionError & { status?: number };
    throw new RefundError(err.status || 400, err.message);
  }
  try {
    const created = await prisma.refundRequest.create({
      data: { orderId, amount: refundAmount, reason: reason?.slice(0, 500) || null, status: 'PENDING', createdById: actorId },
    });
    writeAudit({ actorId, action: 'refund.request', entity: 'Order', entityId: orderId, metadata: { amount: refundAmount } }).catch(() => null);
    return created;
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new RefundError(409, 'يوجد طلب استرداد لهذا الطلب بالفعل');
    throw e;
  }
}

async function paymobVoidRefund(paymentRef: string | null, amount: number, f: FetchFn): Promise<string> {
  const cfg = await getPaymobConfig();
  if (!cfg.ready) throw new Error('Paymob غير مفعل — أكمل الإعدادات أولاً');
  const txnId = (paymentRef || '').replace(/^PAYMOB-/, '').trim();
  if (!txnId) throw new Error('لا يوجد مرجع بوابة صالح لهذا الطلب');
  const token = await paymobAuthToken(cfg, f);
  const res = await f('https://accept.paymob.com/api/acceptance/void_refund/refund', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_token: token, transaction_id: txnId, amount_cents: String(Math.round(amount * 100)) }),
  });
  if (!res.ok) throw new Error(`Paymob refund failed (HTTP ${res.status})`);
  return `PAYMOB-RFND-${txnId}`;
}

async function fawryRefund(orderNumber: string, amount: number, f: FetchFn): Promise<string> {
  // Best-effort: confirm exact refund schema in Fawry sandbox (see DECISIONS T02).
  const cfg = await getFawryConfig();
  if (!cfg.ready) throw new Error('Fawry غير مفعل — أكمل الإعدادات أولاً');
  const res = await f('https://www.atfawry.com/ECommerceWeb/Fawry/payments/refund', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantCode: cfg.merchantCode,
      merchantRefNum: orderNumber,
      refundAmount: amount.toFixed(2),
    }),
  });
  if (!res.ok) throw new Error(`Fawry refund failed (HTTP ${res.status})`);
  return `FAWRY-RFND-${orderNumber}`;
}

/**
 * Step 2 (outside the stock transaction): move the money with retries.
 * Claim PROCESSING first so parallel workers never double-refund.
 */
export async function processRefund(requestId: string, f: FetchFn = fetch) {
  const claimed = await prisma.refundRequest.updateMany({
    where: { id: requestId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new RefundError(409, 'طلب الاسترداد قيد المعالجة بالفعل');
  const req = await prisma.refundRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { order: { include: { items: { include: { product: true } } } } },
  });
  const order = req.order;
  const amount = num(req.amount);
  try {
    let gatewayRef: string;
    if (MANUAL_METHODS.includes(order.paymentMethod)) {
      // Cash/transfer: settled by hand (drawer noted at close); system records it.
      gatewayRef = `MANUAL-${order.orderNumber}`;
    } else if (order.paymentMethod === 'PAYMOB') {
      gatewayRef = await paymobVoidRefund(order.paymentRef, amount, f);
    } else if (order.paymentMethod === 'FAWRY') {
      gatewayRef = await fawryRefund(order.orderNumber, amount, f);
    } else {
      throw new Error(`طريقة الدفع ${order.paymentMethod} لا تدعم الاسترداد الآلي`);
    }
    await prisma.$transaction([
      prisma.refundRequest.update({ where: { id: requestId }, data: { status: 'SUCCEEDED', gatewayRef, lastError: null } }),
      prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED' } }),
    ]);
    // ETA credit note with the REAL items (never fails the refund record).
    submitEtaCreditNote({
      branchId: order.branchId,
      invoiceNumber: order.orderNumber,
      totalAmount: amount,
      vatAmount: num(order.taxAmount),
      items: order.items.map((i) => ({
        name: i.product.nameAr,
        quantity: i.quantity,
        unitPrice: num(i.unitPrice),
        totalPrice: num(i.totalPrice),
        vatAmount: 0,
      })),
    }).catch(() => null);
    dispatchNotification({
      type: 'NEW_ORDER',
      titleAr: `تم استرداد ${order.orderNumber}`,
      titleEn: `Refunded ${order.orderNumber}`,
      messageAr: `تم رد ${amount} ج.م لطلب ${order.orderNumber} (${gatewayRef}).`,
      messageEn: `Refunded ${amount} EGP for ${order.orderNumber}.`,
      branchId: order.branchId,
    }).catch(() => null);
    writeAudit({ action: 'refund.succeed', entity: 'Order', entityId: order.id, metadata: { amount, gatewayRef } }).catch(() => null);
    return { ok: true, gatewayRef };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'refund failed';
    await prisma.refundRequest.update({ where: { id: requestId }, data: { status: 'FAILED', lastError: msg } });
    return { ok: false, error: msg };
  }
}
