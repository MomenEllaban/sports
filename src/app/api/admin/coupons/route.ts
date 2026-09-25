import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { num } from '@/lib/pricing';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

function parseCouponInput(body: Record<string, unknown>) {
  const code = String(body.code || '').trim().toUpperCase();
  if (!code || code.length < 3) return { error: 'الكود قصير (3 أحرف على الأقل)' };
  const kind = body.kind === 'FIXED' ? 'FIXED' : 'PERCENT';
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) return { error: 'قيمة الخصم غير صالحة' };
  if (kind === 'PERCENT' && value > 100) return { error: 'النسبة لا تتجاوز 100%' };
  const capAmount = Math.max(0, Number(body.capAmount) || 0);
  const minTotal = Math.max(0, Number(body.minTotal) || 0);
  const usageLimit = body.usageLimit === null || body.usageLimit === undefined || body.usageLimit === ''
    ? null
    : Math.max(1, Math.floor(Number(body.usageLimit)));
  if (body.usageLimit !== null && body.usageLimit !== undefined && body.usageLimit !== '' && !Number.isFinite(Number(body.usageLimit))) {
    return { error: 'حد الاستخدام غير صالح' };
  }
  const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
  const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
  if ((startsAt && isNaN(+startsAt)) || (endsAt && isNaN(+endsAt))) return { error: 'التواريخ غير صالحة' };
  if (startsAt && endsAt && endsAt < startsAt) return { error: 'تاريخ النهاية قبل البداية' };
  return { code, kind, value, capAmount, minTotal, usageLimit, startsAt, endsAt };
}

export async function GET() {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({
      success: true,
      coupons: coupons.map((c) => ({ ...c, value: num(c.value), capAmount: num(c.capAmount), minTotal: num(c.minTotal) })),
    });
  } catch (e) {
    captureError('admin/coupons GET', e);
    return apiError('INTERNAL_ERROR', 'تعذر جلب الكوبونات', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseCouponInput(body);
    if ('error' in parsed) return apiError('VALIDATION_ERROR', String(parsed.error), 400);
    const existing = await prisma.coupon.findUnique({ where: { code: parsed.code } });
    if (existing) return apiError('CONFLICT', 'الكود مستخدم بالفعل', 409);
    const created = await prisma.coupon.create({
      data: {
        code: parsed.code,
        kind: parsed.kind,
        value: parsed.value,
        capAmount: parsed.capAmount,
        minTotal: parsed.minTotal,
        usageLimit: parsed.usageLimit,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        isActive: body.isActive !== false,
        createdById: (session?.user as { id?: string })?.id,
      },
    });
    writeAudit({ actorId: (session?.user as { id?: string })?.id, action: 'coupon.create', entity: 'Coupon', entityId: created.id, metadata: { code: created.code } }).catch(() => null);
    return NextResponse.json({ success: true, coupon: created });
  } catch (e) {
    captureError('admin/coupons POST', e);
    return apiError('INTERNAL_ERROR', 'تعذر إنشاء الكوبون', 500);
  }
}
