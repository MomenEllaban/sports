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
      return NextResponse.json({ success: false, error: 'invalid JSON body' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
    }

    if (!orderNumber) {
      return NextResponse.json({ success: false, error: 'orderNumber is required' }, { status: 400 });
    }
    if (paidAmount === undefined || !Number.isFinite(paidAmount) || paidAmount < 0) {
      return NextResponse.json({ success: false, error: 'paid amount is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'order not found' }, { status: 404 });
    }
    if (order.paymentMethod !== 'PAYMOB') {
      return NextResponse.json({ success: false, error: 'payment method mismatch' }, { status: 400 });
    }
    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED' || order.paymentStatus === 'REFUNDED') {
      return NextResponse.json({ success: false, error: 'order is no longer payable' }, { status: 409 });
    }
    if (order.paymentRef && transactionRef && order.paymentRef !== transactionRef) {
      return NextResponse.json({ success: false, error: 'transaction reference mismatch' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'payment status is ambiguous' }, { status: 400 });
    }
    if (Math.abs(paidAmount - num(order.totalAmount)) > 0.01) {
      return NextResponse.json({ success: false, error: 'amount mismatch' }, { status: 400 });
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
    console.error('Paymob webhook error:', e);
    return NextResponse.json({ success: false, error: 'webhook failed' }, { status: 500 });
  }
}
