import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { getSetting } from '@/lib/settings';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';
import { maskPhone } from '@/lib/pii';

/** Hardened order tracking with rate limiting and PII minimization. */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const limit = await getSetting<number>('ratelimit.trackPerMin', 30).catch(() => 30);
    const rl = checkRateLimit(`track:${clientIp(req)}`, limit, 60_000);
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') || '').trim();
    const pairOrder = (searchParams.get('order') || '').trim().toUpperCase();
    if (!query || query.length < 4) return apiError('VALIDATION_ERROR', 'مطلوب إدخال رقم الطلب أو رقم التتبع.', 400, requestId);

    const digits = query.replace(/\D/g, '');
    const looksLikePhone = digits.length >= 7 && /^[\d+\s-]+$/.test(query);
    const order = looksLikePhone
      ? pairOrder
        ? await prisma.order.findFirst({
            where: { orderNumber: { equals: pairOrder, mode: 'insensitive' }, OR: [{ guestPhone: query }, { guestPhone: digits }] },
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { product: true } } },
          })
        : null
      : await prisma.order.findFirst({
          where: { OR: [{ orderNumber: { equals: query, mode: 'insensitive' } }, { trackingNumber: { equals: query, mode: 'insensitive' } }] },
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { product: true } } },
        });

    if (!order) {
      if (looksLikePhone && !pairOrder) return apiError('VALIDATION_ERROR', 'أدخل رقم الطلب مع رقم الموبايل.', 400, requestId);
      return apiError('NOT_FOUND', 'لم يتم العثور على أي طلب مطابق.', 404, requestId);
    }

    return apiSuccess({
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
        items: order.items.map((item) => ({ name: item.product.nameAr, quantity: item.quantity, price: num(item.unitPrice) })),
      },
    }, 200, requestId);
  } catch (error) {
    return apiInternalError(req, error, 'تعذر التتبع حالياً.');
  }
}
