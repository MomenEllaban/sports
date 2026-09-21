import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isPortalEnabled, getSetting } from '@/lib/settings';
import { issuePortalToken, portalCookieHeader } from '@/lib/account/session';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { captureError } from '@/lib/monitor';

/**
 * Customer portal login (4.3, hardened F1):
 * - Rate-limited per IP (`ratelimit.portalLoginPerMin`).
 * - Anti-enumeration: unknown phone and wrong order number return the SAME
 *   generic 401 message (no 404 oracle for phone existence).
 * - OTP-ready: when `portal.otpMode=sms`, respond with { otpRequired: true }
 *   so the UI can switch to the OTP step once an SMS provider lands.
 */
const GENERIC_FAIL = 'بيانات الدخول غير صحيحة — تحقق من رقم الموبايل ورقم الطلب';

export async function POST(req: Request) {
  try {
    const limit = await getSetting<number>('ratelimit.portalLoginPerMin', 10).catch(() => 10);
    const rl = checkRateLimit(`portal-login:${clientIp(req)}`, limit, 60_000);
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    if (!(await isPortalEnabled().catch(() => true))) {
      return NextResponse.json({ success: false, error: 'بوابة العميل معطّلة حالياً' }, { status: 403 });
    }
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const orderNumber = String(body.orderNumber || '').trim().toUpperCase();
    if (!phone || !orderNumber) {
      return NextResponse.json({ success: false, error: 'رقم الموبايل ورقم آخر طلب مطلوبان' }, { status: 400 });
    }
    const otpMode = await getSetting<string>('portal.otpMode', 'off').catch(() => 'off');
    if (otpMode === 'sms') {
      // F1: design-ready stub — real OTP dispatch lands with the SMS provider.
      return NextResponse.json({ success: false, otpRequired: true, error: 'التحقق برمز SMS غير مفعل بعد — تواصل مع الإدارة' }, { status: 501 });
    }
    const customer = await prisma.customer.findUnique({ where: { phone } });
    const order = customer
      ? await prisma.order.findFirst({
          where: { orderNumber, OR: [{ customerId: customer.id }, { guestPhone: phone }] },
        })
      : null;
    if (!customer || !order) {
      return NextResponse.json({ success: false, error: GENERIC_FAIL }, { status: 401 });
    }
    const res = NextResponse.json({ success: true, name: customer.name, loyaltyPoints: customer.loyaltyPoints });
    res.headers.append('Set-Cookie', portalCookieHeader(issuePortalToken(customer.id)));
    return res;
  } catch (e) {
    captureError('account/login', e);
    return NextResponse.json({ success: false, error: 'تعذر تسجيل الدخول' }, { status: 500 });
  }
}
