import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { getSetting } from '@/lib/settings';
import { captureError } from '@/lib/monitor';
import { maskPhone } from '@/lib/pii';

/**
 * Hardened order tracking (F1):
 * - Rate-limited per IP (settings `ratelimit.trackPerMin`).
 * - Phone-only guesses rejected: a phone query MUST be paired with the
 *   order number (`?query=<phone>&order=<ORD-...>`).
 * - Exact order/tracking numbers work alone.
 * - PII minimized: phone masked, address truncated to zone/city.
 */
export async function GET(req: Request) {
  try {
    const limit = await getSetting<number>('ratelimit.trackPerMin', 30).catch(() => 30);
    const rl = checkRateLimit(`track:${clientIp(req)}`, limit, 60_000);
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') || '').trim();
    const pairOrder = (searchParams.get('order') || '').trim().toUpperCase();

    if (!query || query.length < 4) {
      return NextResponse.json({ success: false, message: 'مطلوب إدخال رقم الطلب أو رقم التتبع.' }, { status: 400 });
    }

    const digits = query.replace(/\D/g, '');
    const looksLikePhone = digits.length >= 7 && /^[\d+\s-]+$/.test(query);

    let order = null;
    if (looksLikePhone) {
      // Anti-enumeration: phone alone never resolves. Require the order number.
      if (!pairOrder) {
        return NextResponse.json({ success: false, message: 'أدخل رقم الطلب مع رقم الموبايل.' }, { status: 400 });
      }
      order = await prisma.order.findFirst({
        where: { orderNumber: { equals: pairOrder, mode: 'insensitive' }, OR: [{ guestPhone: query }, { guestPhone: digits }] },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
      });
    } else {
      order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: query, mode: 'insensitive' } },
            { trackingNumber: { equals: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
      });
    }

    if (!order) {
      return NextResponse.json({ success: false, message: 'لم يتم العثور على أي طلب مطابق.' });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        shippingProvider: order.shippingProvider,
        trackingNumber: order.trackingNumber,
        totalAmount: num(order.totalAmount),
        guestName: order.guestName,
        guestPhone: maskPhone(order.guestPhone),
        deliveryZone: order.deliveryZone,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((i) => ({
          name: i.product.nameAr,
          quantity: i.quantity,
          price: num(i.unitPrice),
        })),
      },
    });
  } catch (e) {
    captureError('orders/track', e);
    return NextResponse.json({ success: false, message: 'تعذر التتبع حالياً.' }, { status: 500 });
  }
}
