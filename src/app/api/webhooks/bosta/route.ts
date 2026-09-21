import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCourierWebhook } from '@/lib/logistics';
import { applyCourierStatus } from '@/lib/logistics/webhook';

/**
 * Bosta shipment webhook (3.2) — public endpoint.
 * Accepts Bosta delivery callbacks, normalizes the state, and advances the
 * matching order (by trackingNumber). RETURNED restocks via the order state
 * machine (exactly-once). Configure BOSTA_WEBHOOK_SECRET to enforce HMAC.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.BOSTA_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get('x-bosta-signature') || req.headers.get('x-webhook-signature');
      if (sig !== secret) {
        return NextResponse.json({ success: false, error: 'invalid signature' }, { status: 401 });
      }
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
    console.error('Bosta webhook error:', e);
    return NextResponse.json({ success: false, error: 'webhook failed' }, { status: 500 });
  }
}
