import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.usageLimit === null) data.usageLimit = null;
    else if (body.usageLimit !== undefined && body.usageLimit !== '') {
      const n = Math.floor(Number(body.usageLimit));
      if (!Number.isFinite(n) || n < 1) return apiError('VALIDATION_ERROR', 'حد الاستخدام غير صالح', 400);
      data.usageLimit = n;
    }
    if (body.endsAt !== undefined) {
      if (!body.endsAt) data.endsAt = null;
      else {
        const d = new Date(String(body.endsAt));
        if (isNaN(+d)) return apiError('VALIDATION_ERROR', 'التاريخ غير صالح', 400);
        data.endsAt = d;
      }
    }
    if (Object.keys(data).length === 0) return apiError('VALIDATION_ERROR', 'لا شيء للتحديث', 400);
    const updated = await prisma.coupon.update({ where: { id }, data: data as never });
    writeAudit({ actorId: (session?.user as { id?: string })?.id, action: 'coupon.update', entity: 'Coupon', entityId: id, metadata: data }).catch(() => null);
    return NextResponse.json({ success: true, coupon: updated });
  } catch (e) {
    captureError('admin/coupons/[id] PATCH', e);
    return apiError('INTERNAL_ERROR', 'تعذر تحديث الكوبون', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const uses = await prisma.couponUse.count({ where: { couponId: id } });
    if (uses > 0) return apiError('CONFLICT', 'الكوبون مستخدم — عطّله بدلاً من الحذف', 409);
    await prisma.coupon.delete({ where: { id } });
    writeAudit({ actorId: (session?.user as { id?: string })?.id, action: 'coupon.delete', entity: 'Coupon', entityId: id }).catch(() => null);
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('admin/coupons/[id] DELETE', e);
    return apiError('INTERNAL_ERROR', 'تعذر حذف الكوبون', 500);
  }
}
