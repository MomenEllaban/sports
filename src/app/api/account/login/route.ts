import { prisma } from '@/lib/db';
import { isPortalEnabled, getSetting } from '@/lib/settings';
import { issuePortalToken, portalCookieHeader } from '@/lib/account/session';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { apiError, apiInternalError, apiSuccess, getRequestId } from '@/lib/api-response';

/**
 * Customer portal login (4.3, hardened F1):
 * - Rate-limited per IP (`ratelimit.portalLoginPerMin`).
 * - Anti-enumeration: unknown phone and wrong order number return the same
 *   generic 401 message.
 * - OTP-ready: when `portal.otpMode=sms`, return an explicit not-ready state.
 */
const GENERIC_FAIL = 'بيانات الدخول غير صحيحة — تحقق من رقم الموبايل ورقم الطلب';

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const limit = await getSetting<number>('ratelimit.portalLoginPerMin', 10).catch(() => 10);
    const rl = checkRateLimit(`portal-login:${clientIp(req)}`, limit, 60_000);
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    if (!(await isPortalEnabled().catch(() => true))) {
      return apiError('FORBIDDEN', 'بوابة العميل معطّلة حالياً', 403, requestId);
    }
    const body = await req.json().catch(() => null) as { phone?: unknown; orderNumber?: unknown } | null;
    const phone = String(body?.phone || '').trim();
    const orderNumber = String(body?.orderNumber || '').trim().toUpperCase();
    if (!phone || !orderNumber) {
      return apiError('VALIDATION_ERROR', 'رقم الموبايل ورقم آخر طلب مطلوبان', 400, requestId);
    }
    const otpMode = await getSetting<string>('portal.otpMode', 'off').catch(() => 'off');
    if (otpMode === 'sms') {
      return apiError('NOT_IMPLEMENTED', 'التحقق برمز SMS غير مفعّل بعد — تواصل مع الإدارة', 501, requestId, { otpRequired: true });
    }
    const customer = await prisma.customer.findUnique({ where: { phone } });
    const order = customer
      ? await prisma.order.findFirst({
          where: { orderNumber, OR: [{ customerId: customer.id }, { guestPhone: phone }] },
        })
      : null;
    if (!customer || !order) return apiError('UNAUTHORIZED', GENERIC_FAIL, 401, requestId);
    const res = apiSuccess({ name: customer.name, loyaltyPoints: customer.loyaltyPoints }, 200, requestId);
    res.headers.append('Set-Cookie', portalCookieHeader(issuePortalToken(customer.id)));
    return res;
  } catch (error) {
    return apiInternalError(req, error, 'تعذر تسجيل الدخول');
  }
}
