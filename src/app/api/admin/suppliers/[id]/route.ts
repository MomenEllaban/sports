import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminSession } from '@/lib/admin-guard';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.contactPerson !== undefined) data.contactPerson = body.contactPerson || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.address !== undefined) data.address = body.address || null;
    if (body.taxNumber !== undefined) data.taxNumber = body.taxNumber || null;

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
    const { error } = await requireAdminSession();
    if (error) return error;
    const { id } = await params;
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (poCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف المورد — مرتبط بـ ${poCount} أمر شراء` },
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
