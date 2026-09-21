import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Fawry payment webhook (3.1) — public endpoint.
 * Verifies SHA256 signature when FAWRY_SECURE_KEY is set, then flips the
 * matching order (by merchantRef/orderNumber or fawryRef/paymentRef) to PAID.
 * Idempotent: already-PAID orders return success without rewrites.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderNumber: string | undefined =
      body.merchantRef || body.orderNumber || body.merchant_ref;
    const fawryRef: string | undefined = body.fawryRefNumber || body.fawry_ref || body.referenceNumber;
    const status: string | undefined = body.orderStatus || body.paymentStatus || body.status;

    if (!orderNumber && !fawryRef) {
      return NextResponse.json({ success: false, error: 'orderNumber or fawryRef is required' }, { status: 400 });
    }

    const secureKey = process.env.FAWRY_SECURE_KEY;
    const signature: string | undefined =
      req.headers.get('x-fawry-signature') || body.signature || body.messageSignature;
    if (secureKey && signature && orderNumber) {
      const expected = crypto
        .createHash('sha256')
        .update(`${orderNumber}${secureKey}`)
        .digest('hex');
      if (expected !== signature) {
        return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
      }
    }

    const order = orderNumber
      ? await prisma.order.findUnique({ where: { orderNumber } })
      : await prisma.order.findFirst({ where: { paymentRef: fawryRef } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'order not found' }, { status: 404 });
    }
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true, idempotentReplay: true, orderNumber: order.orderNumber });
    }
    const paid = !status || ['PAID', 'SUCCESS', 'SETTLED'].includes(String(status).toUpperCase());
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
