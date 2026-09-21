import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCourierWebhook } from '@/lib/logistics';
import { applyCourierStatus } from '@/lib/logistics/webhook';
import { verifyWebhookSecret } from '@/lib/webhooks/verify';

/**
 * Mylerz shipment webhook (3.2) — public endpoint.
 * Same contract as the Bosta webhook with its own optional shared secret
 * (MYLERZ_WEBHOOK_SECRET). RETURNED restocks exactly-once via the state machine.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.MYLERZ_WEBHOOK_SECRET;
    const sig = req.headers.get('x-mylerz-signature') || req.headers.get('x-webhook-signature');
    if (!verifyWebhookSecret(secret, sig)) {
      return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const { trackingNumber, normalizedStatus } = parseCourierWebhook(body);
    if (!trackingNumber) {
      return NextResponse.json({ success: false, error: 'trackingNumber is required' }, { status: 400 });
    }
    const order = await prisma.order.findFirst({ where: { trackingNumber } });
    if (!order) {
      return NextResponse.json({ success: false, error: 'order not found' }, { status: 404 });
    }
    const result = await applyCourierStatus(order.id, normalizedStatus);
    return NextResponse.json({ success: true, trackingNumber, ...result });
  } catch (e) {
    console.error('Mylerz webhook error:', e);
    return NextResponse.json({ success: false, error: 'webhook failed' }, { status: 500 });
  }
}
