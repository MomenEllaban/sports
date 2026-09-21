import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { captureError } from '@/lib/monitor';

/** Public review submission (T08): held for staff approval, never live directly. */
export async function POST(req: Request) {
  const rl = checkRateLimit(`review:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json();
    const productId = String(body.productId || '');
    const rating = Math.floor(Number(body.rating));
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : null;
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 20) : null;
    if (!productId) return NextResponse.json({ success: false, error: 'المنتج مطلوب' }, { status: 400 });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'التقييم من 1 إلى 5' }, { status: 400 });
    }
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return NextResponse.json({ success: false, error: 'المنتج غير موجود' }, { status: 404 });
    await prisma.review.create({ data: { productId, rating, text: text || null, phone: phone || null } });
    return NextResponse.json({ success: true, message: 'شكراً! تقييمك بانتظار المراجعة.' });
  } catch (e) {
    captureError('reviews POST', e);
    return NextResponse.json({ success: false, error: 'تعذر حفظ التقييم' }, { status: 500 });
  }
}
