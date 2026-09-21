import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';

/**
 * Public loyalty balance lookup for checkout (T16): phone → points only.
 * Rate-limited; points balance is low-sensitivity (no orders/PII returned).
 */
export async function POST(req: Request) {
  const rl = checkRateLimit(`loyalty:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    if (!phone) return NextResponse.json({ success: false, error: 'رقم الموبايل مطلوب' }, { status: 400 });
    const customer = await prisma.customer.findUnique({ where: { phone }, select: { loyaltyPoints: true } });
    return NextResponse.json({ success: true, points: customer?.loyaltyPoints || 0 });
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر جلب النقاط' }, { status: 500 });
  }
}
