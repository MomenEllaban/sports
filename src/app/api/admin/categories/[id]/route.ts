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
    const { nameAr, nameEn, description } = await req.json();
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(nameAr && { nameAr: String(nameAr).trim() }),
        ...(nameEn && { nameEn: String(nameEn).trim() }),
        description: description || null,
      },
    });
    return NextResponse.json({ success: true, category });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'فشل في تحديث التصنيف' }, { status: 500 });
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
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف التصنيف — مرتبط بـ ${productCount} منتج` },
        { status: 409 }
      );
    }
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'فشل في حذف التصنيف' }, { status: 500 });
  }
}
