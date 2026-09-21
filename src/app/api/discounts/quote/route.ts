import { NextResponse } from 'next/server';
import { quoteCoupon, CouponError } from '@/lib/discounts/coupons';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { getRedeemRule } from '@/lib/settings';

/** Public discount config for checkout previews (T16): rates only, no secrets. */
export async function GET() {
  try {
    const rule = await getRedeemRule();
    return NextResponse.json({ success: true, rate: rule.rate, maxPct: rule.maxPct, maxTotalPct: rule.maxTotalPct });
  } catch {
    return NextResponse.json({ success: true, rate: 1, maxPct: 20, maxTotalPct: 30 });
  }
}

/** Public quote for checkout UX (T16): validates without consuming. */
export async function POST(req: Request) {
  const rl = checkRateLimit(`quote:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json();
    const subtotal = Number(body.subtotal);
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return NextResponse.json({ success: false, error: 'الإجمالي غير صالح' }, { status: 400 });
    }
    const q = await quoteCoupon(String(body.code || ''), subtotal);
    return NextResponse.json({ success: true, amount: q.amount, code: q.code, kind: q.kind });
  } catch (e) {
    const err = e as CouponError & { status?: number };
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
  }
}
