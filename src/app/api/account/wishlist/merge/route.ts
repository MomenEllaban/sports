import { prisma } from '@/lib/db';
import { readPortalSession } from '@/lib/account/session';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await readPortalSession();
    if (!session) return apiError('UNAUTHORIZED', 'سجّل الدخول لدمج قائمة الأمنيات', 401, requestId);
    const body = await request.json().catch(() => null) as { productIds?: unknown } | null;
    const ids = Array.isArray(body?.productIds)
      ? [...new Set(body.productIds.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 500)
      : [];
    const products = ids.length
      ? await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } })
      : [];
    const validIds = products.map((product) => product.id);
    if (validIds.length) {
      await prisma.wishlistItem.createMany({
        data: validIds.map((productId) => ({ customerId: session.customerId, productId })),
        skipDuplicates: true,
      });
    }
    const rows = await prisma.wishlistItem.findMany({
      where: { customerId: session.customerId },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return apiSuccess({ productIds: rows.map((row) => row.productId) }, 200, requestId);
  } catch (error) {
    return apiInternalError(request, error, 'تعذر دمج قائمة الأمنيات');
  }
}
