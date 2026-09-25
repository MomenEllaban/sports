import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { isPortalEnabled } from '@/lib/settings';
import { readPortalSession } from '@/lib/account/session';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

/** Customer portal profile: loyalty, orders, addresses (4.3). */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    if (!(await isPortalEnabled().catch(() => true))) {
      return apiError('FORBIDDEN', 'بوابة العميل معطّلة حالياً', 403, requestId);
    }
    const session = await readPortalSession();
    if (!session) return apiError('UNAUTHORIZED', 'سجّل الدخول لعرض حسابك', 401, requestId);
    const customer = await prisma.customer.findUnique({
      where: { id: session.customerId },
      include: {
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: { include: { product: { select: { nameAr: true, nameEn: true, sku: true } } } } } },
      },
    });
    if (!customer) return apiError('NOT_FOUND', 'تعذر العثور على حساب العميل', 404, requestId);
    return apiSuccess({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        loyaltyPoints: customer.loyaltyPoints,
        addresses: customer.addresses,
        orders: customer.orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          totalAmount: num(order.totalAmount),
          trackingNumber: order.trackingNumber,
          createdAt: order.createdAt.toISOString(),
          items: order.items.map((item) => ({
            quantity: item.quantity,
            unitPrice: num(item.unitPrice),
            totalPrice: num(item.totalPrice),
            product: item.product,
          })),
        })),
      },
    }, 200, requestId);
  } catch (error) {
    return apiInternalError(request, error, 'تعذر تحميل حساب العميل');
  }
}
