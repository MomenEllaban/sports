import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/guards.js';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireRole('SUPER_ADMIN', 'BRANCH_MANAGER');
    if (error) return error;
    const { id } = await params;
    const { nameAr, nameEn } = await req.json();
    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(nameAr && { nameAr: String(nameAr).trim() }),
        ...(nameEn && { nameEn: String(nameEn).trim() }),
      },
    });
    return NextResponse.json({ success: true, brand });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'فشل في تحديث الماركة' }, { status: 500 });
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
    const productCount = await prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف الماركة — مرتبطة بـ ${productCount} منتج` },
        { status: 409 }
      );
    }
    await prisma.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'فشل في حذف الماركة' }, { status: 500 });
  }
}
