import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { verifyWebhookHmac } from '@/lib/webhooks/verify';

/**
 * Paymob payment webhook (3.1) — public endpoint.
 * Fail-closed: the HMAC-SHA512 signature over the RAW body is REQUIRED when
 * PAYMOB_HMAC_SECRET is configured, and unauthenticated calls are rejected
 * outside development. Only an explicit success flips the matching order to
 * PAID, and the reported amount must match the order total.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return apiError('VALIDATION_ERROR', 'invalid JSON body', 400);
    }

    const obj = (body.obj ?? {}) as Record<string, unknown>;
    const objOrder = (obj.order ?? {}) as Record<string, unknown>;
    const orderNumber: string | undefined =
      (body.merchant_order_id as string) ||
      (body.orderNumber as string) ||
      (objOrder.merchant_order_id as string);
    const success: boolean | undefined =
      (body.success as boolean) ?? (obj.success as boolean) ?? (body.txn_response_code === 'APPROVED' ? true : undefined);
    const paidAmount: number | undefined =
      body.amount_cents !== undefined ? Number(body.amount_cents) / 100 : undefined;
    const transactionRef: string | undefined =
      (body.transactionRef as string) || (body.id !== undefined ? String(body.id) : undefined) ||
      (obj.id !== undefined ? String(obj.id) : undefined);

    const secret = process.env.PAYMOB_HMAC_SECRET;
    const signature = req.headers.get('x-paymob-signature') || (body.hmac as string) || (body.signature as string);
    if (!verifyWebhookHmac('sha512', secret, rawBody, signature)) {
      return apiError('UNAUTHORIZED', 'invalid signature', 401);
    }

    if (!orderNumber) {
      return apiError('VALIDATION_ERROR', 'orderNumber is required', 400);
    }
    if (paidAmount === undefined || !Number.isFinite(paidAmount) || paidAmount < 0) {
      return apiError('VALIDATION_ERROR', 'paid amount is required', 400);
    }

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      return apiError('NOT_FOUND', 'order not found', 404);
    }
    if (order.paymentMethod !== 'PAYMOB') {
      return apiError('VALIDATION_ERROR', 'payment method mismatch', 400);
    }
    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED' || order.paymentStatus === 'REFUNDED') {
      return apiError('CONFLICT', 'order is no longer payable', 409);
    }
    if (order.paymentRef && transactionRef && order.paymentRef !== transactionRef) {
      return apiError('VALIDATION_ERROR', 'transaction reference mismatch', 400);
    }
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true, idempotentReplay: true, orderNumber });
    }

    if (success === false) {
      await prisma.order.update({
        where: { orderNumber },
        data: { paymentStatus: 'FAILED', paymentRef: transactionRef ?? order.paymentRef },
      });
      return NextResponse.json({ success: true, orderNumber, paymentStatus: 'FAILED' });
    }
    if (success !== true) {
      return apiError('VALIDATION_ERROR', 'payment status is ambiguous', 400);
    }
    if (Math.abs(paidAmount - num(order.totalAmount)) > 0.01) {
      return apiError('VALIDATION_ERROR', 'amount mismatch', 400);
    }

    const updated = await prisma.order.update({
      where: { orderNumber },
      data: {
        paymentStatus: 'PAID',
        paymentRef: transactionRef ?? order.paymentRef,
      },
    });
    return NextResponse.json({ success: true, orderNumber, paymentStatus: updated.paymentStatus });
  } catch (e) {
    captureError('api/webhooks/paymob', e);
    return apiError('INTERNAL_ERROR', 'webhook failed', 500);
  }
}
