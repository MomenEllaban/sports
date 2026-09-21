import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    // Deactivation is BLOCKED while any stock exists (open shifts checked in T14).
    if (body.isActive === false) {
      const stock = await prisma.branchInventory.aggregate({
        where: { branchId: id },
        _sum: { stockQuantity: true },
      });
      if ((stock._sum.stockQuantity || 0) > 0) {
        return NextResponse.json(
          { success: false, error: 'لا يمكن تعطيل فرع به مخزون — انقل المخزون أولاً' },
          { status: 400 }
        );
      }
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.nameEn && { nameEn: body.nameEn }),
        ...(body.address && { address: body.address }),
        ...(body.addressEn && { addressEn: body.addressEn }),
        ...(body.phone && { phone: body.phone }),
        ...(body.city && { city: body.city }),
        ...(body.workingHours && { workingHours: body.workingHours }),
        ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
      },
    });

    return NextResponse.json({ success: true, branch });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'فشل تحديث الفرع' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN');
    if (error) return error;

    const { id } = await params;

    // Check if branch has associated records
    const counts = await prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            sales: true,
            inventories: true,
            employees: true,
          },
        },
      },
    });

    if (
      counts &&
      (counts._count.orders > 0 ||
        counts._count.sales > 0 ||
        counts._count.employees > 0)
    ) {
      // Soft-delete by deactivating instead to maintain historical integrity
      await prisma.branch.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        success: true,
        message: 'تم تعطيل الفرع بنجاح لوجود مبيعات وموظفين مرتبطين به',
      });
    }

    await prisma.branch.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'تم حذف الفرع' });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'فشل حذف الفرع' },
      { status: 500 }
    );
  }
}
