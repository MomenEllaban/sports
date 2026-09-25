import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { captureError } from '@/lib/monitor';

/** Customer RMA status timeline (T-RMA §5.3): phone + RTN match, masked data. */
export async function GET(req: Request) {
  const rl = checkRateLimit(`rmatrack:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const q = new URL(req.url).searchParams;
    const returnNumber = (q.get('rtn') || '').trim().toUpperCase();
    const phone = (q.get('phone') || '').trim();
    if (!returnNumber || !phone) return apiError('VALIDATION_ERROR', 'rtn + phone required', 400);
    const r = await prisma.returnRequest.findFirst({
      where: { returnNumber, customerPhone: phone },
      include: {
        items: { include: { product: { select: { nameAr: true, nameEn: true } } } },
        refunds: { select: { amount: true, method: true, status: true } },
        branch: { select: { name: true, nameEn: true } },
      },
    });
    if (!r) return apiError('NOT_FOUND', 'لا يوجد مرتجع مطابق', 404);
    return NextResponse.json({
      success: true,
      return: {
        returnNumber: r.returnNumber,
        status: r.status,
        type: r.type,
        branch: r.branch.name,
        branchEn: r.branch.nameEn,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        items: r.items.map((i) => ({ nameAr: i.product.nameAr, nameEn: i.product.nameEn, quantity: i.quantity, reasonCode: i.reasonCode, refundAmount: num(i.refundAmount) })),
        refunds: r.refunds.map((f) => ({ amount: num(f.amount), method: f.method, status: f.status })),
      },
    });
  } catch (e) {
    captureError('returns/track', e);
    return apiError('INTERNAL_ERROR', 'failed', 500);
  }
}
