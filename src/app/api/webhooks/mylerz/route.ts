import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
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
      return apiError('UNAUTHORIZED', 'invalid signature', 401);
    }
    const body = (await req.json()) as Record<string, unknown>;
    const { trackingNumber, normalizedStatus } = parseCourierWebhook(body);
    if (!trackingNumber) {
      return apiError('VALIDATION_ERROR', 'trackingNumber is required', 400);
    }
    const order = await prisma.order.findFirst({ where: { trackingNumber } });
    if (!order) {
      return apiError('NOT_FOUND', 'order not found', 404);
    }
    const result = await applyCourierStatus(order.id, normalizedStatus);
    return NextResponse.json({ success: true, trackingNumber, ...result });
  } catch (e) {
    captureError('api/webhooks/mylerz', e);
    return apiError('INTERNAL_ERROR', 'webhook failed', 500);
  }
}
