import { prisma } from '@/lib/db';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

/** Public review submission (T08): held for staff approval, never live directly. */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rl = checkRateLimit(`review:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json().catch(() => null) as { productId?: unknown; rating?: unknown; text?: unknown; phone?: unknown } | null;
    const productId = String(body?.productId || '');
    const rating = Math.floor(Number(body?.rating));
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 1000) : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 20) : null;
    if (!productId) return apiError('VALIDATION_ERROR', 'المنتج مطلوب', 400, requestId);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return apiError('VALIDATION_ERROR', 'التقييم من 1 إلى 5', 400, requestId);
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return apiError('NOT_FOUND', 'المنتج غير موجود', 404, requestId);
    await prisma.review.create({ data: { productId, rating, text: text || null, phone: phone || null } });
    return apiSuccess({ message: 'شكراً! تقييمك بانتظار المراجعة.' }, 200, requestId);
  } catch (error) {
    return apiInternalError(req, error, 'تعذر حفظ التقييم');
  }
}
