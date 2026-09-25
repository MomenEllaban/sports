import { prisma } from '@/lib/db';
import { readPortalSession } from '@/lib/account/session';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

async function customerId() {
  const session = await readPortalSession();
  return session?.customerId || null;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const id = await customerId();
    if (!id) return apiError('UNAUTHORIZED', 'سجّل الدخول لإدارة قائمة الأمنيات', 401, requestId);
    const rows = await prisma.wishlistItem.findMany({
      where: { customerId: id },
      select: { productId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return apiSuccess({
      productIds: rows.map((row) => row.productId),
      items: rows.map((row) => ({ productId: row.productId, createdAt: row.createdAt.toISOString() })),
    }, 200, requestId);
  } catch (error) {
    return apiInternalError(request, error, 'تعذر تحميل قائمة الأمنيات');
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const id = await customerId();
    if (!id) return apiError('UNAUTHORIZED', 'سجّل الدخول لتعديل قائمة الأمنيات', 401, requestId);
    const body = await request.json().catch(() => null) as { productId?: unknown } | null;
    if (typeof body?.productId !== 'string' || !body.productId) {
      return apiError('VALIDATION_ERROR', 'productId مطلوب', 400, requestId);
    }
    const product = await prisma.product.findFirst({ where: { id: body.productId, isActive: true }, select: { id: true } });
    if (!product) return apiError('NOT_FOUND', 'المنتج غير متاح', 404, requestId);
    await prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: id, productId: product.id } },
      create: { customerId: id, productId: product.id },
      update: {},
    });
    return apiSuccess({ productId: product.id }, 200, requestId);
  } catch (error) {
    return apiInternalError(request, error, 'تعذر إضافة المنتج إلى قائمة الأمنيات');
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request);
  try {
    const id = await customerId();
    if (!id) return apiError('UNAUTHORIZED', 'سجّل الدخول لتعديل قائمة الأمنيات', 401, requestId);
    const body = await request.json().catch(() => null) as { productId?: unknown } | null;
    if (typeof body?.productId !== 'string' || !body.productId) {
      return apiError('VALIDATION_ERROR', 'productId مطلوب', 400, requestId);
    }
    await prisma.wishlistItem.deleteMany({ where: { customerId: id, productId: body.productId } });
    return apiSuccess({}, 200, requestId);
  } catch (error) {
    return apiInternalError(request, error, 'تعذر حذف المنتج من قائمة الأمنيات');
  }
}
