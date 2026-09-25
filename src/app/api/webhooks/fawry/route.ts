import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { timingSafeEqual } from '@/lib/webhooks/verify';

/**
 * Fawry payment webhook (3.1) — public endpoint.
 * Fail-closed: SHA256 signature (merchantRef + secure key) is REQUIRED whenever
 * the key is configured, and unauthenticated calls are rejected outside
 * development. Only an explicit success status marks the order PAID.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const orderNumber: string | undefined =
      (body.merchantRef as string) || (body.orderNumber as string) || (body.merchant_ref as string);
    const fawryRef: string | undefined =
      (body.fawryRefNumber as string) || (body.fawry_ref as string) || (body.referenceNumber as string);
    const status: string | undefined =
      (body.orderStatus as string) || (body.paymentStatus as string) || (body.status as string);

    if (!orderNumber && !fawryRef) {
      return apiError('VALIDATION_ERROR', 'orderNumber or fawryRef is required', 400);
    }

    const secureKey = process.env.FAWRY_SECURE_KEY || process.env.FAWRY_SECURITY_KEY;
    const signature = req.headers.get('x-fawry-signature') || (body.signature as string) || (body.messageSignature as string);

    if (!secureKey) {
      return apiError('UNAUTHORIZED', 'webhook secret not configured', 401);
    }
    if (!orderNumber) {
      return apiError('UNAUTHORIZED', 'merchantRef required for signature check', 401);
    }
    const expected = crypto.createHash('sha256').update(`${orderNumber}${secureKey}`).digest('hex');
    if (!signature || !timingSafeEqual(expected, signature)) {
      return apiError('UNAUTHORIZED', 'invalid signature', 401);
    }

    const order = orderNumber
      ? await prisma.order.findUnique({ where: { orderNumber } })
      : await prisma.order.findFirst({ where: { paymentRef: fawryRef } });
    if (!order) {
      return apiError('NOT_FOUND', 'order not found', 404);
    }
    if (order.paymentMethod !== 'FAWRY') {
      return apiError('VALIDATION_ERROR', 'payment method mismatch', 400);
    }
    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED' || order.paymentStatus === 'REFUNDED') {
      return apiError('CONFLICT', 'order is no longer payable', 409);
    }
    if (order.paymentRef && fawryRef && order.paymentRef !== fawryRef) {
      return apiError('VALIDATION_ERROR', 'transaction reference mismatch', 400);
    }
    const amountValue = body.amount ?? body.amountEgp ?? body.amountCents;
    if (amountValue !== undefined) {
      const amount = Number(amountValue);
      const normalized = body.amountCents !== undefined ? amount / 100 : amount;
      if (!Number.isFinite(normalized) || Math.abs(normalized - Number(order.totalAmount)) > 0.01) {
        return apiError('VALIDATION_ERROR', 'amount mismatch', 400);
      }
    }
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true, idempotentReplay: true, orderNumber: order.orderNumber });
    }

    const paid = ['PAID', 'SUCCESS', 'SETTLED'].includes(String(status ?? '').toUpperCase());
    const failed = ['FAILED', 'CANCELLED', 'DECLINED'].includes(String(status ?? '').toUpperCase());
    if (!paid && !failed) {
      return apiError('VALIDATION_ERROR', 'payment status is ambiguous', 400);
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: paid ? 'PAID' : 'FAILED',
        paymentRef: fawryRef ?? order.paymentRef,
      },
    });
    return NextResponse.json({ success: true, orderNumber: order.orderNumber, paymentStatus: updated.paymentStatus });
  } catch (e) {
    captureError('api/webhooks/fawry', e);
    return apiError('INTERNAL_ERROR', 'webhook failed', 500);
  }
}
