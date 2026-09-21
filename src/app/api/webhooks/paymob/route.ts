import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Paymob payment webhook (3.1) — public endpoint.
 * Verifies HMAC-SHA512 signature when PAYMOB_HMAC_SECRET is set, then flips
 * the matching order (by orderNumber) to PAID. Idempotent: already-PAID
 * orders return success without rewrites.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderNumber: string | undefined =
      body.merchant_order_id || body.orderNumber || body.obj?.order?.merchant_order_id;
    const success: boolean | undefined =
      body.success ?? body.obj?.success ?? body.txn_response_code === 'APPROVED';
    const paidAmount: number | undefined =
      body.amount_cents !== undefined ? Number(body.amount_cents) / 100 : undefined;
    const transactionRef: string | undefined =
      body.transactionRef || body.id?.toString() || body.obj?.id?.toString();

    if (!orderNumber) {
      return NextResponse.json({ success: false, error: 'orderNumber is required' }, { status: 400 });
    }

    const secret = process.env.PAYMOB_HMAC_SECRET;
    const signature: string | undefined =
      req.headers.get('x-paymob-signature') || body.hmac || body.signature;
    if (secret && signature) {
      const expected = crypto.createHmac('sha512', secret).update(JSON.stringify(body)).digest('hex');
      if (expected !== signature) {
        return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
      }
    }

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'order not found' }, { status: 404 });
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
    const updated = await prisma.order.update({
      where: { orderNumber },
      data: {
        paymentStatus: 'PAID',
        paymentRef: transactionRef ?? order.paymentRef,
        ...(paidAmount !== undefined && Number.isFinite(paidAmount) ? {} : {}),
      },
    });
    return NextResponse.json({ success: true, orderNumber, paymentStatus: updated.paymentStatus });
  } catch (e) {
    console.error('Paymob webhook error:', e);
    return NextResponse.json({ success: false, error: 'webhook failed' }, { status: 500 });
  }
}
