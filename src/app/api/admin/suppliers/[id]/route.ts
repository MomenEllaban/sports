import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

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
      if (typeof body.name !== 'string' || !body.name.trim()) return NextResponse.json({ success: false, error: 'اسم المورد مطلوب' }, { status: 400 });
      data.name = body.name.trim();
    }
    if (body.contactPerson !== undefined) data.contactPerson = body.contactPerson || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.address !== undefined) data.address = body.address || null;
    if (body.taxNumber !== undefined) data.taxNumber = body.taxNumber || null;
    if (Object.keys(data).length === 0) return NextResponse.json({ success: false, error: 'لا توجد بيانات للتحديث' }, { status: 400 });

    const existing = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'المورد غير موجود' }, { status: 404 });
    const supplier = await prisma.supplier.update({ where: { id }, data });
    return NextResponse.json({ success: true, supplier });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'فشل في تحديث المورد' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const [poCount, paymentCount] = await Promise.all([
      prisma.purchaseOrder.count({ where: { supplierId: id } }),
      prisma.supplierPayment.count({ where: { supplierId: id } }),
    ]);
    if (poCount > 0 || paymentCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف المورد — مرتبط بـ ${poCount} أمر شراء و${paymentCount} دفعة` },
        { status: 409 }
      );
    }
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'فشل في حذف المورد' }, { status: 500 });
  }
}
