import { captureError } from '@/lib/monitor';
import { apiError } from '@/lib/api-response';
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
    captureError('api/admin/brands/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في تحديث الماركة', 500);
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
      return apiError('CONFLICT', `لا يمكن حذف الماركة — مرتبطة بـ ${productCount} منتج`, 409);
    }
    await prisma.brand.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    captureError('api/admin/brands/[id]', e);
    return apiError('INTERNAL_ERROR', 'فشل في حذف الماركة', 500);
  }
}
