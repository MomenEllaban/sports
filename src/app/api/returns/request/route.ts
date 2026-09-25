import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { checkRateLimit, clientIp, rateLimitedResponse } from '@/lib/rate-limit';
import { requestReturn, ReturnError } from '@/lib/returns/service';
import { getReturnsPolicy } from '@/lib/returns/policy';
import { captureError } from '@/lib/monitor';

/**
 * Customer return request (T-RMA §5.3): phone + order match (same ownership
 * rule as tracking), rate-limited, policy text served for ineligible orders.
 */
export async function POST(req: Request) {
  const rl = checkRateLimit(`rma:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);
  try {
    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const orderNumber = String(body.orderNumber || '').trim().toUpperCase();
    if (!phone || !orderNumber) {
      return apiError('VALIDATION_ERROR', 'رقم الموبايل ورقم الطلب مطلوبان', 400);
    }
    const order = await prisma.order.findFirst({
      where: { orderNumber, OR: [{ guestPhone: phone }, { customer: { phone } }] },
      include: { items: { include: { product: { select: { id: true, nameAr: true, sku: true, images: true, categoryId: true } } } } },
    });
    if (!order) {
      return apiError('UNAUTHORIZED', 'بيانات الطلب غير متطابقة', 401);
    }
    const policy = await getReturnsPolicy();
    if (!policy.enabled) {
      return apiError('FORBIDDEN', 'المرتجعات معطلة حالياً', 403);
    }
    const items = (Array.isArray(body.items) ? body.items : []).map((it: Record<string, unknown>) => ({
      refId: typeof it.orderItemId === 'string' ? it.orderItemId : undefined,
      productId: String(it.productId || ''),
      quantity: Math.floor(Number(it.quantity)),
      reasonCode: String(it.reasonCode || 'OTHER'),
      images: Array.isArray(it.images) ? it.images.map(String).slice(0, 3) : [],
      notes: typeof it.notes === 'string' ? it.notes : undefined,
    }));
    try {
      const { request, replay } = await requestReturn({
        orderId: order.id,
        channel: 'ONLINE',
        items,
        customerPhone: phone,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        clientRequestId: typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined,
      });
      return NextResponse.json({
        success: true,
        replay: !!replay,
        returnNumber: request.returnNumber,
        status: request.status,
        slaHours: policy.slaHours,
      });
    } catch (e) {
      const err = e as ReturnError & { status?: number };
      return apiError('REQUEST_FAILED', String(err.message), err.status || 400);
    }
  } catch (e) {
    captureError('returns/request', e);
    return apiError('INTERNAL_ERROR', 'تعذر إرسال الطلب', 500);
  }
}

/** Eligibility probe for the storefront (reasons instead of dead buttons). */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const orderNumber = (q.get('order') || '').trim().toUpperCase();
    const phone = (q.get('phone') || '').trim();
    if (!orderNumber || !phone) return apiError('VALIDATION_ERROR', 'order + phone required', 400);
    const order = await prisma.order.findFirst({
      where: { orderNumber, OR: [{ guestPhone: phone }, { customer: { phone } }] },
      include: { items: { include: { product: { select: { id: true, nameAr: true, sku: true, images: true, categoryId: true } } } } },
    });
    if (!order) return apiError('UNAUTHORIZED', 'not matched', 401);
    const policy = await getReturnsPolicy();
    const ageDays = (Date.now() - order.createdAt.getTime()) / 86_400_000;
    const blocked = new Set(policy.nonReturnableCategories);
    const reasons: string[] = [];
    if (!policy.enabled) reasons.push('المرتجعات معطلة حالياً');
    if (!['DELIVERED', 'SHIPPED'].includes(order.orderStatus)) reasons.push('المرتجع متاح بعد التسليم فقط');
    if (ageDays > policy.windowDays) reasons.push(`انتهت المدة (${policy.windowDays} يوم)`);
    const items = order.items.map((i) => ({
      orderItemId: i.id,
      productId: i.productId,
      nameAr: i.product.nameAr,
      sku: i.product.sku,
      images: i.product.images,
      quantity: i.quantity,
      unitPrice: num(i.unitPrice),
      blocked: blocked.has(i.product.categoryId),
      blockedReason: blocked.has(i.product.categoryId) ? 'الصنف غير قابل للاسترجاع' : null,
    }));
    if (items.length > 0 && items.every((i) => i.blocked)) reasons.push('كل أصناف الطلب غير قابلة للاسترجاع');
    return NextResponse.json({
      success: true,
      eligible: reasons.length === 0,
      reasons,
      orderNumber: order.orderNumber,
      items,
      policyDays: policy.windowDays,
    });
  } catch (e) {
    captureError('returns/eligibility', e);
    return apiError('INTERNAL_ERROR', 'failed', 500);
  }
}
