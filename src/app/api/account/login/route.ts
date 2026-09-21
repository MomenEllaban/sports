import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isPortalEnabled } from '@/lib/settings';
import { issuePortalToken, portalCookieHeader } from '@/lib/account/session';

/**
 * Customer portal login (4.3) — phone + last order number as verification.
 * No passwords: the order number proves ownership of the phone's orders.
 */
export async function POST(req: Request) {
  try {
    if (!(await isPortalEnabled().catch(() => true))) {
      return NextResponse.json({ success: false, error: 'بوابة العميل معطّلة حالياً' }, { status: 403 });
    }
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const orderNumber = String(body.orderNumber || '').trim().toUpperCase();
    if (!phone || !orderNumber) {
      return NextResponse.json({ success: false, error: 'رقم الموبايل ورقم آخر طلب مطلوبان' }, { status: 400 });
    }
    const customer = await prisma.customer.findUnique({ where: { phone } });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'لا يوجد حساب بهذا الرقم — اطلب أولاً من المتجر' }, { status: 404 });
    }
    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        OR: [{ customerId: customer.id }, { guestPhone: phone }],
      },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: 'رقم الطلب غير مطابق لهذا الرقم' }, { status: 401 });
    }
    const res = NextResponse.json({ success: true, name: customer.name, loyaltyPoints: customer.loyaltyPoints });
    res.headers.append('Set-Cookie', portalCookieHeader(issuePortalToken(customer.id)));
    return res;
  } catch (e) {
    console.error('Portal login error:', e);
    return NextResponse.json({ success: false, error: 'تعذر تسجيل الدخول' }, { status: 500 });
  }
}
