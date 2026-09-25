import { quoteCoupon, CouponError } from '@/lib/discounts/coupons';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { getRedeemRule } from '@/lib/settings';
import { apiError, apiSuccess, getRequestId } from '@/lib/api-response';

/** Public discount config for checkout previews (T16): rates only, no secrets. */
export async function GET(request: Request) {
  try {
    const rule = await getRedeemRule();
    return apiSuccess({ rate: rule.rate, maxPct: rule.maxPct, maxTotalPct: rule.maxTotalPct }, 200, getRequestId(request));
  } catch {
    return apiSuccess({ rate: 1, maxPct: 20, maxTotalPct: 30 }, 200, getRequestId(request));
  }
}

/** Public quote for checkout UX (T16): validates without consuming. */
export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rl = checkRateLimit(`quote:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json().catch(() => null) as { subtotal?: unknown; code?: unknown } | null;
    const subtotal = Number(body?.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) return apiError('VALIDATION_ERROR', 'الإجمالي غير صالح', 400, requestId);
    const quote = await quoteCoupon(String(body?.code || ''), subtotal);
    return apiSuccess({ amount: quote.amount, code: quote.code, kind: quote.kind }, 200, requestId);
  } catch (error) {
    const couponError = error as CouponError & { status?: number };
    return apiError('INVALID_COUPON', couponError.message || 'الكود غير صالح', couponError.status || 400, requestId);
  }
}
