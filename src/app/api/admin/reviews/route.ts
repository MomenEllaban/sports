import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';
import { captureError } from '@/lib/monitor';

/** Staff review queue (T08): list pending/all + approve or delete. */
export async function GET(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const pendingOnly = new URL(req.url).searchParams.get('pending') === '1';
    const reviews = await prisma.review.findMany({
      where: pendingOnly ? { approved: false } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { product: { select: { nameAr: true, sku: true } } },
    });
    return NextResponse.json({ success: true, reviews });
  } catch (e) {
    captureError('admin/reviews GET', e);
    return NextResponse.json({ success: false, error: 'تعذر جلب التقييمات' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const body = await req.json();
    const { id, approved } = body as { id?: string; approved?: boolean };
    if (!id || typeof approved !== 'boolean') {
      return NextResponse.json({ success: false, error: 'بيانات غير صالحة' }, { status: 400 });
    }
    const updated = await prisma.review.update({ where: { id }, data: { approved } });
    writeAudit({ actorId: (session?.user as { id?: string })?.id, action: approved ? 'review.approve' : 'review.unapprove', entity: 'Review', entityId: id }).catch(() => null);
    return NextResponse.json({ success: true, review: updated });
  } catch (e) {
    captureError('admin/reviews PATCH', e);
    return NextResponse.json({ success: false, error: 'تعذر التحديث' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'المعرف مطلوب' }, { status: 400 });
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('admin/reviews DELETE', e);
    return NextResponse.json({ success: false, error: 'تعذر الحذف' }, { status: 500 });
  }
}
