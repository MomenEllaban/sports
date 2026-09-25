import { prisma } from '@/lib/db';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

/** Public loyalty balance lookup for checkout (T16): phone → points only. */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rl = checkRateLimit(`loyalty:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json().catch(() => null) as { phone?: unknown } | null;
    const phone = String(body?.phone || '').trim();
    if (!phone) return apiError('VALIDATION_ERROR', 'رقم الموبايل مطلوب', 400, requestId);
    const customer = await prisma.customer.findUnique({ where: { phone }, select: { loyaltyPoints: true } });
    return apiSuccess({ points: customer?.loyaltyPoints || 0 }, 200, requestId);
  } catch (error) {
    return apiInternalError(req, error, 'تعذر جلب النقاط');
  }
}
