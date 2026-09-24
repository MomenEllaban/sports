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
      return NextResponse.json({ success: false, error: 'orderNumber or fawryRef is required' }, { status: 400 });
    }

    const secureKey = process.env.FAWRY_SECURE_KEY || process.env.FAWRY_SECURITY_KEY;
    const signature = req.headers.get('x-fawry-signature') || (body.signature as string) || (body.messageSignature as string);

    if (!secureKey) {
      return NextResponse.json({ success: false, error: 'webhook secret not configured' }, { status: 401 });
    }
    if (!orderNumber) {
      return NextResponse.json({ success: false, error: 'merchantRef required for signature check' }, { status: 401 });
    }
    const expected = crypto.createHash('sha256').update(`${orderNumber}${secureKey}`).digest('hex');
    if (!signature || !timingSafeEqual(expected, signature)) {
      return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
    }

    const order = orderNumber
      ? await prisma.order.findUnique({ where: { orderNumber } })
      : await prisma.order.findFirst({ where: { paymentRef: fawryRef } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'order not found' }, { status: 404 });
    }
    if (order.paymentMethod !== 'FAWRY') {
      return NextResponse.json({ success: false, error: 'payment method mismatch' }, { status: 400 });
    }
    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED' || order.paymentStatus === 'REFUNDED') {
      return NextResponse.json({ success: false, error: 'order is no longer payable' }, { status: 409 });
    }
    if (order.paymentRef && fawryRef && order.paymentRef !== fawryRef) {
      return NextResponse.json({ success: false, error: 'transaction reference mismatch' }, { status: 400 });
    }
    const amountValue = body.amount ?? body.amountEgp ?? body.amountCents;
    if (amountValue !== undefined) {
      const amount = Number(amountValue);
      const normalized = body.amountCents !== undefined ? amount / 100 : amount;
      if (!Number.isFinite(normalized) || Math.abs(normalized - Number(order.totalAmount)) > 0.01) {
        return NextResponse.json({ success: false, error: 'amount mismatch' }, { status: 400 });
      }
    }
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true, idempotentReplay: true, orderNumber: order.orderNumber });
    }

    const paid = ['PAID', 'SUCCESS', 'SETTLED'].includes(String(status ?? '').toUpperCase());
    const failed = ['FAILED', 'CANCELLED', 'DECLINED'].includes(String(status ?? '').toUpperCase());
    if (!paid && !failed) {
      return NextResponse.json({ success: false, error: 'payment status is ambiguous' }, { status: 400 });
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
    console.error('Fawry webhook error:', e);
    return NextResponse.json({ success: false, error: 'webhook failed' }, { status: 500 });
  }
}
