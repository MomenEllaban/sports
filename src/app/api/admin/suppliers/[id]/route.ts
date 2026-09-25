import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';
import { writeAudit } from '@/lib/audit';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return apiError('VALIDATION_ERROR', 'اسم المورد مطلوب', 400);
      data.name = body.name.trim();
    }
    if (body.contactPerson !== undefined) data.contactPerson = body.contactPerson || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.address !== undefined) data.address = body.address || null;
    if (body.taxNumber !== undefined) data.taxNumber = body.taxNumber || null;
    if (Object.keys(data).length === 0) return apiError('VALIDATION_ERROR', 'لا توجد بيانات للتحديث', 400);

    const existing = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return apiError('NOT_FOUND', 'المورد غير موجود', 404);
    const supplier = await prisma.supplier.update({ where: { id }, data });
    return NextResponse.json({ success: true, supplier });
  } catch (e) {
    captureError('api/admin/suppliers/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في تحديث المورد', 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const [poCount, paymentCount] = await Promise.all([
      prisma.purchaseOrder.count({ where: { supplierId: id } }),
      prisma.supplierPayment.count({ where: { supplierId: id } }),
    ]);
    if (poCount > 0 || paymentCount > 0) {
      return apiError('CONFLICT', `لا يمكن حذف المورد — مرتبط بـ ${poCount} أمر شراء و${paymentCount} دفعة`, 409);
    }
    const target = await prisma.supplier.findUnique({ where: { id }, select: { name: true } });
    await prisma.supplier.delete({ where: { id } });
    void writeAudit({
      actorId: (session?.user as { id?: string } | undefined)?.id,
      action: 'supplier.deleted',
      entity: 'Supplier',
      entityId: id,
      metadata: { name: target?.name },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/suppliers/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في حذف المورد', 500);
  }
}
